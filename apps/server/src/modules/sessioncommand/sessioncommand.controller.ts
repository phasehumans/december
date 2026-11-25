import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    checkQuerySchema,
    codeSearchQuerySchema,
    compactBodySchema,
    reviewBodySchema,
    rewindBodySchema,
    sessionIdParamsSchema,
    sideQuestionBodySchema,
} from './sessioncommand.schema'
import { sessionCommandService } from './sessioncommand.service'

import type { Request, Response } from 'express'

const requireUser = (req: Request): string => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)
    return userId
}

const getContext = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.getContext({ userId, sessionId: id })
    return sendSuccess(res, 'context fetched successfully', result)
})

const compactSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const { focus } = compactBodySchema.parse(req.body ?? {})
    const result = await sessionCommandService.compactSession({ userId, sessionId: id, focus })
    return sendSuccess(res, 'session compacted successfully', result)
})

const clearSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.clearSession({ userId, sessionId: id })
    return sendSuccess(res, 'conversation cleared successfully', result)
})

const forkSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.forkSession({ userId, sessionId: id })
    return sendSuccess(res, 'session forked successfully', result, 201)
})

const listTurns = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.listTurns({ userId, sessionId: id })
    return sendSuccess(res, 'turns fetched successfully', result)
})

const rewindSession = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const { sequence } = rewindBodySchema.parse(req.body)
    const result = await sessionCommandService.rewindSession({ userId, sessionId: id, sequence })
    return sendSuccess(res, 'session rewound successfully', result)
})

const askSideQuestion = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const { question } = sideQuestionBodySchema.parse(req.body)
    const result = await sessionCommandService.askSideQuestion({
        userId,
        sessionId: id,
        question,
    })
    return sendSuccess(res, 'side question answered', result)
})

const generateTitle = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.generateTitle({ userId, sessionId: id })
    return sendSuccess(res, 'title generated successfully', result)
})

const searchCode = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const { q } = codeSearchQuerySchema.parse(req.query)
    const result = await sessionCommandService.searchCode({ userId, sessionId: id, query: q })
    return sendSuccess(res, 'code searched successfully', result)
})

const listTasks = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.listTasks({ userId, sessionId: id })
    return sendSuccess(res, 'tasks fetched successfully', result)
})

const getUsage = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { id } = sessionIdParamsSchema.parse(req.params)
    const result = await sessionCommandService.getUsage({ userId, sessionId: id })
    return sendSuccess(res, 'usage fetched successfully', result)
})

const getCheck = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { sessionId } = checkQuerySchema.parse(req.query)
    const result = await sessionCommandService.getCheck({ userId, sessionId })
    return sendSuccess(res, 'check completed', result)
})

const startReview = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUser(req)
    const { url } = reviewBodySchema.parse(req.body)
    const result = await sessionCommandService.startReview({ userId, url })
    return sendSuccess(res, 'review session created successfully', result, 201)
})

export const sessionCommandController = {
    getContext,
    compactSession,
    clearSession,
    forkSession,
    listTurns,
    rewindSession,
    askSideQuestion,
    generateTitle,
    searchCode,
    listTasks,
    getUsage,
    getCheck,
    startReview,
}
