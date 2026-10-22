import { env } from '../../env'
import { asyncHandler } from '../../shared/asyncHandler'

import { connectOAuthQuerySchema } from './integration.schema'
import { integrationsService } from './integration.service'

import type { Request, Response } from 'express'

const appBaseUrl = env.APP_URL.replace(/\/+$/, '')
const formatRedirect = (path: string) => `${appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

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
    connectGithub,
}
