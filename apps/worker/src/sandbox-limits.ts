import { prisma } from '@december/database'

// #624 part 4: running sandboxes are counted per user in the database (Session.sandboxStatus),
// so the limit holds with any number of workers. paused sandboxes do not count.
export const MAX_RUNNING_SANDBOXES_PER_USER = 10
export const SANDBOX_IDLE_PAUSE_MS = 10 * 60 * 1000

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

type IdleSandboxSweeperOptions = {
    pause: (data: SandboxToPause) => Promise<unknown>
    // pushes the E2B timeout of a sandbox that is in use forward (preview, terminal, agent)
    extend?: (data: SandboxToPause) => Promise<unknown>
    intervalMs?: number
    idleMs?: number
}

/** Pauses (never deletes) sandboxes with no activity for 10 minutes. Safe with many workers. */
export class IdleSandboxSweeper {
    private timer: NodeJS.Timeout | null = null
    private isSweeping = false
    private readonly pause: IdleSandboxSweeperOptions['pause']
    private readonly extend: IdleSandboxSweeperOptions['extend']
    private readonly intervalMs: number
    private readonly idleMs: number

    constructor(options: IdleSandboxSweeperOptions) {
        this.pause = options.pause
        this.extend = options.extend
        this.intervalMs = options.intervalMs ?? 60 * 1000
        this.idleMs = options.idleMs ?? SANDBOX_IDLE_PAUSE_MS
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
            const cutoff = new Date(now - this.idleMs)
            const staleRun = new Date(now - STALE_AGENT_RUN_MS)
            const idleWhere = {
                sandboxStatus: 'RUNNING' as const,
                AND: [
                    {
                        OR: [
                            { vmLastActivityAt: { lt: cutoff } },
                            { vmLastActivityAt: null, updatedAt: { lt: cutoff } },
                        ],
                    },
                    // a working agent (a long tool call sends no events) is left alone,
                    // unless its run looks abandoned
                    {
                        OR: [
                            { vmStatus: { notIn: AGENT_WORKING } },
                            { vmLastActivityAt: { lt: staleRun } },
                            { vmLastActivityAt: null, updatedAt: { lt: staleRun } },
                        ],
                    },
                ],
            }
            const idle = await prisma.session.findMany({
                where: idleWhere,
                select: { id: true, vmId: true, vmStatus: true },
                orderBy: { vmLastActivityAt: { sort: 'asc', nulls: 'first' } },
                take: 50,
            })

            for (const session of idle) {
                // claim it: a touch or another worker in between makes this match nothing
                const claimed = await prisma.session.updateMany({
                    where: { id: session.id, ...idleWhere },
                    data: { sandboxStatus: 'PAUSED' },
                })
                if (claimed.count === 0) continue

                if (AGENT_WORKING.includes(session.vmStatus as 'RUNNING')) {
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

            if (this.extend) {
                await this.extendActive(now)
            }
        } finally {
            this.isSweeping = false
        }

        return paused
    }

    // preview requests reach E2B directly, so a sandbox in use gets its E2B timeout pushed
    // forward here; otherwise E2B would pause it at the timeout
    private async extendActive(now: number): Promise<void> {
        const active = await prisma.session.findMany({
            where: {
                sandboxStatus: 'RUNNING',
                vmId: { not: null },
                vmLastActivityAt: { gte: new Date(now - this.intervalMs * 2) },
            },
            select: { id: true, vmId: true },
            take: 500,
        })
        for (const session of active) {
            await this.extend!({ sessionId: session.id, vmId: session.vmId }).catch((err) => {
                console.warn(
                    `[IDLE SANDBOX SWEEPER] could not extend sandbox for session ${session.id}:`,
                    err?.message || err
                )
            })
        }
    }
}
