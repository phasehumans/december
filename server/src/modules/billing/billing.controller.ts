import { AppError } from '../../shared/appError'

import {
    cancelSubscriptionSchema,
    createSubscriptionSchema,
    creditsHistoryQuerySchema,
    verifySubscriptionSchema,
    redeemCodeSchema,
} from './billing.schema'
import { billingService } from './billing.service'

import type { Request, Response } from 'express'

const getOverview = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await billingService.getOverview({ userId })
        return res.status(200).json({
            success: true,
            message: 'billing overview fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch billing overview',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch billing overview',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getPlans = async (req: Request, res: Response) => {
    try {
        const result = await billingService.getPlans()
        return res.status(200).json({
            success: true,
            message: 'billing plans fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch billing plans',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch billing plans',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const createSubscription = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

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
        return res.status(201).json({
            success: true,
            message: 'billing subscription created successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to create billing subscription',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to create billing subscription',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const verifySubscription = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

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

        return res.status(200).json({
            success: true,
            message: 'billing subscription verified successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to verify billing subscription',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to verify billing subscription',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const cancelSubscription = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

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
        return res.status(200).json({
            success: true,
            message: 'billing subscription canceled successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to cancel billing subscription',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to cancel billing subscription',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const getCreditsHistory = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

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
        return res.status(200).json({
            success: true,
            message: 'billing credits history fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to fetch billing credits history',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to fetch billing credits history',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const createPortalSession = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await billingService.createPortalSession({ userId })
        return res.status(200).json({
            success: true,
            message: 'billing portal created successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to create billing portal',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to create billing portal',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const handleRazorpayWebhook = async (req: Request, res: Response) => {
    try {
        const result = await billingService.handleRazorpayWebhook({
            body: req.body,
            rawBody: (req as Request & { rawBody?: Buffer }).rawBody,
            signature: req.headers['x-razorpay-signature']?.toString(),
        })
        return res.status(200).json({
            success: true,
            message: 'razorpay webhook processed successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to process razorpay webhook',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to process razorpay webhook',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const redeemCode = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: 'unauthorized',
        })
    }

    const parsedBody = redeemCodeSchema.safeParse(req.body)

    if (!parsedBody.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parsedBody.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await billingService.redeemCode({
            userId,
            code: parsedBody.data.code,
        })

        return res.status(200).json({
            success: true,
            message: 'Code redeemed successfully.',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'Failed to redeem code.',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to redeem code.',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
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
    redeemCode,
}
