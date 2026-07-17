import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    createSessionSchema,
    updateSessionSettingsSchema,
    addCollaboratorSchema,
} from './session.schema'
import * as sessionService from './session.service'

import type { Request, Response } from 'express'

export const getSessionsHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId

    const filters: import('./session.types').SessionFilters = {}
    if (req.query.type) filters.type = req.query.type as 'WEB' | 'CLI' | 'SEARCH'
    if (req.query.isArchived) filters.isArchived = req.query.isArchived === 'true'
    if (req.query.isPinned) filters.isPinned = req.query.isPinned === 'true'
    if (req.query.tags) {
        const tagsRaw = req.query.tags as string
        filters.tags = tagsRaw
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
    }
    if (req.query.sortBy) filters.sortBy = req.query.sortBy as 'updatedAt' | 'createdAt'
    if (req.query.sortOrder) filters.sortOrder = req.query.sortOrder as 'asc' | 'desc'

    const sessions = await sessionService.getUserSessions(userId, filters)
    return sendSuccess(res, 'sessions fetched successfully', { sessions })
})

export const getSessionByIdHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const result = await sessionService.getSession(id, userId)
    return sendSuccess(res, 'session fetched successfully', result)
})

export const createSessionHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId

    const parseData = createSessionSchema.parse(req.body)
    const { title, projectId, type, prompt } = parseData

    const session = await sessionService.createSession({
        userId,
        title,
        projectId,
        type,
        prompt,
    })
    return sendSuccess(res, 'session created successfully', { session }, 201)
})

export const updateSessionHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string
    const { title, projectId } = req.body

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const session = await sessionService.updateSession(id, userId, { title, projectId })
    return sendSuccess(res, 'session updated successfully', { session })
})

export const updateSessionSettingsHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const parseData = updateSessionSettingsSchema.parse(req.body)
    const { title, projectId, isPinned, isArchived, tags } = parseData

    const session = await sessionService.updateSessionSettings({
        userId,
        sessionId: id,
        title,
        projectId,
        isPinned,
        isArchived,
        tags,
    })
    return sendSuccess(res, 'session settings updated successfully', { session })
})

export const deleteSessionHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const result = await sessionService.deleteSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, result.message, result)
})

export const duplicateSessionHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string
    const { title } = req.body

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const session = await sessionService.duplicateSession({
        userId,
        sessionId: id,
        title,
    })
    return sendSuccess(res, 'session duplicated successfully', { session })
})

export const getCollaboratorsHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const collaborators = await sessionService.getCollaborators({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'collaborators fetched successfully', collaborators)
})

export const addCollaboratorHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string

    if (!id) {
        throw new AppError('session id is required', 400)
    }

    const parseData = addCollaboratorSchema.parse(req.body)
    const { email } = parseData

    const collaborator = await sessionService.addCollaborator({
        userId,
        sessionId: id,
        email,
    })
    return sendSuccess(res, 'collaborator added successfully', collaborator)
})

export const removeCollaboratorHandler = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const id = req.params.id as string
    const email = req.params.email as string

    if (!id) {
        throw new AppError('session id is required', 400)
    }
    if (!email) {
        throw new AppError('collaborator email is required', 400)
    }

    const result = await sessionService.removeCollaborator({
        userId,
        sessionId: id,
        email,
    })
    return sendSuccess(res, result.message, result)
})
