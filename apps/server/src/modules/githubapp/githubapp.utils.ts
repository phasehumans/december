import jwt from 'jsonwebtoken'

import { env } from '../../env'

import type {
    CanClaimInstallation,
    ClaimInstallationResult,
    NotifyGithubActivity,
    ResolveInstallReturnUrl,
} from './githubapp.types'

export const generateAppJwt = (): string => {
    if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
        if (env.NODE_ENV === 'test') {
            return 'mock_test_jwt'
        }
        throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be configured')
    }

    const now = Math.floor(Date.now() / 1000)
    const payload = {
        iat: now - 60,
        exp: now + 10 * 60,
        iss: env.GITHUB_APP_ID,
    }

    const formattedKey = env.GITHUB_APP_PRIVATE_KEY.includes('-----BEGIN')
        ? env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n')
        : Buffer.from(env.GITHUB_APP_PRIVATE_KEY, 'base64').toString('utf8')

    return jwt.sign(payload, formattedKey, { algorithm: 'RS256' })
}

export const getInstallationDetails = async (installationId: string): Promise<any | null> => {
    try {
        if (env.NODE_ENV === 'test') {
            return null
        }

        const appJwt = generateAppJwt()
        const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
            },
            signal: AbortSignal.timeout(3000),
        })

        if (!response.ok) {
            return null
        }

        return await response.json()
    } catch {
        // Intentionally swallowed: return null if installation details fetch fails
        return null
    }
}

const DEFAULT_INSTALL_RETURN_PATH = '/settings/repositories'

// Where to send the user after a GitHub App install. The return url comes from
// `state`, which anyone can write, so absolute urls must point at our own hosts.
export const resolveInstallReturnUrl = (data: ResolveInstallReturnUrl): string => {
    const {
        returnUrl,
        appUrl = env.APP_URL || 'https://app.trydecember.com',
        isProduction = env.NODE_ENV === 'production',
    } = data
    const baseAppUrl = appUrl.replace(/\/+$/, '')

    if (!/^https?:\/\//i.test(returnUrl)) {
        // relative paths stay on our app: the base url fixes the host
        return `${baseAppUrl}${returnUrl.startsWith('/') ? returnUrl : `/${returnUrl}`}`
    }

    try {
        const { hostname, protocol } = new URL(returnUrl)
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
        const appHostname = new URL(baseAppUrl).hostname
        const isOwnHost =
            hostname === appHostname ||
            hostname === 'trydecember.com' ||
            hostname.endsWith('.trydecember.com')

        if ((isLocal && !isProduction) || (isOwnHost && protocol === 'https:')) {
            return returnUrl
        }
    } catch {
        // Intentionally swallowed: an invalid url falls back to the default page
    }

    return `${baseAppUrl}${DEFAULT_INSTALL_RETURN_PATH}`
}

// An installation we cannot tie to the user by github id can only be claimed
// right after it was created, so an old unclaimed one cannot be taken later.
const CLAIM_WINDOW_MS = 60 * 60 * 1000

// The install callback URL can be called by anyone with any installation_id,
// so linking needs proof that the signed-in user owns the installation.
export const canClaimInstallation = (data: CanClaimInstallation): ClaimInstallationResult => {
    const { existingUserId, userId, userGithubId, details, now = new Date() } = data

    const existingOwner = existingUserId && existingUserId !== 'system' ? existingUserId : null
    if (existingOwner === userId) return { linked: true, reason: 'already_owned' }
    if (existingOwner) return { linked: false, reason: 'owned_by_other_user' }

    if (!details) return { linked: false, reason: 'unverified' }

    const account = details.account
    if (account?.type === 'User' && userGithubId) {
        return String(account.id) === userGithubId
            ? { linked: true, reason: 'account_matches' }
            : { linked: false, reason: 'account_mismatch' }
    }

    // organisation installs, or users who signed up without github
    const createdAt = details.created_at ? Date.parse(details.created_at) : NaN
    const isRecent =
        Number.isFinite(createdAt) &&
        now.getTime() - createdAt <= CLAIM_WINDOW_MS &&
        createdAt <= now.getTime() + 60 * 1000
    return isRecent
        ? { linked: true, reason: 'recent_unclaimed' }
        : { linked: false, reason: 'stale_unclaimed' }
}

// December's own app account (comments it writes must not notify anyone)
export const isDecemberBotLogin = (login?: string | null) => {
    if (!login) return false
    const name = (env.GITHUB_APP_NAME || 'trydecember').toLowerCase()
    const lower = login.toLowerCase()
    return lower === name || lower === `${name}[bot]` || /^trydecember(\[bot\])?$/.test(lower)
}

// a comment body as one short line for the inbox row
export const toInboxPreview = (body?: string | null, max = 280) => {
    const text = (body || '').replace(/\s+/g, ' ').trim()
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// maps a webhook to an inbox notice, or null when the event never notifies
export const toGithubActivity = (event: unknown, payload: any): NotifyGithubActivity | null => {
    const repoOwner = payload?.repository?.owner?.login
    const repoName = payload?.repository?.name
    const installationId = payload?.installation?.id?.toString()
    if (!repoOwner || !repoName) return null

    if (event === 'issue_comment' && payload.action === 'created' && payload.issue?.number) {
        return {
            installationId,
            repoOwner,
            repoName,
            number: payload.issue.number,
            actorLogin: payload.comment?.user?.login,
            actorType: payload.comment?.user?.type,
            prAuthorLogin: payload.issue?.user?.login,
            activity: {
                kind: 'comment',
                isPullRequest: Boolean(payload.issue?.pull_request),
                body: payload.comment?.body || '',
                url: payload.comment?.html_url,
            },
        }
    }

    if (
        event === 'pull_request_review_comment' &&
        payload.action === 'created' &&
        payload.pull_request?.number
    ) {
        return {
            installationId,
            repoOwner,
            repoName,
            number: payload.pull_request.number,
            actorLogin: payload.comment?.user?.login,
            actorType: payload.comment?.user?.type,
            prAuthorLogin: payload.pull_request?.user?.login,
            activity: {
                kind: 'review_comment',
                body: payload.comment?.body || '',
                path: payload.comment?.path,
                url: payload.comment?.html_url,
            },
        }
    }

    if (
        event === 'pull_request_review' &&
        payload.action === 'submitted' &&
        payload.pull_request?.number
    ) {
        return {
            installationId,
            repoOwner,
            repoName,
            number: payload.pull_request.number,
            actorLogin: payload.review?.user?.login,
            actorType: payload.review?.user?.type,
            prAuthorLogin: payload.pull_request?.user?.login,
            activity: {
                kind: 'review',
                state: payload.review?.state || 'commented',
                body: payload.review?.body || '',
                url: payload.review?.html_url,
            },
        }
    }

    // check_suite has no PR author; the owner is found through the session only
    if (
        event === 'check_suite' &&
        payload.action === 'completed' &&
        ['failure', 'timed_out'].includes(payload.check_suite?.conclusion)
    ) {
        const prNumber = payload.check_suite?.pull_requests?.[0]?.number
        if (!prNumber) return null
        return {
            installationId,
            repoOwner,
            repoName,
            number: prNumber,
            activity: { kind: 'checks_failed' },
        }
    }

    return null
}

export {
    extractBotMention,
    isAuthorizedGithubSender,
    createCommentReaction,
    createIssueReaction,
    createIssueComment,
    createPullRequest,
} from '@december/shared'
