/**
 * Spend limits in the worker (#638): after each charge of a run on December credits, and
 * before a run starts, the worker asks the one decision (checkSpendLimits in
 * @december/shared). When a limit is reached it sends `SpendLimitReached`; the server then
 * stops the run with reason `limit` and asks the user "Reached $5. Continue?".
 *
 * Runs on the user's own key are never counted and never asked.
 */
import { Prisma, prisma } from '@december/database'
import {
    checkSpendLimits,
    dayAllowanceFor,
    spendDay,
    spendLimitKind,
    startOfSpendDay,
} from '@december/shared'

import type { BillingSource } from './llm-source'
import type { SpendLimitKind } from '@december/shared'

/** the reads of the check. the worker passes prisma queries, a test passes values */
export interface SpendLimitStore {
    findUser: (userId: string) => Promise<{
        timezone: string | null
        sessionLimitCents: number | null
        dayLimitCents: number | null
        dayLimitAllowanceDay: string | null
        dayLimitAllowanceCents: number | null
    } | null>
    findSessionAllowance: (sessionId: string) => Promise<number>
    /** the cost on December credits only: of one session, or of the user since an instant */
    sumSessionCredits: (sessionId: string) => Promise<number>
    sumUserCreditsSince: (userId: string, since: Date) => Promise<number>
}

const sumCredits = async (where: { sessionId?: string; userId?: string; since?: Date }) => {
    const aggregate = await prisma.usageEvent.aggregate({
        where: {
            // runs on the user's own key never count
            billingSource: 'CREDITS',
            ...(where.sessionId ? { sessionId: where.sessionId } : {}),
            ...(where.userId ? { userId: where.userId } : {}),
            ...(where.since ? { createdAt: { gte: where.since } } : {}),
        },
        _sum: { costInCents: true },
    })
    return aggregate._sum.costInCents ?? 0
}

export const prismaSpendLimitStore: SpendLimitStore = {
    findUser: (userId) =>
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                timezone: true,
                sessionLimitCents: true,
                dayLimitCents: true,
                dayLimitAllowanceDay: true,
                dayLimitAllowanceCents: true,
            },
        }),
    findSessionAllowance: async (sessionId) =>
        (
            await prisma.session.findUnique({
                where: { id: sessionId },
                select: { limitAllowanceCents: true },
            })
        )?.limitAllowanceCents ?? 0,
    sumSessionCredits: (sessionId) => sumCredits({ sessionId }),
    sumUserCreditsSince: (userId, since) => sumCredits({ userId, since }),
}

export interface CheckRunSpend {
    userId: string | null | undefined
    sessionId: string
    billingSource: BillingSource
    store: SpendLimitStore
    now?: Date
}

export interface SpendLimitReached {
    kind: SpendLimitKind
    limitCents: number
}

/** the limit this run has reached, or null. reads a sum only for a limit that is on */
export const checkRunSpend = async (data: CheckRunSpend): Promise<SpendLimitReached | null> => {
    const { userId, sessionId, billingSource, store, now = new Date() } = data
    if (billingSource !== 'CREDITS' || !userId) return null

    const user = await store.findUser(userId)
    if (!user) return null
    const { sessionLimitCents, dayLimitCents } = user
    if (sessionLimitCents === null && dayLimitCents === null) return null

    const timezone = user.timezone || 'UTC'
    const [sessionSpentCents, sessionAllowanceCents, daySpentCents] = await Promise.all([
        sessionLimitCents !== null ? store.sumSessionCredits(sessionId) : 0,
        sessionLimitCents !== null ? store.findSessionAllowance(sessionId) : 0,
        dayLimitCents !== null
            ? store.sumUserCreditsSince(userId, startOfSpendDay(now, timezone))
            : 0,
    ])

    const kind = spendLimitKind(
        checkSpendLimits({
            sessionLimitCents,
            dayLimitCents,
            sessionSpentCents,
            sessionAllowanceCents,
            daySpentCents,
            dayAllowanceCents: dayAllowanceFor({
                day: spendDay(now, timezone),
                allowanceDay: user.dayLimitAllowanceDay,
                allowanceCents: user.dayLimitAllowanceCents,
            }),
        })
    )
    if (!kind) return null
    return { kind, limitCents: (kind === 'session' ? sessionLimitCents : dayLimitCents) as number }
}

/** the part of the prisma client that clearStaleHeldRun uses */
export interface HeldRunDb {
    session: { updateMany: (args: any) => Promise<unknown> }
}

/**
 * A run starts: a held run that no question asks about is left over (the server did not
 * ask). Nothing would continue it, and it must not start with the answer to a later
 * question. A held run with an open question stays.
 */
export const clearStaleHeldRun = async (data: { db: HeldRunDb; sessionId: string }) => {
    const { db, sessionId } = data
    await db.session.updateMany({
        where: { id: sessionId, limitQuestionKind: null, limitHeldRun: { not: Prisma.DbNull } },
        data: { limitHeldRun: Prisma.DbNull },
    })
}

/** the event the server pauses a session on (sessionService.handleRunEvent) */
export const spendLimitEvent = (reached: SpendLimitReached) => ({
    type: 'SpendLimitReached',
    kind: reached.kind,
    limitCents: reached.limitCents,
})

/**
 * A run that is held before it starts waits on the session row for "Continue". It is saved
 * with no secrets and no tokens: the server reads the secrets again when it queues the run.
 */
export const toHeldRun = (jobData: Record<string, unknown>): Record<string, unknown> => {
    const { secrets: _secrets, gitToken: _gitToken, ...held } = jobData
    return held
}
