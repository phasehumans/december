import { env } from '../../env'
import { asyncHandler } from '../../shared/asyncHandler'

import { connectVercelQuerySchema, connectOAuthQuerySchema } from './integration.schema'
import { integrationsService } from './integration.service'

import type { Request, Response } from 'express'

const appBaseUrl = env.APP_URL.replace(/\/+$/, '')
const formatRedirect = (path: string) => `${appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

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

    return res.redirect(formatRedirect(redirectPath))
})

const connectSupabase = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = connectOAuthQuerySchema.parse(req.query)

    let userId = state
    let redirectPath = '/settings/connections'
    if (state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':') || '/settings/connections'
    }

    if (!userId && (req as any).user?.userId) {
        userId = (req as any).user.userId
    }

    if (userId) {
        await integrationsService.connectSupabase({
            userId,
            code,
        })
    }

    return res.redirect(formatRedirect(redirectPath))
})

const connectNotion = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = connectOAuthQuerySchema.parse(req.query)

    let userId = state
    let redirectPath = '/settings/connections'
    if (state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':') || '/settings/connections'
    }

    if (!userId && (req as any).user?.userId) {
        userId = (req as any).user.userId
    }

    if (userId) {
        await integrationsService.connectNotion({
            userId,
            code,
        })
    }

    return res.redirect(formatRedirect(redirectPath))
})

const connectGithub = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = connectOAuthQuerySchema.parse(req.query)

    if (state === 'auth') {
        return res.redirect(formatRedirect(`/github/callback?code=${code}`))
    }

    let userId = state
    let redirectPath = '/settings/repositories'
    if (state.includes(':')) {
        const parts = state.split(':')
        userId = parts[0] as string
        redirectPath = parts.slice(1).join(':') || '/settings/repositories'
    }

    if (!userId && (req as any).user?.userId) {
        userId = (req as any).user.userId
    }

    if (userId) {
        await integrationsService.handleGitHubOAuth({ code, userId })
    }

    return res.redirect(formatRedirect(redirectPath))
})

export const integrationsController = {
    connectVercel,
    connectSupabase,
    connectNotion,
    connectGithub,
}
