import crypto from 'node:crypto'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import {
    connectOAuthQuerySchema,
    gitlabCallbackQuerySchema,
    gitlabStartQuerySchema,
} from './integration.schema'
import { integrationsService } from './integration.service'
import {
    GITLAB_COOKIE_PATH,
    GITLAB_STATE_COOKIE,
    GITLAB_STATE_MAX_AGE_MS,
    withQuery,
} from './integration.utils'

import type { Request, Response } from 'express'

const appBaseUrl = env.APP_URL.replace(/\/+$/, '')
const formatRedirect = (path: string) => `${appBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

// A path on the web app: starts with one '/', no backslash and no control characters
// (browsers drop tabs and newlines, so '/\t/evil.com' would become '//evil.com')
// eslint-disable-next-line no-control-regex
const isSafePath = (path: string) => /^\/(?![/\\])[^\\\u0000-\u001f\u007f]*$/.test(path)

const connectGithub = asyncHandler(async (req: Request, res: Response) => {
    // github sends an install with user authorization (V1) to the app's callback url: hand
    // it to the install callback with the same query
    if (typeof req.query.installation_id === 'string') {
        const query = new URLSearchParams()
        for (const key of ['installation_id', 'setup_action', 'state', 'code']) {
            const value = req.query[key]
            if (typeof value === 'string') query.set(key, value)
        }
        return res.redirect(`/api/v1/githubapp/callback?${query.toString()}`)
    }

    const { code, state } = connectOAuthQuerySchema.parse(req.query)

    // login states are `auth` or `auth.<nonce>`: hand the code and state to the web callback
    if (state === 'auth' || state.startsWith('auth.')) {
        const params = new URLSearchParams({ code, state })
        return res.redirect(formatRedirect(`/github/callback?${params.toString()}`))
    }

    // anything else is not a December sign-in (V2): the app connects GitHub through the
    // GitHub App install, so an OAuth code here is never linked to the signed-in account.
    // a link someone else wrote could otherwise attach their GitHub to this account
    return res.redirect(formatRedirect('/settings/repositories'))
})

const DEFAULT_GITLAB_RETURN = '/settings/repositories'

const gitlabCookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: GITLAB_COOKIE_PATH,
}

// GET /gitlab/start?redirect=<web path>: the browser goes here, then on to gitlab.com
const startGitlab = asyncHandler(async (req: Request, res: Response) => {
    const { redirect } = gitlabStartQuerySchema.parse(req.query)
    const returnPath = redirect && isSafePath(redirect) ? redirect : DEFAULT_GITLAB_RETURN

    if (!req.user?.userId) {
        const params = new URLSearchParams({ redirect: returnPath })
        return res.redirect(formatRedirect(`/login?${params.toString()}`))
    }

    // the nonce goes to gitlab in the state and stays in this browser in a cookie, so a
    // callback that another site started does not link an account
    const nonce = crypto.randomBytes(24).toString('base64url')
    const url = await integrationsService.getGitlabAuthorizeUrl({ state: `${nonce}:${returnPath}` })

    res.cookie(GITLAB_STATE_COOKIE, nonce, {
        ...gitlabCookieOptions,
        maxAge: GITLAB_STATE_MAX_AGE_MS,
    })
    return res.redirect(url)
})

// GET /gitlab/callback?code&state: gitlab sends the browser back here
const gitlabCallback = asyncHandler(async (req: Request, res: Response) => {
    const { code, state = '' } = gitlabCallbackQuerySchema.parse(req.query)
    const separator = state.indexOf(':')
    const nonce = separator > 0 ? state.slice(0, separator) : ''
    const statePath = separator > 0 ? state.slice(separator + 1) : ''
    const returnPath = isSafePath(statePath) ? statePath : DEFAULT_GITLAB_RETURN
    const expected = req.cookies?.[GITLAB_STATE_COOKIE]

    res.clearCookie(GITLAB_STATE_COOKIE, gitlabCookieOptions)
    const fail = (reason: string) =>
        res.redirect(formatRedirect(withQuery(returnPath, 'gitlab', reason)))

    if (!req.user?.userId) {
        const params = new URLSearchParams({ redirect: returnPath })
        return res.redirect(formatRedirect(`/login?${params.toString()}`))
    }

    // no code: the user pressed "deny" on gitlab
    if (!code || !nonce || !expected || nonce !== expected) {
        return fail('error')
    }

    try {
        await integrationsService.connectGitlab({ code, userId: req.user.userId })
    } catch (error) {
        if (error instanceof AppError && error.statusCode === 409) return fail('in_use')
        console.error('GitLab connect failed:', error instanceof Error ? error.message : error)
        return fail('error')
    }

    return res.redirect(formatRedirect(returnPath))
})

const getGitlabStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    const result = await integrationsService.getGitlabStatus({ userId })
    return sendSuccess(res, 'gitlab status fetched successfully', result)
})

const disconnectGitlab = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.userId
    if (!userId) {
        throw new AppError('unauthorized', 401)
    }

    await integrationsService.disconnectGitlab({ userId })
    return sendSuccess(res, 'gitlab disconnected successfully')
})

export const integrationsController = {
    connectGithub,
    startGitlab,
    gitlabCallback,
    getGitlabStatus,
    disconnectGitlab,
}
