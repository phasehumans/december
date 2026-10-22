import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { createGithubRepoSchema, syncGithubRepoSchema } from './platform.schema'
import { platformService } from './platform.service'

import type { Request, Response } from 'express'

const downloadProject = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const sessionId = req.params.sessionId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!sessionId) {
        throw new AppError('session id is required', 400)
    }

    const result = await platformService.downloadSession({
        userId,
        sessionId,
    })

    if (result.downloadUrl) {
        return res.redirect(result.downloadUrl)
    }

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`)
    return res.status(200).send(Buffer.from(result.zip || ''))
})

const getUserGithubRepos = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30
    const search = req.query.search as string | undefined

    const result = await platformService.getUserGithubRepos({
        userId,
        page,
        limit,
        search,
    })

    return sendSuccess(res, 'github repositories fetched successfully', result)
})

const createRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const sessionId = req.params.sessionId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!sessionId) {
        throw new AppError('session id is required', 400)
    }

    const parsedBody = createGithubRepoSchema.parse(req.body)

    const result = await platformService.createRepo({
        userId,
        sessionId,
        name: parsedBody.name,
        private: parsedBody.private,
        description: parsedBody.description,
    })

    return sendSuccess(res, 'repository created successfully', result, 201)
})

const updateRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const sessionId = req.params.sessionId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!sessionId) {
        throw new AppError('session id is required', 400)
    }

    const parsedBody = syncGithubRepoSchema.parse(req.body)

    const result = await platformService.updateRepo({
        userId,
        sessionId,
        commitMessage: parsedBody.commitMessage,
    })

    return sendSuccess(res, 'repository updated successfully', result.session)
})

const unlinkGithubRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const sessionId = req.params.sessionId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!sessionId) {
        throw new AppError('session id is required', 400)
    }

    const result = await platformService.unlinkGithubRepo({ userId, sessionId })
    return sendSuccess(res, result.message, result)
})

export const platformController = {
    downloadProject,
    getUserGithubRepos,
    createRepo,
    updateRepo,
    unlinkGithubRepo,
}
