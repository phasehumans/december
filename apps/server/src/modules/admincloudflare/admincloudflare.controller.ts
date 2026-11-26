import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { freshQuerySchema, visitorsQuerySchema } from './admincloudflare.schema'
import { admincloudflareService } from './admincloudflare.service'

import type { Request, Response } from 'express'

const getDeploys = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await admincloudflareService.getDeploys({ fresh })
    return sendSuccess(res, 'deploys fetched', result)
})

const getVisitors = asyncHandler(async (req: Request, res: Response) => {
    const { days } = visitorsQuerySchema.parse(req.query)
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await admincloudflareService.getVisitors({ days, fresh })
    return sendSuccess(res, 'visitors fetched', result)
})

const getEdge = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await admincloudflareService.getEdge({ fresh })
    return sendSuccess(res, 'edge traffic fetched', result)
})

const getPageSpeed = asyncHandler(async (req: Request, res: Response) => {
    const { fresh } = freshQuerySchema.parse(req.query)
    const result = await admincloudflareService.getPageSpeed({ fresh })
    return sendSuccess(res, 'page speed fetched', result)
})

export const admincloudflareController = {
    getDeploys,
    getVisitors,
    getEdge,
    getPageSpeed,
}
