import crypto from 'crypto'
import { razorpay } from '../../config/razorpay'
import { AppError } from '../../shared/appError'
import { sendNotificationToUser } from '../notification/notification.service'

import { billingRepository } from './billing.repository'
import {
    getRazorpayKeyId,
    verifyRazorpayOrderPayment,
    verifyCoinbaseWebhookSignature,
} from './billing.utils'

import type {
    GetOverview,
    CreateRazorpayOrder,
    VerifyRazorpayPayment,
    CreateCryptoOrder,
    CoinbaseWebhook,
    CreditsHistory,
    RedeemCode,
    AddCredits,
} from './billing.types'

const getOverview = async (data: GetOverview) => {
    const { userId } = data
    const user = await billingRepository.findUserForOverview(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const periodStart = user.createdAt
    const periodEnd = new Date()
    const aggregate = await billingRepository.aggregateUsage(userId, periodStart, periodEnd)
    const usedInCents = aggregate._sum.costInCents ?? 0

    return {
        creditBalance: user.creditBalance,
        giftedCredits: 0,
        createdAt: user.createdAt,
        usage: {
            inputTokens: aggregate._sum.inputTokens ?? 0,
            outputTokens: aggregate._sum.outputTokens ?? 0,
            totalTokens: aggregate._sum.totalTokens ?? 0,
            costInCents: usedInCents,
        },
        claims: ((user as any).redeemClaims || []).map((claim: any) => ({
            id: claim.id,
            createdAt: claim.redeemedAt,
            amountInCents: claim.redeemCode.creditAmount,
            code: (claim.redeemCode.metadata as any)?.code || 'GIFT',
        })),
        transactions: ((user as any).walletTransactions || []).map((tx: any) => ({
            id: tx.id,
            createdAt: tx.createdAt,
            amountInCents: tx.amountInCents,
            currency: tx.currency,
            provider: tx.provider,
            status: tx.status,
        })),
    }
}

const createRazorpayOrder = async (data: CreateRazorpayOrder) => {
    const { userId, amountInCents } = data

    // Razorpay requires INR to enable UPI and domestic payment options.
    // Convert USD cents to INR paise using a rate of 84 (1 USD = 84 INR).
    const USD_TO_INR_RATE = 84
    const amountInPaise = amountInCents * USD_TO_INR_RATE

    const order = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        notes: {
            userId,
            amountInCents: amountInCents.toString(),
        },
    })

    await billingRepository.createWalletTransaction({
        userId,
        amountInCents, // We keep the USD cents for the user's wallet credit amount
        currency: 'INR',
        provider: 'RAZORPAY',
        providerOrderId: order.id,
    })

    return {
        keyId: getRazorpayKeyId(),
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
    }
}

const verifyRazorpayPayment = async (data: VerifyRazorpayPayment) => {
    const { userId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = data

    console.log('[Razorpay Verification Service Call]:', {
        userId,
        razorpay_order_id,
        razorpay_payment_id,
    })

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

    if (transaction.status === 'SUCCESS') {
        return { success: true, alreadyProcessed: true }
    }

    await billingRepository.updateWalletTransaction(transaction.id, {
        status: 'SUCCESS',
        providerPaymentId: razorpay_payment_id,
    })

    const updatedUser = await billingRepository.addCredits(userId, transaction.amountInCents)

    try {
        await sendNotificationToUser({
            userId,
            title: 'Credits Added',
            message: `Successfully added $${(transaction.amountInCents / 100).toFixed(2)} to your wallet!`,
            type: 'SUCCESS',
        })
    } catch (err) {
        console.error('Failed to send notification:', err)
    }

    return {
        success: true,
        newBalance: updatedUser.creditBalance,
    }
}

const createCryptoOrder = async (data: CreateCryptoOrder) => {
    const { userId, amountInCents, currency = 'USD' } = data

    const apiKey = process.env.COINBASE_API_KEY
    if (!apiKey) {
        throw new AppError('Coinbase Commerce API Key not configured', 500)
    }

    const response = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CC-Api-Key': apiKey,
            'X-CC-Version': '2018-03-22',
        },
        body: JSON.stringify({
            name: 'Wallet Credits',
            description: `Purchase of $${(amountInCents / 100).toFixed(2)} wallet credits`,
            pricing_type: 'fixed_price',
            local_price: {
                amount: (amountInCents / 100).toFixed(2),
                currency,
            },
            metadata: {
                userId,
                amountInCents: amountInCents.toString(),
            },
            redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?status=success`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?status=cancel`,
        }),
    })

    if (!response.ok) {
        const errText = await response.text()
        console.error('Coinbase API error:', errText)
        throw new AppError('failed to create crypto charge', 500)
    }

    const resData = (await response.json()) as any
    const charge = resData.data

    await billingRepository.createWalletTransaction({
        userId,
        amountInCents,
        currency,
        provider: 'COINBASE',
        providerOrderId: charge.id,
        metadata: {
            hostedUrl: charge.hosted_url,
        },
    })

    return {
        chargeId: charge.id,
        hostedUrl: charge.hosted_url,
        amount: amountInCents,
        currency,
    }
}

const handleCoinbaseWebhook = async (data: CoinbaseWebhook & { rawBody?: Buffer }) => {
    const { body, rawBody, signature } = data

    const payload = rawBody ? rawBody : Buffer.from(JSON.stringify(body))
    const isValid = verifyCoinbaseWebhookSignature({
        rawBody: payload,
        signature,
    })

    if (!isValid) {
        throw new AppError('invalid coinbase webhook signature', 400)
    }

    const eventType = body.event?.type
    const charge = body.event?.data

    if (!eventType || !charge?.id) {
        return { processed: false, reason: 'invalid payload structure' }
    }

    const chargeId = charge.id
    const transaction = await billingRepository.findWalletTransactionByOrderId(chargeId)

    if (!transaction) {
        return { processed: false, reason: 'transaction not found' }
    }

    if (eventType === 'charge:confirmed' || eventType === 'charge:resolved') {
        if (transaction.status === 'SUCCESS') {
            return { processed: true, alreadyProcessed: true }
        }

        await billingRepository.updateWalletTransaction(transaction.id, {
            status: 'SUCCESS',
            metadata: {
                ...((transaction.metadata as Record<string, any>) || {}),
                coinbaseEvent: body.event,
            },
        })

        const updatedUser = await billingRepository.addCredits(
            transaction.userId,
            transaction.amountInCents
        )

        try {
            await sendNotificationToUser({
                userId: transaction.userId,
                title: 'Credits Added via Crypto',
                message: `Successfully credited $${(transaction.amountInCents / 100).toFixed(2)} to your wallet!`,
                type: 'SUCCESS',
            })
        } catch (err) {
            console.error('Failed to send notification:', err)
        }

        return { processed: true, newBalance: updatedUser.creditBalance }
    }

    if (eventType === 'charge:failed') {
        await billingRepository.updateWalletTransaction(transaction.id, {
            status: 'FAILED',
            metadata: {
                ...((transaction.metadata as Record<string, any>) || {}),
                coinbaseEvent: body.event,
            },
        })
        return { processed: true, status: 'FAILED' }
    }

    return { processed: false, reason: `unhandled event type: ${eventType}` }
}

const getCreditsHistory = async (data: CreditsHistory) => {
    const { userId, limit, offset, periodStart, periodEnd } = data
    const user = await billingRepository.findUserById(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const where: any = {
        userId,
    }

    if (periodStart && periodEnd) {
        where.createdAt = {
            gte: new Date(periodStart),
            lte: new Date(periodEnd),
        }
    } else if (periodStart) {
        where.createdAt = {
            gte: new Date(periodStart),
        }
    } else if (periodEnd) {
        where.createdAt = {
            lte: new Date(periodEnd),
        }
    }

    const [events, total] = await Promise.all([
        billingRepository.findManyUsageEvents(where, offset, limit),
        billingRepository.countUsageEvents(where),
    ])

    const periods = new Map<string, { periodStart: Date; periodEnd: Date; costInCents: number }>()

    for (const event of events) {
        const key = event.periodStart.toISOString()
        const period = periods.get(key) ?? {
            periodStart: event.periodStart,
            periodEnd: event.periodEnd,
            costInCents: 0,
        }

        period.costInCents += event.costInCents
        periods.set(key, period)
    }

    return {
        events,
        total,
        limit,
        offset,
        periods: Array.from(periods.values()),
    }
}

const redeemCode = async (data: RedeemCode) => {
    const { userId, code } = data

    const normalizedCode = code.trim().toUpperCase()
    if (!normalizedCode) {
        throw new AppError('redeem code cannot be empty', 400)
    }

    const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex')

    const result = await billingRepository.redeemCode({ userId, codeHash })

    try {
        await sendNotificationToUser({
            userId,
            title: 'Code Redeemed Successfully',
            message: `Successfully claimed $${(result.creditAmount / 100).toFixed(2)} in gifted credits!`,
            type: 'SUCCESS',
        })
    } catch (err) {
        console.error('Failed to send redemption notification:', err)
    }

    return result
}

const addCredits = async (data: AddCredits) => {
    const { userId, amountInCents, paymentMethod } = data

    const user = await billingRepository.findUserByIdForCredits(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await billingRepository.addCredits(userId, amountInCents)

    try {
        await sendNotificationToUser({
            userId,
            title: 'Credits Added Successfully',
            message: `Successfully purchased $${(amountInCents / 100).toFixed(2)} in credits using ${paymentMethod.toUpperCase()}!`,
            type: 'SUCCESS',
        })
    } catch (err) {
        console.error('Failed to send purchase notification:', err)
    }

    return {
        amountInCents,
        newBalance: updatedUser.creditBalance,
    }
}

export const billingService = {
    getOverview,
    createRazorpayOrder,
    verifyRazorpayPayment,
    createCryptoOrder,
    handleCoinbaseWebhook,
    getCreditsHistory,
    redeemCode,
    addCredits,
}
