import {
    checkSpendLimits,
    crossedLowCreditsAmount,
    dayAllowanceFor,
    spendDay,
    spendLimitKind,
    startOfSpendDay,
} from '@december/shared'
import { publishEvent } from '@december/shared/queue'

import { AppError } from '../../shared/appError'
import { notificationService } from '../notification/notification.service'

import { resolveModelRate } from './usage.rates'
import { usageRepository } from './usage.repository'

import type {
    AlertIfCreditsLow,
    CheckLimitsAfterCharge,
    ContinuePastLimit,
    GetSpendLimitState,
    SpendLimitCheck,
    GetCurrentUsage,
    CheckEnoughCredits,
    HasMinimumBalance,
    RecordUsageEvent,
    RecordDailyUsage,
    CalculateGenerationCost,
    CanRunSelfCorrection,
    UsageUser,
    MarkNewLowBalanceDrop,
} from './usage.types'

const calculateGenerationCost = (data: CalculateGenerationCost): number => {
    const { modelName, inputTokens, outputTokens } = data
    if (inputTokens === 0 && outputTokens === 0) {
        return 0
    }

    let targetModel = modelName
    if (targetModel === 'auto') {
        targetModel = (
            process.env.DEFAULT_MODEL ||
            process.env.AUTO_MODEL ||
            'openai/gpt-oss-20b:free'
        ).trim()
    }

    const rate = resolveModelRate(targetModel)

    // convert usd per 1m tokens to cents per token:
    // cents/token = (usd/1m * 100) / 1,000,000 = usd/1m / 10,000
    const inputCentsPerToken = rate.inputRate / 10000
    const outputCentsPerToken = rate.outputRate / 10000

    const rawCost = inputTokens * inputCentsPerToken + outputTokens * outputCentsPerToken

    if (rawCost <= 0) {
        return 0
    }

    // Exact sub-cent precision rounded to 6 decimal places (micro-cent resolution)
    return Math.round(rawCost * 1_000_000) / 1_000_000
}

const startOfUtcMonth = (date: Date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

const startOfNextUtcMonth = (date: Date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

const resolveCurrentPeriod = (user: UsageUser, now = new Date()) => {
    return {
        periodStart: startOfUtcMonth(now),
        periodEnd: startOfNextUtcMonth(now),
    }
}

const getUsageUser = async (userId: string): Promise<UsageUser> => {
    const user = await usageRepository.getUsageUser({ userId })

    if (!user) {
        throw new AppError('user not found', 404)
    }

    return user as unknown as UsageUser
}

const getPeriodAggregate = async (userId: string, periodStart: Date, periodEnd: Date) => {
    return usageRepository.getPeriodAggregate({ userId, periodStart, periodEnd })
}

const getCurrentUsage = async (data: GetCurrentUsage) => {
    const { userId } = data
    const user = await getUsageUser(userId)
    const { periodStart, periodEnd } = resolveCurrentPeriod(user)
    const usage = await getPeriodAggregate(user.id, periodStart, periodEnd)

    const remainingCreditsInCents = user.creditBalance

    return {
        periodStart,
        periodEnd,
        usage,
        credits: {
            limitInCents: null,
            usedInCents: usage.costInCents,
            remainingInCents: remainingCreditsInCents,
            unlimited: false,
        },
    }
}

const checkEnoughCredits = async (data: CheckEnoughCredits) => {
    const current = await getCurrentUsage({ userId: data.userId })
    const estimatedCostInCents = data.estimatedCostInCents ?? 0
    const enoughCredits =
        current.credits.unlimited || (current.credits.remainingInCents ?? 0) >= estimatedCostInCents

    return {
        enoughCredits,
        estimatedCostInCents,
        credits: current.credits,
        periodStart: current.periodStart,
        periodEnd: current.periodEnd,
    }
}

const hasMinimumBalance = async (data: HasMinimumBalance): Promise<boolean> => {
    const { userId, minBalanceInCents = 1 } = data
    const user = await getUsageUser(userId)
    return user.creditBalance >= minBalanceInCents
}

const findExternalUsageEvent = (externalRequestId: string) => {
    return usageRepository.findExternalUsageEvent({ externalRequestId })
}

/**
 * A charge on the server took the balance under the alert amount: tell the user (#636).
 * The worker does the same for a run charge, with the same rule (crossedLowCreditsAmount)
 * and the same claim (notifyLowCredits), so one drop gives one alert.
 */
const alertIfCreditsLow = async (data: AlertIfCreditsLow) => {
    const { userId, balanceBefore, balanceAfter, alertCents } = data
    if (!crossedLowCreditsAmount({ balanceBefore, balanceAfter, alertCents })) return
    try {
        await notificationService.notifyLowCredits({ userId, balanceInCents: balanceAfter })
    } catch (error) {
        // the charge is saved: a missed alert must not fail the request that was charged
        console.error('[Usage] could not send the low credits alert:', error)
    }
}

/**
 * Inside the charge: a charge that takes the balance under the amount starts a new drop, so
 * the "already alerted" mark of the drop before it (before a top-up) is cleared (#638).
 */
const markNewLowBalanceDrop = async (data: MarkNewLowBalanceDrop) => {
    const { userId, balanceBefore, balanceAfter, alertCents, tx } = data
    if (!crossedLowCreditsAmount({ balanceBefore, balanceAfter, alertCents })) return
    await usageRepository.clearLowBalanceAlerted({ userId }, tx)
}

/**
 * Spend limits (#638): the user's limits against the cost on credits so far. The session
 * part is checked only with a session. Own-key cost is never in the sums.
 */
const getSpendLimitState = async (data: GetSpendLimitState): Promise<SpendLimitCheck> => {
    const { userId, sessionId, now = new Date() } = data
    const user = await usageRepository.findSpendLimitUser({ userId })
    const timezone = user?.timezone || 'UTC'
    const day = spendDay(now, timezone)
    const sessionLimitCents = sessionId ? (user?.sessionLimitCents ?? null) : null
    const dayLimitCents = user?.dayLimitCents ?? null

    // a sum is read only for a limit that is on
    const [session, sessionSpentCents, daySpentCents] = await Promise.all([
        sessionId && sessionLimitCents !== null
            ? usageRepository.findSessionLimitAllowance({ sessionId, userId })
            : null,
        sessionId && sessionLimitCents !== null
            ? usageRepository.sumCreditsCost({ userId, sessionId })
            : 0,
        dayLimitCents !== null
            ? usageRepository.sumCreditsCost({ userId, since: startOfSpendDay(now, timezone) })
            : 0,
    ])

    const decision = checkSpendLimits({
        sessionLimitCents,
        dayLimitCents,
        sessionSpentCents,
        sessionAllowanceCents: session?.limitAllowanceCents ?? 0,
        daySpentCents,
        dayAllowanceCents: dayAllowanceFor({
            day,
            allowanceDay: user?.dayLimitAllowanceDay,
            allowanceCents: user?.dayLimitAllowanceCents,
        }),
    })
    const kind = spendLimitKind(decision)
    return {
        decision,
        kind,
        limitCents: kind === 'session' ? sessionLimitCents : kind === 'day' ? dayLimitCents : null,
        sessionSpentCents,
        daySpentCents,
        day,
    }
}

/**
 * "Continue" at a limit: the cost so far is let through, so the session (or the day) can
 * use the same amount again. Nothing changes when that limit is not reached now, so two
 * sessions that continue on the same day do not add two amounts.
 */
const continuePastLimit = async (data: ContinuePastLimit) => {
    const { userId, sessionId, kind, now } = data
    const state = await getSpendLimitState({ userId, sessionId, now })

    if (kind === 'session' && state.decision === 'pause-session') {
        await usageRepository.setSessionLimitAllowance({
            sessionId,
            allowanceCents: state.sessionSpentCents,
        })
        return { raised: true }
    }
    if (kind === 'day') {
        // the session limit is asked first, so look at the day on its own
        const day = await getSpendLimitState({ userId, now })
        if (day.decision === 'pause-day') {
            await usageRepository.setDayLimitAllowance({
                userId,
                day: day.day,
                allowanceCents: day.daySpentCents,
            })
            return { raised: true }
        }
    }
    return { raised: false }
}

/**
 * A charge on the server for a session: when it reaches a limit, the server gets the same
 * event as from the worker's run charge (socket.ts hands it to sessionService.handleRunEvent).
 */
const checkLimitsAfterCharge = async (data: CheckLimitsAfterCharge) => {
    const { userId, sessionId } = data
    if (!sessionId) return
    try {
        const state = await getSpendLimitState({ userId, sessionId })
        if (!state.kind) return
        await publishEvent(`session_events:${sessionId}`, {
            type: 'SpendLimitReached',
            kind: state.kind,
        })
    } catch (error) {
        // the charge is saved: a failed check must not fail the request that was charged
        console.error('[Usage] could not check the spend limits:', error)
    }
}

const recordUsageEvent = async (data: RecordUsageEvent) => {
    const {
        userId,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        sessionId,
        chatId,
        externalRequestId,
        metadata,
    } = data
    const user = await getUsageUser(userId)

    if (externalRequestId) {
        const existingEvent = await findExternalUsageEvent(externalRequestId)

        if (existingEvent) {
            if (existingEvent.userId !== user.id) {
                throw new AppError('external request id already exists', 409)
            }

            return {
                event: existingEvent,
                idempotent: true,
            }
        }
    }

    const { periodStart, periodEnd } = resolveCurrentPeriod(user)
    const calculatedCost = calculateGenerationCost({
        modelName: model,
        inputTokens,
        outputTokens,
    })

    try {
        const result = await usageRepository.runTransaction(async (tx) => {
            const costLogged = calculatedCost

            // re-fetch user inside transaction to avoid race conditions
            const dbUser = await usageRepository.findUserCredits({ userId: user.id }, tx)
            if (!dbUser) {
                throw new AppError('user not found', 404)
            }

            // allow soft overdraft / negative balance
            const newCreditBalance = dbUser.creditBalance - calculatedCost

            // update user balance
            await usageRepository.updateUserCredits(
                {
                    userId: user.id,
                    creditBalance: newCreditBalance,
                },
                tx
            )

            // create usage event
            const event = await usageRepository.createUsageEvent(
                {
                    userId: user.id,
                    model,
                    inputTokens,
                    outputTokens,
                    totalTokens,
                    costInCents: costLogged,
                    sessionId,
                    chatId,
                    externalRequestId,
                    periodStart,
                    periodEnd,
                    metadata,
                },
                tx
            )

            const alertCents = dbUser.lowBalanceAlertCents
            await markNewLowBalanceDrop({
                userId: user.id,
                balanceBefore: dbUser.creditBalance,
                balanceAfter: newCreditBalance,
                alertCents,
                tx,
            })

            return {
                event,
                balanceBefore: dbUser.creditBalance,
                balanceAfter: newCreditBalance,
                alertCents,
            }
        })

        await alertIfCreditsLow({
            userId: user.id,
            balanceBefore: result.balanceBefore,
            balanceAfter: result.balanceAfter,
            alertCents: result.alertCents,
        })
        await checkLimitsAfterCharge({ userId: user.id, sessionId })

        return {
            event: result.event,
            idempotent: false,
        }
    } catch (error: any) {
        if (error?.code === 'P2002' && externalRequestId) {
            const existingEvent = await findExternalUsageEvent(externalRequestId)

            if (existingEvent && existingEvent.userId === user.id) {
                return {
                    event: existingEvent,
                    idempotent: true,
                }
            }
        }

        throw error
    }
}

const canRunSelfCorrection = async (data: CanRunSelfCorrection): Promise<boolean> => {
    const { userId } = data
    try {
        const user = await usageRepository.findUserCredits({ userId })
        if (!user) return false

        const threshold = parseInt(process.env.SELF_CORRECTION_CREDIT_THRESHOLD || '5', 10) // default 5 cents
        return user.creditBalance >= threshold
    } catch {
        // Intentionally swallowed: fallback to false if user not found or error occurred
        return false
    }
}

/**
 * Charges a small, frequent call (like AI search filters) and adds it to one usage
 * event per user per UTC day, so the Usage page shows a daily total, not every call.
 */
const recordDailyUsage = async (data: RecordDailyUsage) => {
    const { userId, model, inputTokens, outputTokens, kind } = data
    const user = await getUsageUser(userId)
    const { periodStart, periodEnd } = resolveCurrentPeriod(user)
    const day = new Date().toISOString().slice(0, 10)
    const externalRequestId = `${kind}:${user.id}:${day}`
    const totalTokens = inputTokens + outputTokens
    const costInCents = calculateGenerationCost({ modelName: model, inputTokens, outputTokens })

    const result = await usageRepository.runTransaction(async (tx) => {
        // locks the user row, so two calls on the same day cannot both create the daily event
        const dbUser = await usageRepository.findUserCredits({ userId: user.id }, tx)
        if (!dbUser) {
            throw new AppError('user not found', 404)
        }
        const balanceBefore = dbUser.creditBalance
        const balanceAfter = balanceBefore - costInCents
        await usageRepository.updateUserCredits(
            { userId: user.id, creditBalance: balanceAfter },
            tx
        )

        const existing = await usageRepository.findExternalUsageEvent({ externalRequestId }, tx)
        const event = existing
            ? await usageRepository.addToUsageEvent(
                  {
                      id: existing.id,
                      inputTokens,
                      outputTokens,
                      totalTokens,
                      costInCents,
                      metadata: {
                          ...(existing.metadata as object),
                          type: kind,
                          calls: Number((existing.metadata as any)?.calls ?? 1) + 1,
                      },
                  },
                  tx
              )
            : await usageRepository.createUsageEvent(
                  {
                      userId: user.id,
                      model,
                      inputTokens,
                      outputTokens,
                      totalTokens,
                      costInCents,
                      externalRequestId,
                      periodStart,
                      periodEnd,
                      metadata: { type: kind, calls: 1 },
                  },
                  tx
              )
        const alertCents = dbUser.lowBalanceAlertCents
        await markNewLowBalanceDrop({
            userId: user.id,
            balanceBefore,
            balanceAfter,
            alertCents,
            tx,
        })
        return { event, balanceBefore, balanceAfter, alertCents }
    })

    await alertIfCreditsLow({
        userId: user.id,
        balanceBefore: result.balanceBefore,
        balanceAfter: result.balanceAfter,
        alertCents: result.alertCents,
    })

    return result.event
}

export const usageService = {
    getSpendLimitState,
    continuePastLimit,
    getCurrentUsage,
    checkEnoughCredits,
    hasMinimumBalance,
    recordUsageEvent,
    recordDailyUsage,
    calculateGenerationCost,
    canRunSelfCorrection,
}
