import { prisma } from '@december/database'
import { afterAll, describe, expect, it } from 'bun:test'

import { chargeRunUsage } from '../../src/listener'
import { checkRunSpend, spendLimitEvent, toHeldRun } from '../../src/spend-limits'

import type { SpendLimitStore } from '../../src/spend-limits'

/** the reads of the check, as values. `reads` lists what was asked */
const fakeStore = (
    values: {
        sessionLimitCents?: number | null
        dayLimitCents?: number | null
        timezone?: string
        dayLimitAllowanceDay?: string | null
        dayLimitAllowanceCents?: number
        sessionAllowance?: number
        sessionSpent?: number
        daySpent?: number
    } = {}
) => {
    const reads: string[] = []
    const since: Date[] = []
    const store: SpendLimitStore = {
        findUser: async () => {
            reads.push('user')
            return {
                timezone: values.timezone ?? 'UTC',
                sessionLimitCents: values.sessionLimitCents ?? null,
                dayLimitCents: values.dayLimitCents ?? null,
                dayLimitAllowanceDay: values.dayLimitAllowanceDay ?? null,
                dayLimitAllowanceCents: values.dayLimitAllowanceCents ?? 0,
            }
        },
        findSessionAllowance: async () => {
            reads.push('allowance')
            return values.sessionAllowance ?? 0
        },
        sumSessionCredits: async () => {
            reads.push('session-sum')
            return values.sessionSpent ?? 0
        },
        sumUserCreditsSince: async (_userId, from) => {
            reads.push('day-sum')
            since.push(from)
            return values.daySpent ?? 0
        },
    }
    return { store, reads, since }
}

const run = { userId: 'user-1', sessionId: 'session-1', billingSource: 'CREDITS' as const }

// #638: the worker's check after a charge and before a run starts
describe('spend limits: the check of a run', () => {
    it('a run on the own key of the user is never checked', async () => {
        const { store, reads } = fakeStore({ sessionLimitCents: 500, sessionSpent: 9000 })
        expect(await checkRunSpend({ ...run, billingSource: 'OWN_KEY', store })).toBe(null)
        expect(reads).toEqual([])
    })

    it('reads no sum when both limits are off', async () => {
        const { store, reads } = fakeStore({ sessionSpent: 9000, daySpent: 9000 })
        expect(await checkRunSpend({ ...run, store })).toBe(null)
        expect(reads).toEqual(['user'])
    })

    it('is null while the session is under its limit', async () => {
        const { store } = fakeStore({ sessionLimitCents: 500, sessionSpent: 499 })
        expect(await checkRunSpend({ ...run, store })).toBe(null)
    })

    it('names the session limit when the cost of the session reaches it', async () => {
        const { store } = fakeStore({ sessionLimitCents: 500, sessionSpent: 503 })
        expect(await checkRunSpend({ ...run, store })).toEqual({ kind: 'session', limitCents: 500 })
    })

    it('a "continue" lets the session run for the same amount again', async () => {
        const continued = { sessionLimitCents: 500, sessionAllowance: 503 }
        expect(
            await checkRunSpend({
                ...run,
                store: fakeStore({ ...continued, sessionSpent: 1002 }).store,
            })
        ).toBe(null)
        expect(
            await checkRunSpend({
                ...run,
                store: fakeStore({ ...continued, sessionSpent: 1003 }).store,
            })
        ).toEqual({ kind: 'session', limitCents: 500 })
    })

    it('names the day limit, with the sum from midnight in the time zone of the user', async () => {
        const { store, since } = fakeStore({
            dayLimitCents: 2000,
            daySpent: 2000,
            timezone: 'Asia/Kolkata',
        })
        const reached = await checkRunSpend({
            ...run,
            store,
            now: new Date('2026-11-25T20:00:00Z'),
        })
        expect(reached).toEqual({ kind: 'day', limitCents: 2000 })
        expect(since.map((from) => from.toISOString())).toEqual(['2026-11-25T18:30:00.000Z'])
    })

    it('the allowance of a "continue" counts only on its day', async () => {
        const now = new Date('2026-11-25T12:00:00Z')
        const values = { dayLimitCents: 2000, daySpent: 2500, dayLimitAllowanceCents: 2100 }
        const today = fakeStore({ ...values, dayLimitAllowanceDay: '2026-11-25' })
        const dayBefore = fakeStore({ ...values, dayLimitAllowanceDay: '2026-11-24' })
        expect(await checkRunSpend({ ...run, store: today.store, now })).toBe(null)
        expect(await checkRunSpend({ ...run, store: dayBefore.store, now })).toEqual({
            kind: 'day',
            limitCents: 2000,
        })
    })

    it('the event for the server carries the kind and the amount', () => {
        expect(spendLimitEvent({ kind: 'day', limitCents: 2000 })).toEqual({
            type: 'SpendLimitReached',
            kind: 'day',
            limitCents: 2000,
        })
    })

    it('a held run is saved with no secrets and no token', () => {
        expect(
            toHeldRun({
                sessionId: 'session-1',
                prompt: 'add a dark mode',
                secrets: [{ key: 'API_KEY', value: 'secret' }],
                gitToken: 'token',
                skills: ['design'],
            })
        ).toEqual({ sessionId: 'session-1', prompt: 'add a dark mode', skills: ['design'] })
    })
})

// the charge of one model call (AgentUsage), against the test database
describe('spend limits: the charge of a run', () => {
    const stamp = Date.now()
    const userIds: string[] = []
    let count = 0

    const runOf = async (user: {
        creditBalance: number
        sessionLimitCents?: number
        dayLimitCents?: number
        lowBalanceAlertCents?: number | null
        lowBalanceAlertedAt?: Date
    }) => {
        count += 1
        const created = await prisma.user.create({
            data: {
                email: `worker-spend-${count}-${stamp}@example.com`,
                name: 'Spend',
                ...user,
            },
        })
        userIds.push(created.id)
        const session = await prisma.session.create({
            data: { userId: created.id, title: 'Run' },
        })
        const sent: Array<Record<string, unknown>> = []
        const publish = async (_sessionId: string, event: Record<string, unknown>) => {
            sent.push(event)
        }
        return { userId: created.id, sessionId: session.id, sent, publish }
    }
    // the cost of a call depends on the rates of the model: it is read back from the saved event
    const usage = {
        type: 'AgentUsage',
        model: 'gemini-3.6-flash',
        promptTokens: 200000,
        completionTokens: 50000,
    }
    const costOf = async (sessionId: string) =>
        (await prisma.usageEvent.findMany({ where: { sessionId } })).reduce(
            (sum, event) => sum + event.costInCents,
            0
        )

    afterAll(async () => {
        await prisma.usageEvent.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.user.deleteMany({ where: { id: { in: userIds } } })
    })

    it('sends SpendLimitReached when the charge takes the session to its limit', async () => {
        const first = await runOf({ creditBalance: 5000 })
        await chargeRunUsage(first.sessionId, usage, 'CREDITS', first.publish)
        const cost = await costOf(first.sessionId)
        expect(cost).toBeGreaterThan(0)
        // no limit: nothing is sent
        expect(first.sent).toEqual([])

        // a limit of $1: charges until the cost of the session is over it
        const limited = await runOf({ creditBalance: 5000, sessionLimitCents: 100 })
        const calls = Math.ceil(100 / cost)
        for (let call = 1; call < calls; call += 1) {
            await chargeRunUsage(limited.sessionId, usage, 'CREDITS', limited.publish)
        }
        expect(limited.sent).toEqual([])
        await chargeRunUsage(limited.sessionId, usage, 'CREDITS', limited.publish)
        expect(limited.sent).toEqual([
            { type: 'SpendLimitReached', kind: 'session', limitCents: 100 },
        ])
    })

    it('a run on the own key is not charged and never reaches a limit', async () => {
        const own = await runOf({ creditBalance: 5000, sessionLimitCents: 100, dayLimitCents: 100 })
        for (let call = 0; call < 200; call += 1) {
            await chargeRunUsage(own.sessionId, usage, 'OWN_KEY', own.publish)
            if ((await costOf(own.sessionId)) > 300) break
        }
        expect(await costOf(own.sessionId)).toBeGreaterThan(100)
        expect(own.sent).toEqual([])
        const user = await prisma.user.findUniqueOrThrow({ where: { id: own.userId } })
        expect(user.creditBalance).toBe(5000)
    })

    it('sends CreditsLow for the charge that takes the balance under the amount of the user', async () => {
        const low = await runOf({
            creditBalance: 300,
            lowBalanceAlertCents: 300,
            // the mark of an older drop, before a top-up
            lowBalanceAlertedAt: new Date('2026-11-01T00:00:00Z'),
        })
        await chargeRunUsage(low.sessionId, usage, 'CREDITS', low.publish)
        const user = await prisma.user.findUniqueOrThrow({ where: { id: low.userId } })
        expect(user.creditBalance).toBeLessThan(300)
        expect(low.sent).toEqual([{ type: 'CreditsLow', balanceInCents: user.creditBalance }])
        // the mark is cleared, so the server sends the alert of this drop
        expect(user.lowBalanceAlertedAt).toBe(null)

        // the next charge is the same drop
        await chargeRunUsage(low.sessionId, usage, 'CREDITS', low.publish)
        expect(low.sent).toHaveLength(1)
    })

    it('sends no CreditsLow when the user turned the alert off', async () => {
        const off = await runOf({ creditBalance: 100, lowBalanceAlertCents: null })
        await chargeRunUsage(off.sessionId, usage, 'CREDITS', off.publish)
        expect(off.sent).toEqual([])
    })
})
