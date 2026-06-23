import { asyncHandler } from '../../shared/asyncHandler'

import { connectVercelQuerySchema, connectOAuthQuerySchema } from './integration.schema'
import { integrationsService } from './integration.service'

import type { Request, Response } from 'express'

const connectVercel = asyncHandler(async (req: Request, res: Response) => {
    const { code, state, teamId, configurationId } = connectVercelQuerySchema.parse(req.query)

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
    const { code, state: userId } = connectOAuthQuerySchema.parse(req.query)

    await integrationsService.connectSupabase({
        userId,
        code,
    })

    return res.redirect('http://localhost:3000/profile/integrations')
})

const connectNotion = asyncHandler(async (req: Request, res: Response) => {
    const { code, state: userId } = connectOAuthQuerySchema.parse(req.query)

    await integrationsService.connectNotion({
        userId,
        code,
    })

    return res.redirect('http://localhost:3000/profile/integrations')
})

const connectGithub = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = connectOAuthQuerySchema.parse(req.query)

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

export const integrationsController = {
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
}
