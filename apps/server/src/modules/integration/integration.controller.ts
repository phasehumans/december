import { env } from '../../env'
import { asyncHandler } from '../../shared/asyncHandler'

import { connectOAuthQuerySchema } from './integration.schema'
import { integrationsService } from './integration.service'

import type { Request, Response } from 'express'

const appBaseUrl = env.APP_URL.replace(/\/+$/, '')
const formatRedirect = (path: string) => `${appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

// A path on the web app: starts with one '/', no backslash and no control characters
// (browsers drop tabs and newlines, so '/\t/evil.com' would become '//evil.com')
// eslint-disable-next-line no-control-regex
const isSafePath = (path: string) => /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/.test(path)

const connectGithub = asyncHandler(async (req: Request, res: Response) => {
    const { code, state } = connectOAuthQuerySchema.parse(req.query)

    // login states are `auth` or `auth.<nonce>`: hand the code and state to the web callback
    if (state === 'auth' || state.startsWith('auth.')) {
        const params = new URLSearchParams({ code, state })
        return res.redirect(formatRedirect(`/github/callback?${params.toString()}`))
    }

    // Link the GitHub account only to the signed-in user (the auth cookie comes with GitHub's
    // redirect back). Anyone can write a state, so a user id in it is never trusted: the state
    // only carries the page to return to, as `<anything>:<path>`.
    const userId = req.user?.userId
    const statePath = state.includes(':') ? state.split(':').slice(1).join(':') : ''
    const redirectPath = isSafePath(statePath) ? statePath : '/settings/repositories'

    if (!userId) {
        const params = new URLSearchParams({ redirect: redirectPath })
        return res.redirect(formatRedirect(`/login?${params.toString()}`))
    }

    await integrationsService.handleGitHubOAuth({ code, userId })

    return res.redirect(formatRedirect(redirectPath))
})

export const integrationsController = {
    connectGithub,
}
