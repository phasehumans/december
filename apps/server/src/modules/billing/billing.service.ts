import { razorpay } from '../../config/razorpay'
import { AppError } from '../../shared/appError'
import { buildPdf } from '../../shared/pdf'
import { getAdminPath } from '../admin/admin.utils'
import { auditService } from '../audit/audit.service'
import { notificationService } from '../notification/notification.service'

import { billingRepository } from './billing.repository'
import {
    buildReceiptLines,
    FREE_CREDITS_IN_CENTS,
    generateReferralCode,
    getRazorpayKeyId,
    isReceiptPayment,
    normalizeEmail,
    normalizeReferralCode,
    referralEmailKey,
    receiptFileName,
    referralConfig,
    referralLink,
    toUsageDays,
    toPaise,
    toTransactionItem,
    toUsageHours,
    usageDayBuckets,
    usageHourBuckets,
    usageTimezone,
    usdToInrRate,
    verifyRazorpayOrderPayment,
    verifyRazorpayWebhookSignature,
} from './billing.utils'

import type {
    GetOverview,
    CreateRazorpayOrder,
    VerifyRazorpayPayment,
    CreditsHistory,
    ListTransactions,
    HandleRazorpayWebhook,
    RequestFreeCredits,
    GetFreeCreditRequest,
    CreditRequestRecord,
    GetReceipt,
    GetReferral,
    GetLimits,
    SpendLimits,
    UpdateLimits,
    AttachReferral,
    SettleReferral,
    CompletePaidTopUp,
} from './billing.types'

// what the user sees about their request: never the form answers of another account
const toCreditRequestView = (data: CreditRequestRecord) => {
    const { status, createdAt, reviewedAt, rejectReason } = data
    return {
        status,
        createdAt,
        reviewedAt,
        rejectReason: status === 'REJECTED' ? rejectReason : null,
        amountInCents: FREE_CREDITS_IN_CENTS,
    }
}

const getOverview = async (data: GetOverview) => {
    const { userId } = data
    const user = await billingRepository.findUserForOverview(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    return {
        creditBalance: user.creditBalance,
        createdAt: user.createdAt,
        usdToInrRate: usdToInrRate(),
    }
}

/** one page of the payments list on Billing, newest first */
const listTransactions = async (data: ListTransactions) => {
    const { userId, limit, offset } = data
    const [rows, total] = await Promise.all([
        billingRepository.listTransactions({ userId, limit, offset }),
        billingRepository.countTransactions(userId),
    ])
    return { items: rows.map(toTransactionItem), total, limit, offset }
}

const createRazorpayOrder = async (data: CreateRazorpayOrder) => {
    const { userId, amountInCents } = data

    // razorpay requires inr to enable upi and domestic payment options. the order is in
    // paise worked out here: the amount the client sent is only the usd cents to credit
    const rate = usdToInrRate()
    const amountInPaise = toPaise(amountInCents, rate)
    const keyId = getRazorpayKeyId()

    let order: any
    try {
        order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            notes: {
                userId,
                amountInCents: amountInCents.toString(),
            },
        })
    } catch (err: any) {
        console.error('[Razorpay Order Creation Error]:', err)
        const desc =
            err?.error?.description ||
            err?.error?.message ||
            err?.message ||
            'Razorpay order creation failed'

        if (
            err?.statusCode === 401 ||
            (typeof desc === 'string' && desc.toLowerCase().includes('auth'))
        ) {
            throw new AppError(
                'Payment gateway authentication failed. Please verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET credentials.',
                502
            )
        }

        throw new AppError(`Failed to create payment order: ${desc}`, 502)
    }

    await billingRepository.createWalletTransaction({
        userId,
        amountInCents, // we keep the usd cents for the user's wallet credit amount
        currency: 'USD',
        provider: 'RAZORPAY',
        providerOrderId: order.id,
        metadata: {
            amountInPaise,
            usdToInrRate: rate,
        },
    })

    return {
        keyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        usdToInrRate: rate,
    }
}

/**
 * What verify and the webhook both do with an order razorpay says is paid: the credit is
 * added once, the referral is settled, and the first of the two writes the audit line and
 * the notice. `user` is null when the payment was saved by an earlier request.
 */
const completePaidTopUp = async (data: CompletePaidTopUp) => {
    const { transaction, paymentId, source } = data
    const { userId, amountInCents } = transaction

    if (transaction.status === 'SUCCESS') {
        // the payment is saved. this pays a referral credit that an earlier request did not finish
        await settleReferral({ userId, paidInCents: amountInCents })
        return { alreadyProcessed: true, user: null }
    }

    const result = await billingRepository.verifyAndUpdateWalletTransaction(
        transaction.id,
        userId,
        amountInCents,
        paymentId
    )

    // a paid top-up of an invited account pays the referral credits, one time (#638)
    await settleReferral({ userId, paidInCents: amountInCents })

    if (result.alreadyProcessed) return { alreadyProcessed: true, user: result.user }

    const amount = `$${(amountInCents / 100).toFixed(2)}`
    await auditService.recordForUser({ userId, action: 'billing.top_up', target: amount })
    try {
        await notificationService.sendNotificationToUser({
            userId,
            title: 'Credits added',
            message: `${amount} is in your wallet.`,
            type: 'SUCCESS',
            link: '/settings/billing',
        })
    } catch (err) {
        console.error(`Failed to send ${source} notification:`, err)
    }
    // A1: a paid top-up in the admins' inbox (no email). Razorpay mails the user a receipt
    try {
        const contact = await billingRepository.findUserContact(userId)
        await notificationService.sendNotificationToAdmins({
            title: `Top-up: ${amount}`,
            message: `${contact?.email ?? userId} paid ${amount} with Razorpay.`,
            type: 'SUCCESS',
            link: `${getAdminPath()}#users`,
        })
    } catch (err) {
        console.error('[billing] admin top-up notice failed:', err)
    }

    return { alreadyProcessed: false, user: result.user }
}

const verifyRazorpayPayment = async (data: VerifyRazorpayPayment) => {
    const { userId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = data

    const isValid = verifyRazorpayOrderPayment({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
    })

    if (!isValid) {
        throw new AppError('invalid razorpay signature', 400)
    }

    const transaction = await billingRepository.findWalletTransactionByOrderId(razorpay_order_id)
    if (!transaction) {
        console.error(
            '[Razorpay Verify Error]: Transaction not found for orderId:',
            razorpay_order_id
        )
        throw new AppError('transaction order not found', 404)
    }

    if (!transaction.userId || transaction.userId !== userId) {
        throw new AppError('unauthorized to verify this transaction', 403)
    }

    const { alreadyProcessed, user: paidUser } = await completePaidTopUp({
        transaction: { ...transaction, userId: transaction.userId },
        paymentId: razorpay_payment_id,
        source: 'verify',
    })
    const user = paidUser ?? (await billingRepository.findUserByIdForCredits(userId))

    return {
        success: true,
        ...(alreadyProcessed ? { alreadyProcessed: true } : {}),
        newBalance: user?.creditBalance,
    }
}

const getCreditsHistory = async (data: CreditsHistory) => {
    const { userId, limit, offset, periodStart, periodEnd, billingSource, timezone } = data
    const user = await billingRepository.findUserById(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const from = periodStart ? new Date(periodStart) : undefined
    const to = periodEnd ? new Date(periodEnd) : undefined
    const filter = { userId, start: from, end: to, billingSource }

    const where: any = {
        userId,
    }

    if (from || to) {
        where.createdAt = {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
        }
    }

    if (billingSource) {
        where.billingSource = billingSource
    }

    // the chart has a bar for each day of the range, in the time zone of the request or of
    // the user. with no start the range begins when the account was made. with no end it ends now
    const now = new Date()
    const range = {
        start: from ?? user.createdAt ?? to ?? now,
        end: to ?? now,
        timezone: usageTimezone(timezone, user.timezone),
    }
    const dayBuckets = usageDayBuckets(range)
    const firstDay = dayBuckets[0]?.startsAt
    // a long range keeps its latest days: the sum does not read the days before them
    const daysFrom = firstDay && (!from || firstDay > from) ? firstDay : from
    // a range of one day or less also gets a bar for each hour
    const hourBuckets = usageHourBuckets(range)

    // the list is one page. the totals, the days and the hours are for every event of the range
    const [events, total, totals, daySums, hourSums] = await Promise.all([
        billingRepository.findManyUsageEvents(where, offset, limit),
        billingRepository.countUsageEvents(where),
        billingRepository.sumUsage(filter),
        billingRepository.sumUsageByBucket(
            { ...filter, start: daysFrom },
            dayBuckets.map((bucket) => bucket.startsAt)
        ),
        billingRepository.sumUsageByBucket(
            filter,
            (hourBuckets ?? []).map((bucket) => bucket.startsAt)
        ),
    ])

    return {
        events,
        total,
        limit,
        offset,
        totals,
        days: toUsageDays(dayBuckets, daySums),
        ...(hourBuckets ? { hours: toUsageHours(hourBuckets, hourSums) } : {}),
    }
}

const getReceipt = async (data: GetReceipt) => {
    const { userId, transactionId } = data
    const transaction = await billingRepository.findWalletTransactionForReceipt(transactionId)

    // one answer for no transaction, the transaction of another user and a row that is not
    // a payment (pending, failed, free credits, a credit change): an id tells nothing
    if (!transaction?.user || transaction.userId !== userId || !isReceiptPayment(transaction)) {
        throw new AppError('receipt not found', 404)
    }

    const timezone = usageTimezone(transaction.user.timezone)
    // a razorpay charge is in INR: the order saved the amount in paise
    const paise = (transaction.metadata as { amountInPaise?: unknown } | null)?.amountInPaise
    const lines = buildReceiptLines({
        paidAt: transaction.createdAt,
        timezone,
        amountInCents: transaction.amountInCents,
        currency: transaction.currency,
        amountInPaise: typeof paise === 'number' && paise > 0 ? paise : undefined,
        paymentId: transaction.providerPaymentId,
        orderId: transaction.providerOrderId,
        name: transaction.user.name,
        email: transaction.user.email,
    })

    return {
        fileName: receiptFileName({ id: transaction.id, paidAt: transaction.createdAt, timezone }),
        body: buildPdf(lines),
    }
}

const handleRazorpayWebhook = async (data: HandleRazorpayWebhook) => {
    const { rawBody, signature, eventPayload } = data

    const isValid = verifyRazorpayWebhookSignature({
        rawBody,
        signature,
    })

    if (!isValid) {
        throw new AppError('invalid razorpay webhook signature', 400)
    }

    const event = eventPayload?.event
    const paymentEntity = eventPayload?.payload?.payment?.entity
    const orderEntity = eventPayload?.payload?.order?.entity

    if (event === 'payment.captured' || event === 'order.paid') {
        const orderId = paymentEntity?.order_id || orderEntity?.id
        const paymentId = paymentEntity?.id || 'webhook_captured'

        if (!orderId) {
            return { received: true, status: 'ignored_no_order_id' }
        }

        const transaction = await billingRepository.findWalletTransactionByOrderId(orderId)
        if (!transaction) {
            return { received: true, status: 'order_not_found' }
        }
        // the order of an account the 90-day purge deleted: nobody to credit
        if (!transaction.userId) {
            return { received: true, status: 'account_purged' }
        }

        const { alreadyProcessed, user } = await completePaidTopUp({
            transaction: { ...transaction, userId: transaction.userId },
            paymentId,
            source: 'webhook',
        })
        if (alreadyProcessed) {
            return { received: true, status: 'already_processed' }
        }

        return {
            received: true,
            status: 'processed',
            newBalance: user?.creditBalance,
        }
    }

    if (event === 'payment.failed') {
        const orderId = paymentEntity?.order_id
        const paymentId = paymentEntity?.id
        const errorDescription =
            paymentEntity?.error_description || paymentEntity?.error_reason || 'Payment failed'

        if (orderId) {
            const transaction = await billingRepository.findWalletTransactionByOrderId(orderId)
            // only a pending row changes, in one statement: a row paid in the meantime stays paid
            if (
                transaction &&
                (await billingRepository.markWalletTransactionFailed(transaction.id, {
                    providerPaymentId: typeof paymentId === 'string' ? paymentId : undefined,
                    error: String(errorDescription).slice(0, 500),
                }))
            ) {
                return { received: true, status: 'failed_recorded' }
            }
        }
    }

    return { received: true, status: 'ignored' }
}

const requestFreeCredits = async (data: RequestFreeCredits) => {
    const { userId, buildPlan, heardFrom, ipAddress, userAgent } = data
    const user = await billingRepository.findUserContact(userId)
    if (!user) {
        throw new AppError('user not found', 404)
    }

    const normalizedEmail = normalizeEmail(user.email)
    const existing = await billingRepository.findCreditRequestByEmail(normalizedEmail)
    if (existing) {
        throw new AppError(
            existing.status === 'REJECTED'
                ? 'free credits were declined for this email'
                : 'free credits were already requested for this email',
            409
        )
    }

    let created
    try {
        created = await billingRepository.createCreditRequest({
            userId,
            normalizedEmail,
            buildPlan,
            heardFrom,
            agreedToFeedback: true,
            ipAddress,
            userAgent: userAgent?.slice(0, 500),
        })
    } catch (err: any) {
        // two requests at the same time: the unique normalized email lets only one in
        if (err?.code === 'P2002') {
            throw new AppError('free credits were already requested for this email', 409)
        }
        throw err
    }

    // the admins see it in their December inbox (no email), with a link to the Credits tab
    try {
        await notificationService.sendNotificationToAdmins({
            title: 'New free credit request',
            message: `${user.email} asked for free credits. What they will build: ${buildPlan.slice(0, 200)}. How they heard about December: ${heardFrom.slice(0, 100)}`,
            link: `${getAdminPath()}#users/asked`,
        })
    } catch (err) {
        // the request is saved: a failed notice must not answer an error, or a retry gets a 409
        console.error('[billing] admin credit request notice failed:', err)
    }

    return toCreditRequestView(created)
}

const getFreeCreditRequest = async (data: GetFreeCreditRequest) => {
    const { userId } = data
    const user = await billingRepository.findUserContact(userId)
    if (!user) {
        throw new AppError('user not found', 404)
    }
    const request = await billingRepository.findCreditRequestByEmail(normalizeEmail(user.email))
    return request ? toCreditRequestView(request) : null
}

// a code is random, so two users can get the same one: then a new one is made
const REFERRAL_CODE_TRIES = 5

const getReferral = async (data: GetReferral) => {
    const { userId } = data
    const user = await billingRepository.findReferralCode(userId)
    if (!user) {
        throw new AppError('user not found', 404)
    }

    // the code is made on the first read. the save only fills an empty code, so reads that
    // come together end with the same one
    let code = user.referralCode
    for (let attempt = 0; !code && attempt < REFERRAL_CODE_TRIES; attempt++) {
        try {
            await billingRepository.setReferralCodeIfEmpty(userId, generateReferralCode())
        } catch (err: any) {
            if (err?.code !== 'P2002') throw err
            // another user has this code: the next turn makes a new one
            continue
        }
        code = (await billingRepository.findReferralCode(userId))?.referralCode ?? null
    }
    if (!code) {
        throw new AppError('the invite link is not ready, try again', 500)
    }

    const { invited, credited } = await billingRepository.countReferrals(userId)
    const { amountInCents, minTopUpInCents, maxCredited } = referralConfig()

    return {
        code,
        link: referralLink(code),
        amountInCents,
        minTopUpInCents,
        invited,
        credited,
        maxCredited,
    }
}

/**
 * Called by the three sign-up paths for a new account only. It makes a pending referral
 * when the code belongs to another person. It never throws: a sign-up does not fail for a
 * code that is wrong, unknown or the user's own.
 */
const attachReferral = async (data: AttachReferral) => {
    const { inviteeId, inviteeEmail, code } = data
    const referralCode = normalizeReferralCode(code)
    if (!referralCode) return null

    try {
        const inviter = await billingRepository.findUserByReferralCode(referralCode)
        if (!inviter || inviter.isDeleted || inviter.deletedAt) return null
        // no self referral: the same account, or the inviter's own email written another way
        if (
            inviter.id === inviteeId ||
            referralEmailKey(inviter.email) === referralEmailKey(inviteeEmail)
        ) {
            return null
        }
        return await billingRepository.createReferral({ inviterId: inviter.id, inviteeId })
    } catch (err: any) {
        // P2002: the account has a referral already, and it keeps that one
        if (err?.code !== 'P2002') {
            console.error('[Referral] could not save the referral of a new account:', err)
        }
        return null
    }
}

/**
 * Called after a paid top-up (razorpay verify or webhook), never for a grant, a redeem code
 * or a credit change. The first paid top-up of an invited account that reaches
 * REFERRAL_MIN_TOPUP_CENTS pays both sides once. It
 * never throws: the payment is saved already and must not fail for a referral.
 */
const settleReferral = async (data: SettleReferral) => {
    const { userId, paidInCents } = data
    const { amountInCents, minTopUpInCents, maxCredited } = referralConfig()
    // an amount of zero turns referral credits off. the referral stays pending
    if (amountInCents <= 0) return null
    // a top-up under the minimum pays nothing: the referral waits for one that reaches it
    if (paidInCents < minTopUpInCents) return null

    let payout
    try {
        payout = await billingRepository.payReferral({
            inviteeId: userId,
            amountInCents,
            maxCredited,
        })
    } catch (err) {
        // the referral stays pending: the next paid top-up of the account tries again
        console.error('[Referral] could not pay the referral credit:', err)
        return null
    }
    if (!payout || payout.status !== 'CREDITED') return payout

    const amount = `$${(amountInCents / 100).toFixed(2)}`
    const messages = [
        {
            receiverId: payout.inviterId,
            message: `A friend you invited paid for credits. ${amount} was added to your balance.`,
        },
        {
            receiverId: payout.inviteeId,
            message: `You signed up with an invite link. ${amount} was added to your balance.`,
        },
    ]
    for (const { receiverId, message } of messages) {
        try {
            await notificationService.sendNotificationToUser({
                userId: receiverId,
                title: 'Referral credit',
                message,
                type: 'SUCCESS',
            })
        } catch (err) {
            console.error('Failed to send referral notification:', err)
        }
    }

    return payout
}

// spend limits and the low balance alert (#638 section 1)
const getLimits = async (data: GetLimits): Promise<SpendLimits> => {
    const { userId } = data
    const limits = await billingRepository.findLimits(userId)
    if (!limits) throw new AppError('user not found', 404)
    return limits
}

// only the amounts that were sent change. null turns one off
const updateLimits = async (data: UpdateLimits): Promise<SpendLimits> => {
    const { userId, lowBalanceAlertCents, sessionLimitCents, dayLimitCents } = data
    const changes = {
        ...(lowBalanceAlertCents !== undefined ? { lowBalanceAlertCents } : {}),
        ...(sessionLimitCents !== undefined ? { sessionLimitCents } : {}),
        ...(dayLimitCents !== undefined ? { dayLimitCents } : {}),
    }
    const saved = await billingRepository.updateLimits(userId, changes)
    // a change of the limits is a billing change in the audit log (review C9)
    await auditService.recordForUser({
        userId,
        action: 'billing.limits_changed',
        target: Object.keys(changes).join(', '),
        metadata: changes,
    })
    return saved
}

export const billingService = {
    getLimits,
    updateLimits,
    getReferral,
    attachReferral,
    requestFreeCredits,
    getFreeCreditRequest,
    getOverview,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getCreditsHistory,
    listTransactions,
    getReceipt,
    handleRazorpayWebhook,
}
