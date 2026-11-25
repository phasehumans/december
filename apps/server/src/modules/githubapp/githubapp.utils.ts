import jwt from 'jsonwebtoken'

import { env } from '../../env'

import type {
    PullRequestStateEvent,
    BuildGithubRunPrompt,
    CanClaimInstallation,
    ClaimInstallationResult,
    NotifyGithubActivity,
    ResolveInstallReturnUrl,
    ShouldAutoReview,
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

// the repository part of a webhook payload
export const toWebhookRepository = (payload: any) => ({
    name: payload?.repository?.name,
    fullName: payload?.repository?.full_name,
    owner: {
        login: payload?.repository?.owner?.login,
    },
    defaultBranch: payload?.repository?.default_branch || 'main',
    private: payload?.repository?.private ?? false,
})

// the session page on the web app
export const sessionLink = (sessionId: string) =>
    `${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/session/${sessionId}`

const MAX_BODY = 8000

const clip = (text: string, max = MAX_BODY) =>
    text.length > max ? `${text.slice(0, max)}\n[cut at ${max} characters]` : text

/**
 * Whether a pull request event starts an automatic review. "asked" never does: a review
 * then needs "@trydecember review". Drafts, December's own pull requests and bots are skipped.
 */
export const shouldAutoReview = (data: ShouldAutoReview): boolean => {
    const { settings, action, draft, authorLogin, authorType, ownerGithubLogin, repoFullName } =
        data

    if (settings.autoReview === 'asked' || !settings.githubCommentsEnabled) return false
    if (!['opened', 'ready_for_review', 'synchronize'].includes(action)) return false
    if (action === 'synchronize' && settings.reviewCadence !== 'push') return false
    if (draft) return false
    if (authorType === 'Bot' || isDecemberBotLogin(authorLogin) || authorLogin.endsWith('[bot]')) {
        return false
    }
    if (
        settings.reviewRepos.length > 0 &&
        !settings.reviewRepos.includes(repoFullName.toLowerCase())
    ) {
        return false
    }
    if (settings.autoReview === 'mine') {
        return Boolean(
            ownerGithubLogin && ownerGithubLogin.toLowerCase() === authorLogin.toLowerCase()
        )
    }
    return true
}

/** the first prompt of a github run: what to do, and what December does after the agent */
export const buildGithubRunPrompt = (data: BuildGithubRunPrompt): string => {
    const { run, body, instruction, context } = data
    const where = `${run.repoFullName}`
    const request = instruction.trim()
    const from = run.requestedBy === 'december' ? 'December settings' : `@${run.requestedBy}`

    if (run.mode === 'review') {
        return [
            `Review pull request #${run.number} in ${where}: "${run.title}" (base branch ${run.baseRef}).`,
            '',
            'Pull request description:',
            clip(body.trim() || 'No description.'),
            '',
            ...(request ? [`Extra request from ${from}:`, clip(request), ''] : []),
            'How to review:',
            `- /workspace has the pull request checked out. See the change with \`git diff origin/${run.baseRef}...HEAD\`.`,
            '- Read the code around the change where you need to. You can run the tests. Do not change, commit or push files.',
            '- Look for bugs, security problems, missing tests and unclear code. Skip style points that a formatter or linter finds.',
            '- Write the review as JSON to /workspace/.december/review.json:',
            '  {"summary": "2 to 6 sentences", "comments": [{"path": "src/a.ts", "line": 42, "body": "what is wrong and how to fix it"}]}',
            '  "line" is a line number in the new version of the file, on a line that the diff adds or changes. Give at most 10 comments. Use an empty list when there is nothing to point at.',
            '- End with the same summary.',
            '- Do not use em dashes.',
        ].join('\n')
    }

    const subject =
        run.mode === 'issue'
            ? `GitHub issue #${run.number} in ${where}: "${run.title}".`
            : `pull request #${run.number} in ${where}: "${run.title}" (branch ${run.headRef}, base ${run.baseRef}).`
    const after =
        run.mode === 'issue'
            ? 'It goes into the pull request description.'
            : 'It goes into a reply on the pull request.'

    return [
        `You are working on ${subject}`,
        '',
        run.mode === 'issue' ? 'Issue description:' : 'Pull request description:',
        clip(body.trim() || 'No description.'),
        '',
        `Request from ${from}:`,
        clip(request || 'Do what the description asks.'),
        '',
        ...(context ? [clip(context, 4000), ''] : []),
        'How to work:',
        run.mode === 'issue'
            ? `- The repository is in /workspace on a new branch from ${run.baseRef}.`
            : `- The repository is in /workspace on the pull request branch ${run.headRef}.`,
        "- Make the change. Find the repository's own test command (package.json scripts, Makefile, pytest, go test, cargo test) and run it. Fix what fails.",
        '- Do not commit, push or open a pull request. December does that when you finish.',
        '- If the request is only a question, answer it and do not change files.',
        `- End with a short summary of what you changed and why. ${after}`,
        '- Do not use em dashes.',
    ].join('\n')
}

/** the session title for a github run */
export const toGithubRunTitle = (data: { mode: string; number: number; title: string }) => {
    const { mode, number, title } = data
    const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80)
    return mode === 'review' ? `Review #${number} ${clean}` : `#${number} ${clean}`
}

export {
    extractBotMention,
    parseBotCommand,
    getPullRequest,
    listFailedCheckRuns,
    isAuthorizedGithubSender,
    createCommentReaction,
    createIssueReaction,
    createIssueComment,
    createPullRequest,
    createReviewCommentReaction,
} from '@december/shared'

// pull_request actions that change the state december saves on a session (#632)
const PULL_REQUEST_STATE_ACTIONS = [
    'opened',
    'closed',
    'reopened',
    'converted_to_draft',
    'ready_for_review',
    'edited',
    'synchronize',
]

/** the new state of a pull request from a pull_request webhook, or null for other events */
export const toPullRequestStateEvent = (
    event: unknown,
    payload: any
): PullRequestStateEvent | null => {
    if (event !== 'pull_request' || !PULL_REQUEST_STATE_ACTIONS.includes(payload?.action)) {
        return null
    }
    const pr = payload?.pull_request
    const repoOwner = payload?.repository?.owner?.login
    const repoName = payload?.repository?.name
    if (!pr || typeof pr.number !== 'number' || !repoOwner || !repoName) return null

    const state: PullRequestStateEvent['state'] = pr.merged_at
        ? 'merged'
        : pr.state === 'closed'
          ? 'closed'
          : pr.draft
            ? 'draft'
            : 'open'

    return {
        gitProvider: 'GITHUB',
        repoOwner,
        repoName,
        number: pr.number,
        state,
        ...(typeof pr.title === 'string' ? { title: pr.title } : {}),
        ...(typeof pr.additions === 'number' ? { additions: pr.additions } : {}),
        ...(typeof pr.deletions === 'number' ? { deletions: pr.deletions } : {}),
        openedAt: pr.created_at ?? null,
        mergedAt: pr.merged_at ?? null,
        closedAt: pr.closed_at ?? null,
    }
}
