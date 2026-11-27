import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    getSessionsSchema,
    getSessionFacetsSchema,
    getPullRequestsSchema,
    createSessionSchema,
    getSessionByIdSchema,
    getSessionMessagesQuerySchema,
    renameSessionParamsSchema,
    renameSessionBodySchema,
    archiveSessionParamsSchema,
    unarchiveSessionParamsSchema,
    pinSessionParamsSchema,
    unpinSessionParamsSchema,
    unarchiveSessionsBodySchema,
    updateSessionTagsParamsSchema,
    updateSessionTagsBodySchema,
    deleteSessionParamsSchema,
    deleteAllSessionsSchema,
    disconnectSessionParamsSchema,
    proxyPreviewParamsSchema,
    previewActivityParamsSchema,
    stopSessionParamsSchema,
    streamSearchResponseParamsSchema,
    streamSearchResponseBodySchema,
    smartSearchSessionsSchema,
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
    getSessionDesktopViewportParamsSchema,
} from './session.schema'
import { sessionService } from './session.service'
import { decodePullRequestCursor } from './session.utils'

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
    if (parsedQuery.repoName) filters.repoName = parsedQuery.repoName
    if (parsedQuery.sortBy) filters.sortBy = parsedQuery.sortBy
    if (parsedQuery.sortOrder) filters.sortOrder = parsedQuery.sortOrder
    if (parsedQuery.search) filters.search = parsedQuery.search
    if (parsedQuery.searchIn) filters.searchIn = parsedQuery.searchIn
    if (parsedQuery.page) filters.page = parsedQuery.page
    if (parsedQuery.limit) filters.limit = parsedQuery.limit
    if (parsedQuery.vmStatus) filters.vmStatus = parsedQuery.vmStatus
    if (parsedQuery.hasPr) filters.hasPr = true
    if (parsedQuery.pinnedFirst) filters.pinnedFirst = true
    if (parsedQuery.needsAnswer) filters.needsAnswer = true

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
    const {
        title,
        type,
        prompt,
        projectId,
        repoUrl,
        branch,
        gitRef,
        issueNumber,
        billingSource,
        provider,
        model,
        tier,
        planFirst,
        effort,
        openPullRequest,
        disabledPlugins,
        disabledMcps,
    } = parsedBody

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
        billingSource,
        provider,
        model,
        tier,
        planFirst,
        effort,
        openPullRequest,
        disabledPlugins,
        disabledMcps,
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

export const pinSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = pinSessionParamsSchema.parse(req.params)

    const session = await sessionService.pinSession({ userId, sessionId: id })
    return sendSuccess(res, 'session pinned successfully', { session })
})

export const unpinSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = unpinSessionParamsSchema.parse(req.params)

    const session = await sessionService.unpinSession({ userId, sessionId: id })
    return sendSuccess(res, 'session unpinned successfully', { session })
})

export const archiveMergedSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const result = await sessionService.archiveMergedSessions({ userId })
    return sendSuccess(res, 'merged sessions archived successfully', result)
})

export const unarchiveSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { sessionIds, pins } = unarchiveSessionsBodySchema.parse(req.body)

    const result = await sessionService.unarchiveSessions({ userId, sessionIds, pins })
    return sendSuccess(res, 'sessions unarchived successfully', result)
})

export const getPullRequests = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { state, isArchived, repo, tag, search, sortBy, sortOrder, page, limit, cursor } =
        getPullRequestsSchema.parse(req.query)

    // a cursor holds the sort it was made for: another sort cannot continue from it
    const decoded = cursor ? decodePullRequestCursor(cursor) : undefined
    if (
        decoded === null ||
        (decoded &&
            (decoded.sortBy !== (sortBy ?? 'updatedAt') ||
                decoded.sortOrder !== (sortOrder ?? 'desc')))
    ) {
        throw new AppError('invalid cursor', 400)
    }

    const result = await sessionService.getPullRequests({
        userId,
        filters: {
            states: state,
            isArchived,
            repo,
            tag,
            search,
            sortBy,
            sortOrder,
            page,
            limit,
            cursor: decoded,
        },
    })
    return sendSuccess(res, 'pull requests fetched successfully', result)
})

export const getSessionCounts = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const counts = await sessionService.getSessionCounts({ userId })
    return sendSuccess(res, 'session counts fetched successfully', counts)
})

// the user's repositories and tags, for the sort and filter menu (#641)
export const getSessionFacets = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const { hasPr } = getSessionFacetsSchema.parse(req.query)

    const facets = await sessionService.getSessionFacets({ userId, hasPr })
    return sendSuccess(res, 'session facets fetched successfully', facets)
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

// every session of the user (#636). the body must say { confirm: 'delete' }
export const deleteAllSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    deleteAllSessionsSchema.parse(req.body ?? {})

    const result = await sessionService.deleteAllSessions({ userId })
    return sendSuccess(res, 'all sessions deleted', result)
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

export const smartSearchSessions = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { q } = smartSearchSessionsSchema.parse(req.query)

    // the client cancels when the user keeps typing; stop the model call too
    const abort = new AbortController()
    res.on('close', () => {
        if (!res.writableFinished) abort.abort()
    })

    const result = await sessionService.smartSearchSessions({
        userId,
        query: q,
        signal: abort.signal,
    })
    return sendSuccess(res, 'smart search finished', result)
})

export const getSessionMessages = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionByIdSchema.parse(req.params)

    const { beforeSequence, limit } = getSessionMessagesQuerySchema.parse(req.query)

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

export const recordPreviewActivity = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = previewActivityParamsSchema.parse(req.params)

    const result = await sessionService.recordPreviewActivity({ userId, sessionId: id })
    return sendSuccess(res, 'preview activity recorded', result)
})

export const stopSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = stopSessionParamsSchema.parse(req.params)

    const result = await sessionService.stopSession({ userId, sessionId: id })
    return sendSuccess(res, 'session stopped', result)
})

export const getRunningSandboxes = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const result = await sessionService.getRunningSandboxes({ userId })
    return sendSuccess(res, 'running sandboxes fetched successfully', result)
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

export const getSessionDesktopViewport = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    const { id } = getSessionDesktopViewportParamsSchema.parse(req.params)

    const result = await sessionService.getSessionDesktopViewport({ userId, sessionId: id })
    return sendSuccess(res, 'session desktop viewport fetched successfully', result)
})

export const sessionController = {
    getSessions,
    createSession,
    getSessionById,
    getSessionMessages,
    renameSession,
    archiveSession,
    unarchiveSession,
    pinSession,
    unpinSession,
    archiveMergedSessions,
    unarchiveSessions,
    getSessionCounts,
    getSessionFacets,
    getPullRequests,
    updateSessionTags,
    deleteSession,
    deleteAllSessions,
    disconnectSession,
    proxyPreview,
    recordPreviewActivity,
    stopSession,
    getRunningSandboxes,
    streamSearchResponse,
    smartSearchSessions,
    getSessionDiff,
    getSessionFileTree,
    getSessionFileContent,
    getSessionPullRequests,
    getSessionPlan,
    getSessionTests,
    getSessionPreviewPort,
    submitQuestionAnswer,
    getPendingQuestion,
    getSessionDesktopViewport,
}
