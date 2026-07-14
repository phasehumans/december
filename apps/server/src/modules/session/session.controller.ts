import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import * as sessionService from './session.service'

import type { Request, Response } from 'express'

export const getSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const sessions = await sessionService.getUserSessions(userId)
    return sendSuccess(res, 'Sessions retrieved successfully', { sessions })
})

export const getSessionByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = req.params
    const session = await sessionService.getSession(id as string, userId)
    return sendSuccess(res, 'Session retrieved successfully', { session })
})

export const createSessionHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { title, projectId, type } = req.body
    const session = await sessionService.createSession(userId, { title, projectId, type })
    return sendSuccess(res, 'Session created successfully', { session }, 201)
})

export const updateSessionHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = req.params
    const { title, projectId } = req.body
    const session = await sessionService.updateSession(id as string, userId, { title, projectId })
    return sendSuccess(res, 'Session updated successfully', { session })
})
