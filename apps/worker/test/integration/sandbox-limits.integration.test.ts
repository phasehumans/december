import { createPrismaClient, prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { E2BSandboxService } from '../../src/e2b-sandbox.service'
import {
    IdleSandboxSweeper,
    MAX_RUNNING_SANDBOXES_PER_USER,
    reserveSandboxSlot,
    SANDBOX_IDLE_PAUSE_MS,
    touchSandboxActivity,
} from '../../src/sandbox-limits'

const stamp = Date.now()
let userId: string

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60 * 1000)

// a sandbox that is up while its agent is idle (the turn ended)
const createRunning = async (
    lastActivity: Date,
    label: string,
    agent: 'STOPPED' | 'RUNNING' = 'STOPPED'
) =>
    prisma.session.create({
        data: {
            userId,
            title: label,
            vmId: `vm-${label}-${stamp}`,
            vmStatus: agent,
            sandboxStatus: 'RUNNING',
            vmLastActivityAt: lastActivity,
        },
    })

const runningCount = () =>
    prisma.session.count({ where: { userId, sandboxStatus: { in: ['RUNNING', 'STARTING'] } } })

const sandboxOf = async (id: string) =>
    (await prisma.session.findUnique({ where: { id } }))?.sandboxStatus

const clearSessions = () => prisma.session.deleteMany({ where: { userId } })

const recordingSweeper = () => {
    const paused: string[] = []
    const extended: string[] = []
    const sweeper = new IdleSandboxSweeper({
        pause: async ({ sessionId }) => {
            paused.push(sessionId)
        },
        extend: async ({ sessionId }) => {
            extended.push(sessionId)
        },
    })
    return { sweeper, paused, extended }
}

// other files in this run replace prisma.session / prisma.user methods with mocks and do not
// all put them back. this suite needs the real database, so it binds a fresh client's methods.
const fresh = createPrismaClient()
const useRealDelegates = () => {
    for (const model of ['session', 'user'] as const) {
        const delegate = (fresh as any)[model]
        for (const method of Object.getOwnPropertyNames(delegate)) {
            if (typeof delegate[method] === 'function') {
                ;(prisma as any)[model][method] = delegate[method].bind(delegate)
            }
        }
    }
}

describe('sandbox limits (#624 part 4)', () => {
    beforeAll(async () => {
        useRealDelegates()
        const user = await prisma.user.create({
            data: { name: 'Sandbox Limit User', email: `sandbox-limits-${stamp}@example.com` },
        })
        userId = user.id
    })

    afterAll(async () => {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {
            // Intentionally swallowed: test cleanup fallback
        })
        await fresh.$disconnect()
    })

    it('allows 10 running sandboxes per user', () => {
        expect(MAX_RUNNING_SANDBOXES_PER_USER).toBe(10)
        expect(SANDBOX_IDLE_PAUSE_MS).toBe(10 * 60 * 1000)
    })

    it('an 11th sandbox pauses the least recently used one', async () => {
        await clearSessions()
        const oldest = await createRunning(minutesAgo(9), 'oldest')
        for (let i = 0; i < 9; i++) {
            await createRunning(minutesAgo(i), `recent-${i}`)
        }
        const next = await prisma.session.create({ data: { userId, title: 'eleventh' } })

        const { toPause } = await reserveSandboxSlot({ userId, sessionId: next.id })

        expect(toPause).toEqual([{ sessionId: oldest.id, vmId: oldest.vmId }])
        expect(await sandboxOf(oldest.id)).toBe('PAUSED')
        const reserved = await prisma.session.findUnique({ where: { id: next.id } })
        expect(reserved?.sandboxStatus).toBe('STARTING')
        expect(reserved?.vmStatus).toBe('PROVISIONING')
        expect(reserved?.vmLastActivityAt).not.toBeNull()
    })

    it('pauses a sandbox with an idle agent before one whose agent is working', async () => {
        await clearSessions()
        const working = await createRunning(minutesAgo(30), 'working', 'RUNNING')
        const idle = await createRunning(minutesAgo(8), 'idle')
        for (let i = 0; i < 8; i++) {
            await createRunning(minutesAgo(i), `recent-${i}`)
        }
        const next = await prisma.session.create({ data: { userId, title: 'new' } })

        const { toPause } = await reserveSandboxSlot({ userId, sessionId: next.id })

        expect(toPause.map((s) => s.sessionId)).toEqual([idle.id])
        expect(await sandboxOf(working.id)).toBe('RUNNING')
    })

    it('does not pause anything under the limit, and paused sandboxes do not count', async () => {
        await clearSessions()
        for (let i = 0; i < 9; i++) {
            await createRunning(minutesAgo(i), `run-${i}`)
        }
        await prisma.session.create({
            data: { userId, title: 'paused', vmId: `vm-paused-${stamp}`, sandboxStatus: 'PAUSED' },
        })
        const next = await prisma.session.create({ data: { userId, title: 'tenth' } })

        const { toPause } = await reserveSandboxSlot({ userId, sessionId: next.id })

        expect(toPause).toEqual([])
    })

    it('keeps the limit when two workers start sandboxes at the same time', async () => {
        await clearSessions()
        for (let i = 0; i < 9; i++) {
            await createRunning(minutesAgo(20 - i), `busy-${i}`)
        }
        const a = await prisma.session.create({ data: { userId, title: 'worker-a' } })
        const b = await prisma.session.create({ data: { userId, title: 'worker-b' } })

        const results = await Promise.all([
            reserveSandboxSlot({ userId, sessionId: a.id }),
            reserveSandboxSlot({ userId, sessionId: b.id }),
        ])

        // 9 running + 2 new = 11, so exactly one older sandbox is paused
        expect(results.flatMap((r) => r.toPause)).toHaveLength(1)
        expect(await runningCount()).toBe(10)
    })

    it('the sweeper pauses sandboxes idle for 10 minutes', async () => {
        await clearSessions()
        const idle = await createRunning(minutesAgo(11), 'idle')
        const active = await createRunning(minutesAgo(2), 'active')
        const { sweeper, paused } = recordingSweeper()

        await sweeper.sweep()

        expect(paused).toContain(idle.id)
        expect(paused).not.toContain(active.id)
        expect(await sandboxOf(idle.id)).toBe('PAUSED')
        expect(await runningCount()).toBe(1)
    })

    it('the sweeper leaves a working agent alone, but pauses an abandoned run', async () => {
        await clearSessions()
        const longToolCall = await createRunning(minutesAgo(15), 'long-tool', 'RUNNING')
        const abandoned = await createRunning(minutesAgo(90), 'abandoned', 'RUNNING')
        const { sweeper, paused } = recordingSweeper()

        await sweeper.sweep()

        expect(paused).not.toContain(longToolCall.id)
        expect(paused).toContain(abandoned.id)
        const after = await prisma.session.findUnique({ where: { id: abandoned.id } })
        expect(after?.vmStatus).toBe('STOPPED')
    })

    it('activity (agent step, terminal input or preview request) keeps a sandbox running', async () => {
        await clearSessions()
        const previewed = await createRunning(minutesAgo(30), 'previewed')

        await touchSandboxActivity({ sessionId: previewed.id, force: true })

        const { sweeper, paused, extended } = recordingSweeper()
        await sweeper.sweep()
        expect(paused).not.toContain(previewed.id)
        // its E2B timeout is pushed forward too, since preview traffic goes to E2B directly
        expect(extended).toContain(previewed.id)
    })

    it('the sweeper uses the idle time of each user (#637)', async () => {
        await clearSessions()
        await prisma.user.update({ where: { id: userId }, data: { idleStopMinutes: 30 } })
        const idle11 = await createRunning(minutesAgo(11), 'idle-11')
        const idle20 = await createRunning(minutesAgo(20), 'idle-20')
        const idle31 = await createRunning(minutesAgo(31), 'idle-31')
        const { sweeper, paused, extended } = recordingSweeper()

        await sweeper.sweep()
        await prisma.user.update({ where: { id: userId }, data: { idleStopMinutes: 10 } })

        expect(paused).toEqual([idle31.id])
        // idle past the middle of the E2B timeout: the timeout is pushed forward
        expect(extended).toEqual([idle20.id])
        expect(await sandboxOf(idle11.id)).toBe('RUNNING')
        expect(await sandboxOf(idle20.id)).toBe('RUNNING')
        expect(await sandboxOf(idle31.id)).toBe('PAUSED')
    })

    it('a paused session resumes its own sandbox on the next prompt', async () => {
        await clearSessions()
        const session = await prisma.session.create({
            data: {
                userId,
                title: 'paused',
                vmId: `vm-resume-${stamp}`,
                vmStatus: 'STOPPED',
                sandboxStatus: 'PAUSED',
            },
        })
        const resumed: string[] = []
        E2BSandboxService.setMockClient({
            resume: async ({ snapshotId }: any) => {
                resumed.push(snapshotId)
                return { sandboxId: snapshotId }
            },
            create: async () => {
                throw new Error('a paused session must not get a new sandbox')
            },
        })

        const result = await E2BSandboxService.acquireSessionSandbox({
            sessionId: session.id,
            userId,
        })

        expect(resumed).toEqual([`vm-resume-${stamp}`])
        expect(result.sandboxId).toBe(`vm-resume-${stamp}`)
        expect(await sandboxOf(session.id)).toBe('RUNNING')
        E2BSandboxService.resetMockClient()
    })

    it('a worker still holding a sandbox that another worker paused resumes it', async () => {
        await clearSessions()
        const session = await prisma.session.create({ data: { userId, title: 'held' } })
        const resumed: string[] = []
        E2BSandboxService.setMockClient({
            create: async () => ({ sandboxId: `vm-held-${stamp}` }),
            resume: async ({ snapshotId }: any) => {
                resumed.push(snapshotId)
                return { sandboxId: snapshotId }
            },
        })
        await E2BSandboxService.acquireSessionSandbox({ sessionId: session.id, userId })
        // the sweeper on another worker pauses it by id
        await prisma.session.update({
            where: { id: session.id },
            data: { sandboxStatus: 'PAUSED', vmStatus: 'STOPPED' },
        })

        await E2BSandboxService.acquireSessionSandbox({ sessionId: session.id, userId })

        expect(resumed).toEqual([`vm-held-${stamp}`])
        E2BSandboxService.resetMockClient()
    })

    it('saves when the sandbox started: at a new sandbox and at a resume, not at a reuse', async () => {
        await clearSessions()
        const session = await prisma.session.create({
            data: { userId, title: 'started-at', createdAt: new Date('2026-11-01T08:00:00Z') },
        })
        const startedAt = async () =>
            (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).sandboxStartedAt
        E2BSandboxService.setMockClient({
            create: async () => ({ sandboxId: `vm-started-${stamp}` }),
            resume: async ({ snapshotId }: any) => ({ sandboxId: snapshotId }),
        })
        expect(await startedAt()).toBe(null)

        const before = Date.now()
        await E2BSandboxService.acquireSessionSandbox({ sessionId: session.id, userId })
        const first = await startedAt()
        expect(first!.getTime()).toBeGreaterThanOrEqual(before)

        // the next prompt uses the sandbox that runs: the same start
        await E2BSandboxService.acquireSessionSandbox({ sessionId: session.id, userId })
        expect(await startedAt()).toEqual(first)

        // paused and resumed: a new start
        await prisma.session.update({
            where: { id: session.id },
            data: { sandboxStatus: 'PAUSED', vmStatus: 'STOPPED' },
        })
        await new Promise((resolve) => setTimeout(resolve, 5))
        await E2BSandboxService.acquireSessionSandbox({ sessionId: session.id, userId })
        expect((await startedAt())!.getTime()).toBeGreaterThan(first!.getTime())
        E2BSandboxService.resetMockClient()
    })

    it('pauses the least recently used sandbox even when another worker started it', async () => {
        await clearSessions()
        const oldest = await createRunning(minutesAgo(15), 'other-worker')
        for (let i = 0; i < 9; i++) {
            await createRunning(minutesAgo(i), `mine-${i}`)
        }
        const next = await prisma.session.create({ data: { userId, title: 'new' } })
        const pausedById: string[] = []
        E2BSandboxService.setMockClient({
            pauseById: async (sandboxId: string) => {
                pausedById.push(sandboxId)
            },
            create: async () => ({ sandboxId: `vm-new-${stamp}` }),
        })

        await E2BSandboxService.acquireSessionSandbox({ sessionId: next.id, userId })

        expect(pausedById).toEqual([oldest.vmId as string])
        expect(await runningCount()).toBe(10)
        E2BSandboxService.resetMockClient()
    })
})
