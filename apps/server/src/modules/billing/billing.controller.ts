import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    cancelSubscriptionSchema,
    createSubscriptionSchema,
    creditsHistoryQuerySchema,
    verifySubscriptionSchema,
    redeemCodeSchema,
    addCreditsSchema,
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

const getPlans = asyncHandler(async (req: Request, res: Response) => {
    const result = await billingService.getPlans()
    return sendSuccess(res, 'billing plans fetched successfully', result)
})

const createSubscription = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = createSubscriptionSchema.parse(req.body)

    const result = await billingService.createSubscription({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'subscription order created successfully', result, 201)
})

const verifySubscription = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = verifySubscriptionSchema.parse(req.body)

    const result = await billingService.verifySubscription({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'subscription verified successfully', result)
})

const cancelSubscription = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = cancelSubscriptionSchema.parse(req.body)

    const result = await billingService.cancelSubscription({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'subscription cancellation processed', result)
})

const getCreditsHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedQuery = creditsHistoryQuerySchema.parse(req.query)
    const limit = parsedQuery.limit ? parseInt(parsedQuery.limit, 10) : 10
    const offset = parsedQuery.offset ? parseInt(parsedQuery.offset, 10) : 0

    const result = await billingService.getCreditsHistory({
        userId,
        limit,
        offset,
        periodStart: parsedQuery.periodStart,
        periodEnd: parsedQuery.periodEnd,
    })
    return sendSuccess(res, 'credits history fetched successfully', result)
})

const createPortalSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await billingService.createPortalSession({ userId })
    return sendSuccess(res, 'customer portal session created successfully', result)
})

const handleRazorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string | undefined

    if (!signature) {
        throw new AppError('razorpay signature header missing', 400)
    }

    const result = await billingService.handleRazorpayWebhook({
        body: req.body,
        rawBody: req.rawBody,
        signature,
    })

    return sendSuccess(res, 'webhook processed successfully', result)
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
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const parsedBody = addCreditsSchema.parse(req.body)

    const result = await billingService.addCredits({
        userId,
        ...parsedBody,
    })
    return sendSuccess(res, 'credits added successfully', result)
})

export const billingController = {
    getOverview,
    getPlans,
    createSubscription,
    verifySubscription,
    cancelSubscription,
    getCreditsHistory,
    createPortalSession,
    handleRazorpayWebhook,
    redeemCode,
    addCredits,
}
