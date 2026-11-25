import { prisma } from '@december/database'
import { DEFAULT_IDLE_STOP_MINUTES, IDLE_STOP_MINUTES } from '@december/shared'

// #624 part 4: running sandboxes are counted per user in the database (Session.sandboxStatus),
// so the limit holds with any number of workers. paused sandboxes do not count.
export const MAX_RUNNING_SANDBOXES_PER_USER = 10
// the idle time of a user who did not choose one (User.idleStopMinutes, #637)
export const SANDBOX_IDLE_PAUSE_MS = DEFAULT_IDLE_STOP_MINUTES * 60 * 1000
// E2B pauses a sandbox this long after its timeout was last set (create, resume, extend)
export const E2B_SANDBOX_TIMEOUT_MS = 30 * 60 * 1000
// a sandbox that must stay up past the E2B timeout gets it pushed forward from this idle
// time on: half of the timeout, so a few missed sweeps do no harm
const EXTEND_IDLE_FROM_MS = E2B_SANDBOX_TIMEOUT_MS / 2
// a sandbox with activity in this window is in use
const ACTIVE_WINDOW_MS = 2 * 60 * 1000

// a sandbox that has been starting this long is left over from a crashed worker
const STALE_STARTING_MS = 15 * 60 * 1000
// an agent run with no event for this long is treated as gone, so its sandbox can be paused
const STALE_AGENT_RUN_MS = 60 * 60 * 1000
// one activity write per session per interval is enough for a 10 minute idle window
const TOUCH_THROTTLE_MS = 30 * 1000
const lastTouchedAt = new Map<string, number>()

const AGENT_WORKING: Array<'PROVISIONING' | 'RUNNING'> = ['PROVISIONING', 'RUNNING']

export type SandboxToPause = { sessionId: string; vmId: string | null }

type ReserveSandboxSlotInput = {
    userId: string
    sessionId: string
    maxRunning?: number
}

/**
 * Claim a running slot for this session's sandbox. When the user already has the
 * maximum running, the least recently used ones are marked PAUSED here (so another
 * worker does not count them) and returned: the caller pauses them in E2B. Sandboxes
 * whose agent is idle go first.
 */
export const reserveSandboxSlot = async (
    data: ReserveSandboxSlotInput
): Promise<{ toPause: SandboxToPause[] }> => {
    const { userId, sessionId, maxRunning = MAX_RUNNING_SANDBOXES_PER_USER } = data

    return prisma.$transaction(async (tx) => {
        // serializes reservations for one user across workers until the transaction ends
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sandbox-slot:${userId}`}))`

        const live = await tx.session.findMany({
            where: {
                userId,
                id: { not: sessionId },
                OR: [
                    { sandboxStatus: 'RUNNING' },
                    {
                        sandboxStatus: 'STARTING',
                        updatedAt: { gt: new Date(Date.now() - STALE_STARTING_MS) },
                    },
                ],
            },
            select: { id: true, vmId: true, vmStatus: true, sandboxStatus: true },
            orderBy: [{ vmLastActivityAt: { sort: 'asc', nulls: 'first' } }, { updatedAt: 'asc' }],
        })

        const overBy = live.length - maxRunning + 1
        // a sandbox that is still starting cannot be paused; idle agents go before working ones
        const running = live.filter((s) => s.sandboxStatus === 'RUNNING')
        const candidates = [
            ...running.filter((s) => !AGENT_WORKING.includes(s.vmStatus as 'RUNNING')),
            ...running.filter((s) => AGENT_WORKING.includes(s.vmStatus as 'RUNNING')),
        ]
        const victims = overBy > 0 ? candidates.slice(0, overBy) : []

        if (victims.length > 0) {
            await tx.session.updateMany({
                where: { id: { in: victims.map((v) => v.id) }, sandboxStatus: 'RUNNING' },
                data: { sandboxStatus: 'PAUSED' },
            })
        }

        await tx.session.update({
            where: { id: sessionId },
            data: {
                vmStatus: 'PROVISIONING',
                sandboxStatus: 'STARTING',
                vmLastActivityAt: new Date(),
            },
        })

        return { toPause: victims.map((v) => ({ sessionId: v.id, vmId: v.vmId })) }
    })
}

type TouchSandboxActivityInput = {
    sessionId: string
    // skip the per-process throttle (tests, and callers with their own throttle)
    force?: boolean
}

/** Record an agent step, terminal input or preview request on a running sandbox. */
export const touchSandboxActivity = async (data: TouchSandboxActivityInput): Promise<void> => {
    const { sessionId, force = false } = data
    const now = Date.now()
    const last = lastTouchedAt.get(sessionId) ?? 0
    if (!force && now - last < TOUCH_THROTTLE_MS) return
    lastTouchedAt.set(sessionId, now)

    await prisma.session
        .updateMany({
            where: { id: sessionId, sandboxStatus: { in: ['RUNNING', 'STARTING'] } },
            data: { vmLastActivityAt: new Date(now) },
        })
        .catch((err: any) => {
            // a missed touch only means the idle window starts a little earlier
            console.warn('[SandboxLimits] activity touch failed:', err?.message || err)
        })
}

type PauseAfterIdleInput = {
    // the user's setting (User.idleStopMinutes): 10, 30 or 60
    idleStopMinutes: number
    // the agent is provisioning or running (Session.vmStatus)
    agentWorking: boolean
}

/**
 * How long a sandbox may have no activity before it is paused. A working agent (a long
 * tool call sends no events) is left alone until its run looks abandoned.
 */
export const pauseAfterIdleMs = (data: PauseAfterIdleInput): number => {
    const { idleStopMinutes, agentWorking } = data
    const limitMs = (IDLE_STOP_MINUTES as readonly number[]).includes(idleStopMinutes)
        ? idleStopMinutes * 60 * 1000
        : SANDBOX_IDLE_PAUSE_MS
    return agentWorking ? Math.max(limitMs, STALE_AGENT_RUN_MS) : limitMs
}

export type IdleSandboxAction = 'pause' | 'extend' | 'leave'

type DecideIdleSandboxInput = PauseAfterIdleInput & {
    // time since the last agent step, terminal input or preview request
    idleForMs: number
    // a sandbox with activity in this window is in use. default: 2 minutes
    activeWindowMs?: number
}

/**
 * What the sweeper does with one running sandbox (#637):
 * - pause: no activity for longer than the user's idle time
 * - extend: push the E2B timeout forward. For a sandbox in use (preview requests reach E2B
 *   directly), and for an idle one that must outlive the E2B timeout: a 30 or 60 minute
 *   idle time, or a working agent
 * - leave: nothing. The E2B timeout is still far away
 */
export const decideIdleSandbox = (data: DecideIdleSandboxInput): IdleSandboxAction => {
    const { idleStopMinutes, agentWorking, idleForMs, activeWindowMs = ACTIVE_WINDOW_MS } = data
    if (idleForMs > pauseAfterIdleMs({ idleStopMinutes, agentWorking })) return 'pause'
    if (idleForMs <= activeWindowMs) return 'extend'
    // every pause before this point came from the sweeper; from here on E2B could pause first
    if (idleForMs >= EXTEND_IDLE_FROM_MS) return 'extend'
    return 'leave'
}

type IdleSandboxSweeperOptions = {
    pause: (data: SandboxToPause) => Promise<unknown>
    // pushes the E2B timeout of a sandbox forward (see decideIdleSandbox)
    extend?: (data: SandboxToPause) => Promise<unknown>
    intervalMs?: number
}

/**
 * Pauses (never deletes) sandboxes with no activity for the idle time of their user: 10
 * minutes, or 30 or 60 when the user chose that (#637). Safe with many workers.
 */
export class IdleSandboxSweeper {
    private timer: NodeJS.Timeout | null = null
    private isSweeping = false
    private readonly pause: IdleSandboxSweeperOptions['pause']
    private readonly extend: IdleSandboxSweeperOptions['extend']
    private readonly intervalMs: number

    constructor(options: IdleSandboxSweeperOptions) {
        this.pause = options.pause
        this.extend = options.extend
        this.intervalMs = options.intervalMs ?? 60 * 1000
    }

    start(): void {
        if (this.timer) return
        this.timer = setInterval(() => {
            this.sweep().catch((err) => {
                console.error('[IDLE SANDBOX SWEEPER] sweep failed:', err?.message || err)
            })
        }, this.intervalMs)
    }

    stop(): void {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    async sweep(): Promise<number> {
        if (this.isSweeping) return 0
        this.isSweeping = true
        let paused = 0

        try {
            const now = Date.now()
            const activeWindowMs = this.intervalMs * 2
            // the shortest idle time: nothing before it is paused or needs a longer timeout
            const idleSince = new Date(now - SANDBOX_IDLE_PAUSE_MS)
            const sessions = await prisma.session.findMany({
                where: {
                    sandboxStatus: 'RUNNING',
                    OR: [
                        { vmLastActivityAt: { gte: new Date(now - activeWindowMs) } },
                        { vmLastActivityAt: { lt: idleSince } },
                        { vmLastActivityAt: null, updatedAt: { lt: idleSince } },
                    ],
                },
                select: {
                    id: true,
                    vmId: true,
                    vmStatus: true,
                    vmLastActivityAt: true,
                    updatedAt: true,
                    user: { select: { idleStopMinutes: true } },
                },
                // the longest idle first, so the pauses come before the extends
                orderBy: { vmLastActivityAt: { sort: 'asc', nulls: 'first' } },
                take: 1000,
            })

            for (const session of sessions) {
                const agentWorking = AGENT_WORKING.includes(session.vmStatus as 'RUNNING')
                const idleStopMinutes = session.user.idleStopMinutes
                const lastActivityAt = session.vmLastActivityAt ?? session.updatedAt
                const action = decideIdleSandbox({
                    idleStopMinutes,
                    agentWorking,
                    idleForMs: now - lastActivityAt.getTime(),
                    activeWindowMs,
                })

                if (action === 'extend') {
                    if (!this.extend || !session.vmId) continue
                    await this.extend({ sessionId: session.id, vmId: session.vmId }).catch(
                        (err) => {
                            console.warn(
                                `[IDLE SANDBOX SWEEPER] could not extend sandbox for session ${session.id}:`,
                                err?.message || err
                            )
                        }
                    )
                    continue
                }
                if (action !== 'pause') continue

                // claim it: a touch, a new run or another worker in between makes this match nothing
                const cutoff = new Date(now - pauseAfterIdleMs({ idleStopMinutes, agentWorking }))
                const claimed = await prisma.session.updateMany({
                    where: {
                        id: session.id,
                        sandboxStatus: 'RUNNING',
                        vmStatus: session.vmStatus,
                        OR: [
                            { vmLastActivityAt: { lt: cutoff } },
                            { vmLastActivityAt: null, updatedAt: { lt: cutoff } },
                        ],
                    },
                    data: { sandboxStatus: 'PAUSED' },
                })
                if (claimed.count === 0) continue

                if (agentWorking) {
                    // an abandoned run: stop showing it as running
                    await prisma.session.updateMany({
                        where: { id: session.id, vmStatus: { in: AGENT_WORKING } },
                        data: { vmStatus: 'STOPPED', status: 'PARKED' },
                    })
                }

                await this.pause({ sessionId: session.id, vmId: session.vmId }).catch((err) => {
                    console.error(
                        `[IDLE SANDBOX SWEEPER] could not pause sandbox for session ${session.id}:`,
                        err?.message || err
                    )
                })
                paused++
            }
        } finally {
            this.isSweeping = false
        }

        return paused
    }
}
