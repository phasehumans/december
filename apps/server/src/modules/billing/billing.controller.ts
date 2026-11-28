import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    creditsHistoryQuerySchema,
    creditRequestSchema,
    receiptParamsSchema,
    transactionsQuerySchema,
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

const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature']

    if (typeof signature !== 'string' || !signature) {
        throw new AppError('missing razorpay webhook signature', 400)
    }

    // the signature is of the bytes razorpay sent: express.json keeps them on rawBody. a
    // body that was not json has no raw bytes, and its signature cannot match
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody
    if (!Buffer.isBuffer(rawBody)) {
        throw new AppError('invalid razorpay webhook signature', 400)
    }

    const result = await billingService.handleRazorpayWebhook({
        rawBody,
        signature,
        eventPayload: req.body,
    })

    return sendSuccess(res, 'webhook processed successfully', result)
})

const listTransactions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const { limit, offset } = transactionsQuerySchema.parse(req.query)
    const result = await billingService.listTransactions({ userId, limit, offset })
    return sendSuccess(res, 'transactions fetched successfully', result)
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
    listTransactions,
    getReceipt,
    handleRazorpayWebhook,
}
