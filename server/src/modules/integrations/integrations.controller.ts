import { AppError } from '../../shared/appError'

import { integrationsService } from './integrations.service'
import { createGithubRepoSchema, syncGithubRepoSchema } from './integrations.schema'

import type { Request, Response } from 'express'

const getUserGithubRepos = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    try {
        const result = await integrationsService.listGithubRepos(userId)
        return res.status(200).json({
            success: true,
            message: 'repos fetched successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to get user repos',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to get user repos',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectVercel = async (req: Request, res: Response) => {
    const code = req.query.code as string
    const teamId = req.query.teamId as string
    const configurationId = req.query.configurationId as string
    const userId = req.query.state as string

    try {
        if (!code) {
            throw new AppError('no code provided', 400)
        }

        if (!userId) {
            throw new AppError('no user id provided', 400)
        }

        await integrationsService.connectVercel({
            code,
            userId,
            teamId,
            configurationId,
        })

        return res.redirect('http://localhost:3000/profile/integrations')
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect vercel',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect vercel',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectSupabase = async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string
        const userId = req.query.state as string

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
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect supabase',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect supabase',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectNotion = async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string
        const userId = req.query.state as string

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
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect notion',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect notion',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectGithub = async (req: Request, res: Response) => {
    const code = req.query.code as string
    const userId = req.query.state as string

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'no code provided',
        })
    }

    type GithubTokenResponse = {
        access_token: string
        token_type: string
        scope: string
    }

    try {
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
        return res.redirect('http://localhost:3000/profile/integrations')
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect with github',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect with github',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const connectFigma = async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string
        const userId = req.query.state as string

        if (!code) {
            throw new AppError('no code provided', 400)
        }

        if (!userId) {
            throw new AppError('no user id provided', 400)
        }

        await integrationsService.connectFigma({
            userId,
            code,
        })
        return res.redirect('http://localhost:3000/profile/integrations')
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to connect figma',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to connect figma',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const createRepo = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = createGithubRepoSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await integrationsService.createRepo(userId, projectId, parseData.data)
        return res.status(200).json({
            success: true,
            message: 'repository created and linked successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to create repository',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to create repository',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

const updateRepo = async (req: Request, res: Response) => {
    const userId = req.user?.userId as string | undefined
    const projectId = req.params.projectId as string | undefined
    const parseData = syncGithubRepoSchema.safeParse(req.body)

    if (!userId) {
        return res.status(400).json({
            success: false,
            message: 'unauthorized',
        })
    }

    if (!projectId) {
        return res.status(400).json({
            success: false,
            message: 'project id is required',
        })
    }

    if (!parseData.success) {
        return res.status(400).json({
            success: false,
            message: 'validation failed',
            errors: parseData.error.flatten().fieldErrors,
        })
    }

    try {
        const result = await integrationsService.updateRepo(userId, projectId, parseData.data)
        return res.status(200).json({
            success: true,
            message: 'repository synced successfully',
            data: result,
        })
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: 'failed to sync repository',
                errors: error.message,
            })
        }

        return res.status(500).json({
            success: false,
            message: 'failed to sync repository',
            errors: error instanceof Error ? error.message : 'unknown error',
        })
    }
}

export const integrationsController = {
    getUserGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
    connectFigma,
    createRepo,
    updateRepo,
}
