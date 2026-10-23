import { AppError } from '../../shared/appError'
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
    deleteSessionParamsSchema,
    disconnectSessionParamsSchema,
    rehydrateSessionParamsSchema,
    proxyPreviewParamsSchema,
    streamSearchResponseParamsSchema,
    streamSearchResponseBodySchema,
    getSessionDiffParamsSchema,
    getSessionFileTreeParamsSchema,
    getSessionFileContentParamsSchema,
    getSessionFileContentQuerySchema,
    getSessionPullRequestsParamsSchema,
    getSessionPlanParamsSchema,
    getSessionTestsParamsSchema,
    getSessionPreviewPortParamsSchema,
    submitQuestionAnswerParamsSchema,
    submitQuestionAnswerBodySchema,
    getPendingQuestionParamsSchema,
} from './session.schema'
import { sessionService } from './session.service'

import type { Request, Response } from 'express'

export const getSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
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
    if (parsedQuery.search) filters.search = parsedQuery.search
    if (parsedQuery.page) filters.page = parsedQuery.page
    if (parsedQuery.limit) filters.limit = parsedQuery.limit

    const result = await sessionService.getUserSessions({ userId, filters })
    return sendSuccess(res, 'sessions fetched successfully', {
        sessions: result.sessions,
        pagination: result.pagination,
    })
})

export const createSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const parsedBody = createSessionSchema.parse(req.body)
    const { title, type, prompt, projectId, repoUrl, branch, gitRef, issueNumber } = parsedBody

    const session = await sessionService.createSession({
        userId,
        title,
        type,
        prompt,
        projectId,
        repoUrl,
        branch,
        gitRef,
        issueNumber,
    })
    return sendSuccess(res, 'session created successfully', { session }, 201)
})

export const getSessionById = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionByIdSchema.parse(req.params)

    const result = await sessionService.getSession({ userId, sessionId: id })
    return sendSuccess(res, 'session fetched successfully', result)
})

export const renameSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
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
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = archiveSessionParamsSchema.parse(req.params)

    const session = await sessionService.archiveSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'session archived successfully', { session })
})

export const unarchiveSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = unarchiveSessionParamsSchema.parse(req.params)

    const session = await sessionService.unarchiveSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'session unarchived successfully', { session })
})

export const updateSessionTags = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = updateSessionTagsParamsSchema.parse(req.params)
    const { tags } = updateSessionTagsBodySchema.parse(req.body)

    const session = await sessionService.updateSessionTags({
        userId,
        sessionId: id,
        tags,
    })
    return sendSuccess(res, 'session tags updated successfully', { session })
})

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = deleteSessionParamsSchema.parse(req.params)

    const result = await sessionService.deleteSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, result.message, result)
})

export const rehydrateSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = rehydrateSessionParamsSchema.parse(req.params)

    const result = await sessionService.rehydrateSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, 'session rehydrated successfully', result)
})

export const disconnectSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = disconnectSessionParamsSchema.parse(req.params)

    const result = await sessionService.disconnectSession({
        userId,
        sessionId: id,
    })
    return sendSuccess(res, result.message, result)
})

export const proxyPreview = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id, port } = proxyPreviewParamsSchema.parse(req.params)
    const subPath = typeof req.query.path === 'string' ? req.query.path : '/'

    const result = await sessionService.proxyPreview({
        userId,
        sessionId: id,
        port,
        reqPath: subPath,
    })

    res.set(result.headers)

    if (req.headers.accept?.includes('application/json')) {
        return sendSuccess(res, 'web preview proxy target resolved', result)
    }

    if (
        result.previewUrl.startsWith('http') &&
        (result.targetHost.endsWith('.e2b.dev') || process.env.NODE_ENV === 'production')
    ) {
        return res.redirect(302, result.previewUrl)
    }

    res.setHeader('Content-Type', 'text/html')
    return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Preview Port ${port}</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid #334155; text-align: center; max-width: 480px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
                .badge { background: #3b82f6; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; display: inline-block; margin-bottom: 1rem; }
                code { background: #0f172a; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
                p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; }
            </style>
        </head>
        <body>
            <div class="card">
                <span class="badge">E2B Cloud Sandbox</span>
                <h2>Dev Server Active on Port ${port}</h2>
                <p>Proxy target domain: <code>${result.targetHost}</code></p>
                <p>Live sandbox web application container listening for active connections.</p>
            </div>
        </body>
        </html>
    `)
})

export const streamSearchResponse = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = streamSearchResponseParamsSchema.parse(req.params)
    const { prompt, messageHistory } = streamSearchResponseBodySchema.parse(req.body)

    await sessionService.streamSearchResponse({
        userId,
        sessionId: id,
        prompt,
        messageHistory,
        res,
    })
})

export const getSessionMessages = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionByIdSchema.parse(req.params)

    const beforeSequence = req.query.beforeSequence
        ? parseInt(req.query.beforeSequence as string, 10)
        : undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

    const messages = await sessionService.getSessionMessages({
        userId,
        sessionId: id,
        beforeSequence,
        limit,
    })

    return sendSuccess(res, 'messages fetched successfully', { messages })
})

export const getSessionDiff = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionDiffParamsSchema.parse(req.params)

    const result = await sessionService.getSessionDiff({ userId, sessionId: id })
    return sendSuccess(res, 'session diff fetched successfully', result)
})

export const getSessionFileTree = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionFileTreeParamsSchema.parse(req.params)

    const result = await sessionService.getSessionFileTree({ userId, sessionId: id })
    return sendSuccess(res, 'session file tree fetched successfully', result)
})

export const getSessionFileContent = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionFileContentParamsSchema.parse(req.params)
    const { path } = getSessionFileContentQuerySchema.parse(req.query)

    const result = await sessionService.getSessionFileContent({
        userId,
        sessionId: id,
        path,
    })
    return sendSuccess(res, 'session file content fetched successfully', result)
})

export const getSessionPullRequests = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionPullRequestsParamsSchema.parse(req.params)

    const result = await sessionService.getSessionPullRequests({ userId, sessionId: id })
    return sendSuccess(res, 'session pull requests fetched successfully', result)
})

export const getSessionPlan = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionPlanParamsSchema.parse(req.params)

    const result = await sessionService.getSessionPlan({ userId, sessionId: id })
    return sendSuccess(res, 'session plan fetched successfully', result)
})

export const getSessionTests = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionTestsParamsSchema.parse(req.params)

    const result = await sessionService.getSessionTests({ userId, sessionId: id })
    return sendSuccess(res, 'session tests fetched successfully', result)
})

export const getSessionPreviewPort = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionPreviewPortParamsSchema.parse(req.params)

    const result = await sessionService.getSessionPreviewPort({ userId, sessionId: id })
    return sendSuccess(res, 'session preview port fetched successfully', result)
})

export const submitQuestionAnswer = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = submitQuestionAnswerParamsSchema.parse(req.params)
    const { questionId, answer } = submitQuestionAnswerBodySchema.parse(req.body)

    const result = await sessionService.submitQuestionAnswer({
        userId,
        sessionId: id,
        questionId,
        answer,
    })
    return sendSuccess(res, 'question answer submitted successfully', result)
})

export const getPendingQuestion = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getPendingQuestionParamsSchema.parse(req.params)

    const result = await sessionService.getPendingQuestion({ userId, sessionId: id })
    return sendSuccess(res, 'pending question fetched successfully', result)
})

export const sessionController = {
    getSessions,
    createSession,
    getSessionById,
    getSessionMessages,
    renameSession,
    archiveSession,
    unarchiveSession,
    updateSessionTags,
    deleteSession,
    rehydrateSession,
    disconnectSession,
    proxyPreview,
    streamSearchResponse,
    getSessionDiff,
    getSessionFileTree,
    getSessionFileContent,
    getSessionPullRequests,
    getSessionPlan,
    getSessionTests,
    getSessionPreviewPort,
    submitQuestionAnswer,
    getPendingQuestion,
}
