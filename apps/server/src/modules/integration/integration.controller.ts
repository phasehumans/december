import { asyncHandler } from '../../shared/asyncHandler'
import { AppError } from '../../shared/appError'
import { sendSuccess } from '../../shared/response'

import { createGithubRepoSchema, syncGithubRepoSchema } from './integration.schema'
import { integrationsService } from './integration.service'

import type { Request, Response } from 'express'

const connectVercel = asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined
    const teamId = req.query.teamId as string | undefined
    const configurationId = req.query.configurationId as string | undefined
    const state = req.query.state as string | undefined

    if (!code) {
        throw new AppError('no code provided', 400)
    }

    if (!state) {
        throw new AppError('no user id provided', 400)
    }

    let userId = state
    let redirectPath = '/profile/integrations'
    if (state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':')
    }

    await integrationsService.connectVercel({
        code,
        userId,
        teamId,
        configurationId,
    })

    return res.redirect(`http://localhost:3000${redirectPath}`)
})

const connectSupabase = asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined
    const userId = req.query.state as string | undefined

    if (!code) {
        throw new AppError('no code provided', 400)
    }

    if (!userId) {
        throw new AppError('no user id provided', 400)
    }

    await integrationsService.connectSupabase({
        userId,
        code,
    })

    return res.redirect('http://localhost:3000/profile/integrations')
})

const connectNotion = asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined
    const userId = req.query.state as string | undefined

    if (!code) {
        throw new AppError('no code provided', 400)
    }

    if (!userId) {
        throw new AppError('no user id provided', 400)
    }

    await integrationsService.connectNotion({
        userId,
        code,
    })

    return res.redirect('http://localhost:3000/profile/integrations')
})

const connectGithub = asyncHandler(async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined
    const state = req.query.state as string | undefined

    if (!code) {
        throw new AppError('no code provided', 400)
    }

    if (!state) {
        throw new AppError('no user id provided', 400)
    }

    let userId = state
    let redirectPath = '/profile/integrations'
    if (state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':')
    }

    type GithubTokenResponse = {
        access_token: string
        token_type: string
        scope: string
    }

    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
        }),
    })

    const tokenData = (await tokenResponse.json()) as GithubTokenResponse
    const accessToken = tokenData.access_token

    const userRes = await fetch('https://api.github.com/user', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    })

    const githubUser: any = await userRes.json()
    const username = githubUser.login

    await integrationsService.connectGithub({ userId, accessToken, username })
    return res.redirect(`http://localhost:3000${redirectPath}`)
})

const getUserGithubRepos = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await integrationsService.getUserGithubRepos({ userId })
    return sendSuccess(res, 'repos fetched successfully', result)
})

const createRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parsedBody = createGithubRepoSchema.parse(req.body)
    const result = await integrationsService.createRepo({
        userId,
        projectId,
        ...parsedBody,
    })

    return sendSuccess(res, 'repository created and linked successfully', result)
})

const updateRepo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined

    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    if (!projectId) {
        throw new AppError('project id is required', 400)
    }

    const parsedBody = syncGithubRepoSchema.parse(req.body)
    const result = await integrationsService.updateRepo({
        userId,
        projectId,
        ...parsedBody,
    })

    return sendSuccess(res, 'repository synced successfully', result)
})

export const integrationsController = {
    getUserGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
    createRepo,
    updateRepo,
}
