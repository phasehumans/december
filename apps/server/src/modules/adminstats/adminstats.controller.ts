import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { freshQuerySchema, trendQuerySchema, statsWindowQuerySchema } from './adminstats.schema'
import { adminstatsService } from './adminstats.service'

import type { Request, Response } from 'express'

const getOverview = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await adminstatsService.getOverview({ fresh })
    return sendSuccess(res, 'overview fetched', result)
})

const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const query = statsWindowQuerySchema.parse(req.query)
    const result = await adminstatsService.getAnalytics(query)
    return sendSuccess(res, 'analytics fetched', result)
})

const getTrend = asyncHandler(async (req: Request, res: Response) => {
    const { days } = trendQuerySchema.parse(req.query)
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await adminstatsService.getTrend({ days, fresh })
    return sendSuccess(res, 'trend fetched', result)
})

const getPublicStatus = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await adminstatsService.getPublicStatus({ fresh })
    return sendSuccess(res, 'public status fetched', result)
})

const getHealth = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await adminstatsService.getHealth({ fresh })
    return sendSuccess(res, 'health fetched', result)
})

const getFailedJobs = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await adminstatsService.getFailedJobs({ fresh })
    return sendSuccess(res, 'failed jobs fetched', result)
})

export const adminstatsController = {
    getOverview,
    getAnalytics,
    getTrend,
    getHealth,
    getPublicStatus,
    getFailedJobs,
}
