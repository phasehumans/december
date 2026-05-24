import { AppError } from '../../utils/appError'
import { integrationsService } from './integrations.service'

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
        const code = typeof req.query.code === 'string' ? req.query.code : undefined

        const userId = req.user?.userId as string | undefined

        console.log('USER:', userId)
        console.log('CODE:', code)

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'unauthorized',
            })
        }

        const result = await integrationsService.connectSupabase({
            userId,
            code,
        })

        if (result.type === 'redirect') {
            return res.redirect(result.url)
        }

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
        const { code } = req.query

        const userId = req.user?.userId as string | undefined

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'unauthorized',
            })
        }

        const result = await integrationsService.connectNotion({
            userId,

            code: typeof code === 'string' ? code : undefined,
        })

        /**
         * Redirect user to Notion
         */
        if (result.type === 'redirect') {
            return res.redirect(result.url)
        }

        return res.status(200).json({
            success: true,
            message: 'Notion connected successfully',
            data: result,
        })
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

const connectStripe = async (req: Request, res: Response) => {
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

        // console.log(accessToken, username)

        // await integrationsService.connectStripe({ userId, accessToken, username })
        return res.redirect('http://localhost:3000')
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

export const integrationsController = {
    getUserGithubRepos,
    connectVercel,
    connectSupabase,
    connectNotion,
    connectStripe,
}
