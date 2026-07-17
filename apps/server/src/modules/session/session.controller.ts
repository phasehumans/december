import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    getSessionsSchema,
    createSessionSchema,
    getSessionByIdSchema,
    renameSessionParamsSchema,
    renameSessionBodySchema,
    archiveSessionParamsSchema,
    unarchiveSessionParamsSchema,
    updateSessionTagsParamsSchema,
    updateSessionTagsBodySchema,
    getSessionInsightsParamsSchema,
    deleteSessionParamsSchema,
    getCollaboratorsParamsSchema,
    addCollaboratorParamsSchema,
    addCollaboratorBodySchema,
    removeCollaboratorParamsSchema,
} from './session.schema'
import * as sessionService from './session.service'

import type { Request, Response } from 'express'

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const parsedQuery = getSessionsSchema.parse(req.query)

    const filters: import('./session.types').SessionFilters = {}
    if (parsedQuery.type) filters.type = parsedQuery.type
    if (parsedQuery.isArchived !== undefined) filters.isArchived = parsedQuery.isArchived
    if (parsedQuery.tags) {
        filters.tags = parsedQuery.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
    }
    if (parsedQuery.sortBy) filters.sortBy = parsedQuery.sortBy
    if (parsedQuery.sortOrder) filters.sortOrder = parsedQuery.sortOrder

    const sessions = await sessionService.getUserSessions(userId, filters)
    return sendSuccess(res, 'sessions fetched successfully', { sessions })
})

export const createSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const parsedBody = createSessionSchema.parse(req.body)
    const { title, projectId, type, prompt } = parsedBody

    const session = await sessionService.createSession({
        userId,
        title,
        projectId,
        type,
        prompt,
    })
    return sendSuccess(res, 'session created successfully', { session }, 201)
})

export const getSessionById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = getSessionByIdSchema.parse(req.params)

    const result = await sessionService.getSession(id, userId)
    return sendSuccess(res, 'session fetched successfully', result)
})

export const renameSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = renameSessionParamsSchema.parse(req.params)
    const { title } = renameSessionBodySchema.parse(req.body)

    const session = await sessionService.renameSession({
        userId,
        sessionId: id,
        title,
    })
    return sendSuccess(res, 'session renamed successfully', { session })
})

export const archiveSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = archiveSessionParamsSchema.parse(req.params)

    const session = await sessionService.archiveSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'session archived successfully', { session })
})

export const unarchiveSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = unarchiveSessionParamsSchema.parse(req.params)

    const session = await sessionService.unarchiveSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'session unarchived successfully', { session })
})

export const updateSessionTags = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = updateSessionTagsParamsSchema.parse(req.params)
    const { tags } = updateSessionTagsBodySchema.parse(req.body)

    const session = await sessionService.updateSessionTags({
        userId,
        sessionId: id,
        tags,
    })
    return sendSuccess(res, 'session tags updated successfully', { session })
})

export const getSessionInsights = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = getSessionInsightsParamsSchema.parse(req.params)

    const result = await sessionService.getSessionInsights({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'session insights fetched successfully', result)
})

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = deleteSessionParamsSchema.parse(req.params)

    const result = await sessionService.deleteSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, result.message, result)
})

export const getCollaborators = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = getCollaboratorsParamsSchema.parse(req.params)

    const collaborators = await sessionService.getCollaborators({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'collaborators fetched successfully', collaborators)
})

export const addCollaborator = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id } = addCollaboratorParamsSchema.parse(req.params)
    const { email } = addCollaboratorBodySchema.parse(req.body)

    const collaborator = await sessionService.addCollaborator({
        userId,
        sessionId: id,
        email,
    })
    return sendSuccess(res, 'collaborator added successfully', collaborator)
})

export const removeCollaborator = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId
    const { id, email } = removeCollaboratorParamsSchema.parse(req.params)

    const result = await sessionService.removeCollaborator({
        userId,
        sessionId: id,
        email,
    })
    return sendSuccess(res, result.message, result)
})
