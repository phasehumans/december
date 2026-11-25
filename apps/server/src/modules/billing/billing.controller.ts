import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    creditsHistoryQuerySchema,
    creditRequestSchema,
    receiptParamsSchema,
    redeemCodeSchema,
    createRazorpayOrderSchema,
    verifyRazorpayPaymentSchema,
    updateLimitsSchema,
} from './billing.schema'
import { billingService } from './billing.service'

import type { Request, Response } from 'express'

const getOverview = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await billingService.getOverview({ userId })
    return sendSuccess(res, 'billing overview fetched successfully', result)
})

const createRazorpayOrder = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = createRazorpayOrderSchema.parse(req.body)

    const result = await billingService.createRazorpayOrder({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'razorpay order created successfully', result, 201)
})

const verifyRazorpayPayment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = verifyRazorpayPaymentSchema.parse(req.body)

    const result = await billingService.verifyRazorpayPayment({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'payment verified successfully', result)
})

const getCreditsHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedQuery = creditsHistoryQuerySchema.parse(req.query)
    const limit = parsedQuery.limit
    const offset = parsedQuery.offset

    const result = await billingService.getCreditsHistory({
        userId,
        limit,
        offset,
        periodStart: parsedQuery.periodStart,
        periodEnd: parsedQuery.periodEnd,
        billingSource: parsedQuery.billingSource,
        timezone: parsedQuery.timezone,
    })
    return sendSuccess(res, 'credits history fetched successfully', result)
})

// the answer is the pdf file itself, not json
const getReceipt = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { id } = receiptParamsSchema.parse(req.params)

    const { body, fileName } = await billingService.getReceipt({ userId, transactionId: id })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).send(body)
})

const redeemCode = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = redeemCodeSchema.parse(req.body)

    const result = await billingService.redeemCode({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'code redeemed successfully', result)
})

const addCredits = asyncHandler(async (req: Request, res: Response) => {
    // Manual credit additions without payment gateway verification are disabled in public APIs.
    throw new AppError('Direct credit addition is disabled. Please use payment checkout.', 403)
})

const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined

    if (!signature) {
        throw new AppError('missing razorpay webhook signature', 400)
    }

    const rawBody = (req as any).rawBody
        ? (req as any).rawBody
        : Buffer.isBuffer(req.body)
          ? req.body
          : typeof req.body === 'string'
            ? req.body
            : JSON.stringify(req.body)

    const eventPayload =
        typeof req.body === 'object' && !Buffer.isBuffer(req.body)
            ? req.body
            : JSON.parse(rawBody.toString('utf8'))

    const result = await billingService.handleRazorpayWebhook({
        rawBody,
        signature,
        eventPayload,
    })

    return sendSuccess(res, 'webhook processed successfully', result)
})

const requestFreeCredits = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = creditRequestSchema.parse(req.body)
    const result = await billingService.requestFreeCredits({
        userId,
        buildPlan: parsedBody.buildPlan,
        heardFrom: parsedBody.heardFrom,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') ?? undefined,
    })
    return sendSuccess(res, 'free credits requested', result, 201)
})

const getFreeCreditRequest = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await billingService.getFreeCreditRequest({ userId })
    return sendSuccess(res, 'free credit request fetched', result)
})

const getReferral = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await billingService.getReferral({ userId })
    return sendSuccess(res, 'referral fetched successfully', result)
})

const getLimits = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await billingService.getLimits({ userId })
    return sendSuccess(res, 'limits fetched successfully', result)
})

const updateLimits = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = updateLimitsSchema.parse(req.body)
    const result = await billingService.updateLimits({ userId, ...parsedBody })
    return sendSuccess(res, 'limits updated successfully', result)
})

export const billingController = {
    getLimits,
    updateLimits,
    getReferral,
    requestFreeCredits,
    getFreeCreditRequest,
    getOverview,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getCreditsHistory,
    getReceipt,
    redeemCode,
    addCredits,
    handleRazorpayWebhook,
}
