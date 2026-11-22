import jwt from 'jsonwebtoken'

import { env } from '../../env'

import type {
    CanClaimInstallation,
    ClaimInstallationResult,
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

export {
    extractBotMention,
    isAuthorizedGithubSender,
    createCommentReaction,
    createIssueReaction,
    createIssueComment,
    createPullRequest,
} from '@december/shared'
