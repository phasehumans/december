import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'
import {
    GenerateWikiSchema,
    CreatePageSchema,
    UpdatePageSchema,
    WikiChatSchema,
} from './wiki.schema'
import { wikiService } from './wiki.service'

import type { Request, Response } from 'express'

const getGitHubRepos = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const result = await wikiService.getUserGitHubRepos({ userId })
    return sendSuccess(res, 'github repos fetched successfully', result)
})

const generateWiki = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = GenerateWikiSchema.parse(req.body)
    const wiki = await wikiService.generateWiki({
        userId,
        repoOwner: data.repoOwner,
        repoName: data.repoName,
        repoUrl: data.repoUrl,
    })
    return sendSuccess(res, 'wiki generated successfully', { wiki })
})

const getWikiByRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const owner = req.params.owner as string
    const repo = req.params.repo as string
    if (!owner || !repo) throw new AppError('owner and repo are required', 400)

    const wiki = await wikiService.getWikiByRepo({ userId, repoOwner: owner, repoName: repo })
    return sendSuccess(res, 'wiki fetched successfully', { wiki })
})

const createPage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = CreatePageSchema.parse(req.body)
    const page = await wikiService.createWikiPage({ userId, dto: data })
    return sendSuccess(res, 'wiki page created successfully', { page }, 201)
})

const updatePage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const id = req.params.id as string
    if (!id) throw new AppError('page id is required', 400)

    const data = UpdatePageSchema.parse(req.body)
    const page = await wikiService.updateWikiPage({ userId, pageId: id, dto: data })
    return sendSuccess(res, 'wiki page updated successfully', { page })
})

const deletePage = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const id = req.params.id as string
    if (!id) throw new AppError('page id is required', 400)

    await wikiService.deleteWikiPage({ userId, pageId: id })
    return sendSuccess(res, 'wiki page deleted successfully', null)
})

const chatWithWiki = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) throw new AppError('unauthorized', 401)

    const data = WikiChatSchema.parse(req.body)
    const result = await wikiService.chatWithWiki({
        userId,
        prompt: data.prompt,
        repoFullName: data.repoFullName,
        wikiId: data.wikiId,
    })
    return sendSuccess(res, 'wiki chat response generated', result)
})

export const wikiController = {
    getGitHubRepos,
    generateWiki,
    getWikiByRepo,
    createPage,
    updatePage,
    deletePage,
    chatWithWiki,
}
