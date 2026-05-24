import { AppError } from '../../utils/appError'

import { billingService } from './billing.service'
import {
    cancelSubscriptionSchema,
    createSubscriptionSchema,
    creditsHistoryQuerySchema,
    verifySubscriptionSchema,
} from './billing.schema'

import type { Request, Response } from 'express'

type HandlerMessage =
    | 'billing overview fetched successfully'
    | 'billing plans fetched successfully'
    | 'billing subscription created successfully'
    | 'billing subscription verified successfully'
    | 'billing subscription canceled successfully'
    | 'billing credits history fetched successfully'
    | 'billing portal created successfully'
    | 'razorpay webhook processed successfully'

const getUserId = (req: Request) => req.user?.userId as string | undefined

const respondError = (res: Response, message: string, error: any) => {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({
            success: false,
            message,
            errors: error.message,
        })
    }

    return res.status(500).json({
        success: false,
        message,
        errors: error.message,
    })
}

const respondSuccess = (res: Response, status: number, message: HandlerMessage, data: unknown) => {
    return res.status(status).json({
        success: true,
        message,
        data,
    })
}

const getOverview = async (req: Request, res: Response) => {
    const userId = getUserId(req)

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await billingService.getOverview(userId)
        return respondSuccess(res, 200, 'billing overview fetched successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to fetch billing overview', error)
    }
}

const getPlans = async (_req: Request, res: Response) => {
    try {
        const result = await billingService.getPlans()
        return respondSuccess(res, 200, 'billing plans fetched successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to fetch billing plans', error)
    }
}

const createSubscription = async (req: Request, res: Response) => {
    const userId = getUserId(req)

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const parsedBody = createSubscriptionSchema.safeParse(req.body)

    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parsedBody.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await billingService.createSubscription({
            userId,
            ...parsedBody.data,
        })
        return respondSuccess(res, 201, 'billing subscription created successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to create billing subscription', error)
    }
}

const verifySubscription = async (req: Request, res: Response) => {
    const userId = getUserId(req)

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const parsedBody = verifySubscriptionSchema.safeParse(req.body)

    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parsedBody.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await billingService.verifySubscription({
            userId,
            ...parsedBody.data,
        })
        return respondSuccess(res, 200, 'billing subscription verified successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to verify billing subscription', error)
    }
}

const cancelSubscription = async (req: Request, res: Response) => {
    const userId = getUserId(req)

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const parsedBody = cancelSubscriptionSchema.safeParse(req.body ?? {})

    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parsedBody.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await billingService.cancelSubscription({
            userId,
            ...parsedBody.data,
        })
        return respondSuccess(res, 200, 'billing subscription canceled successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to cancel billing subscription', error)
    }
}

const getCreditsHistory = async (req: Request, res: Response) => {
    const userId = getUserId(req)

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const parsedQuery = creditsHistoryQuerySchema.safeParse(req.query)

    if (!parsedQuery.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parsedQuery.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await billingService.getCreditsHistory({
            userId,
            ...parsedQuery.data,
        })
        return respondSuccess(res, 200, 'billing credits history fetched successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to fetch billing credits history', error)
    }
}

const createPortalSession = async (req: Request, res: Response) => {
    const userId = getUserId(req)

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await billingService.createPortalSession(userId)
        return respondSuccess(res, 200, 'billing portal created successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to create billing portal', error)
    }
}

const handleRazorpayWebhook = async (req: Request, res: Response) => {
    try {
        const result = await billingService.handleRazorpayWebhook({
            body: req.body,
            rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
            signature: req.headers['x-razorpay-signature']?.toString(),
        })
        return respondSuccess(res, 200, 'razorpay webhook processed successfully', result)
    } catch (error: any) {
        return respondError(res, 'failed to process razorpay webhook', error)
    }
}

export const billingController = {
    getOverview,
    getPlans,
    createSubscription,
    verifySubscription,
    cancelSubscription,
    getCreditsHistory,
    createPortalSession,
    handleRazorpayWebhook,
}
