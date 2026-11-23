import crypto from 'crypto'

import { prisma } from '@december/database'
import { enqueueJob } from '@december/shared/queue'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { notificationService } from '../notification/notification.service'

import { githubAppRepository } from './githubapp.repository'
import {
    canClaimInstallation,
    createCommentReaction,
    createIssueReaction,
    createIssueComment,
    extractBotMention,
    generateAppJwt,
    getInstallationDetails,
    isAuthorizedGithubSender,
    isDecemberBotLogin,
    toInboxPreview,
} from './githubapp.utils'

import type {
    ClaimInstallation,
    ClaimInstallationResult,
    FindInstallationOwner,
    FindPullRequestOwner,
    GetInstallationAccessToken,
    GetUserInstallationRepos,
    GetUserInstallationStatus,
    GetUserInstallationToken,
    GithubInstallationRepo,
    GithubIssueJobData,
    HandleIssueComment,
    HandleIssueCommentResult,
    HandlePullRequestOpened,
    HandlePullRequestOpenedResult,
    InstallationStatusResponse,
    NotifyGithubActivity,
    ProcessInstallation,
    ProcessUninstallation,
    VerifySignature,
} from './githubapp.types'

const processInstallation = async (data: ProcessInstallation) => {
    const { installationId, userId, accountLogin, accountType, targetType, permissions } = data
    return githubAppRepository.upsertInstallation({
        installationId,
        userId,
        accountLogin,
        accountType,
        targetType,
        permissions,
    })
}

const claimInstallation = async (data: ClaimInstallation): Promise<ClaimInstallationResult> => {
    const { installationId, userId } = data

    const user = await githubAppRepository.findUserGithubId(userId)
    if (!user || user.isDeleted) {
        return { linked: false, reason: 'unverified' }
    }

    const existing = await githubAppRepository.findByInstallationId(installationId)
    const existingOwner = existing?.userId && existing.userId !== 'system' ? existing.userId : null

    // only ask github when the database alone cannot decide
    const details = existingOwner ? null : await getInstallationDetails(installationId)

    const decision = canClaimInstallation({
        existingUserId: existing?.userId,
        userId,
        userGithubId: user.githubId,
        details,
    })

    if (!decision.linked) {
        console.warn(
            `[githubapp] refused to link installation ${installationId} to user ${userId}: ${decision.reason}`
        )
        return decision
    }

    await githubAppRepository.upsertInstallation({
        installationId,
        userId,
        ...(details?.account?.login ? { accountLogin: details.account.login } : {}),
        ...(details?.account?.type ? { accountType: details.account.type } : {}),
        ...(details?.target_type ? { targetType: details.target_type } : {}),
        ...(details?.permissions ? { permissions: details.permissions } : {}),
    })

    return decision
}

// Webhook installs: find the December user by github id only. Usernames can be
// renamed and taken by someone else, so they never decide who owns access.
const findInstallationOwner = async (data: FindInstallationOwner): Promise<string | null> => {
    const { accountId, accountType, senderId } = data

    if (accountType === 'User' && accountId) {
        const owner = await githubAppRepository.findUserIdByGithubId(accountId)
        if (owner) return owner
    }

    return senderId ? githubAppRepository.findUserIdByGithubId(senderId) : null
}

const processUninstallation = async (data: ProcessUninstallation) => {
    const { installationId } = data
    return githubAppRepository.deleteInstallation(installationId)
}

const verifySignature = (data: VerifySignature): boolean => {
    const { payload, signature } = data
    const secret = env.GITHUB_APP_WEBHOOK_SECRET || (env.NODE_ENV !== 'production' ? 'secret' : '')
    if (!secret) {
        return false
    }
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(payload)
    const expected = `sha256=${hmac.digest('hex')}`
    if (signature.length !== expected.length) {
        return false
    }
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

const getInstallationAccessToken = async (
    data: GetInstallationAccessToken
): Promise<{ token: string; expiresAt: string }> => {
    const { installationId } = data
    const appJwt = generateAppJwt()

    const response = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${appJwt}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
            },
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new AppError(
            `Failed to create installation access token: ${errorText}`,
            response.status
        )
    }

    const json = (await response.json()) as any
    return {
        token: json.token,
        expiresAt: json.expires_at,
    }
}

const getUserInstallationToken = async (data: GetUserInstallationToken): Promise<string> => {
    const { userId, owner } = data
    let installation = null

    if (owner) {
        installation = await githubAppRepository.findByOwnerAndUser(owner, userId)
    }

    if (!installation && userId) {
        installation = await githubAppRepository.findByUserId(userId)
    }

    if (!installation) {
        throw new AppError('GitHub App is not installed for this account', 400)
    }

    const { token } = await getInstallationAccessToken({
        installationId: installation.installationId,
    })
    return token
}

const getUserInstallationRepos = async (
    data: GetUserInstallationRepos
): Promise<GithubInstallationRepo[]> => {
    const { userId, page: requestedPage, limit: requestedLimit, search } = data
    let installations = await githubAppRepository.findAllByUserId(userId)

    if (!installations || installations.length === 0) {
        const single = await githubAppRepository.findByUserId(userId)
        if (single) {
            installations = [single]
        } else {
            return []
        }
    }

    const allRepos: GithubInstallationRepo[] = []
    const seenRepoIds = new Set<number>()

    for (const installation of installations) {
        try {
            const { token } = await getInstallationAccessToken({
                installationId: installation.installationId,
            })

            let page = requestedPage || 1
            const perPage = requestedLimit ? Math.min(requestedLimit, 100) : 100
            let hasMore = true

            while (hasMore) {
                const response = await fetch(
                    `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
                    {
                        method: 'GET',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/vnd.github+json',
                            'X-GitHub-Api-Version': '2022-11-28',
                            'User-Agent': 'December-App',
                        },
                    }
                )

                if (!response.ok) {
                    break
                }

                const json = (await response.json()) as any
                const repositories = json.repositories || []

                for (const repo of repositories) {
                    if (
                        search &&
                        !repo.name.toLowerCase().includes(search.toLowerCase()) &&
                        !repo.full_name?.toLowerCase().includes(search.toLowerCase())
                    ) {
                        continue
                    }

                    if (!seenRepoIds.has(repo.id)) {
                        seenRepoIds.add(repo.id)
                        allRepos.push({
                            id: repo.id,
                            name: repo.name,
                            fullName: repo.full_name,
                            private: repo.private,
                            defaultBranch: repo.default_branch,
                            updatedAt: repo.updated_at,
                            htmlUrl: repo.html_url,
                            cloneUrl: repo.clone_url,
                            language: repo.language ?? null,
                            description: repo.description ?? null,
                            owner: {
                                login: repo.owner?.login,
                                avatarUrl: repo.owner?.avatar_url,
                            },
                        })
                    }
                }

                if (repositories.length < perPage || requestedPage !== undefined) {
                    hasMore = false
                } else {
                    page++
                }
            }
        } catch {
            // Intentionally swallowed: continue to next installation if one fails
        }
    }

    return allRepos
}

const getUserInstallationStatus = async (
    data: GetUserInstallationStatus
): Promise<InstallationStatusResponse> => {
    const { userId } = data
    const installation = await githubAppRepository.findByUserId(userId)

    if (!installation) {
        return {
            installed: false,
            installationId: null,
            accountLogin: null,
            accountType: null,
            targetType: null,
        }
    }

    return {
        installed: true,
        installationId: installation.installationId,
        accountLogin: installation.accountLogin,
        accountType: installation.accountType,
        targetType: installation.targetType,
    }
}

const handleIssueComment = async (data: HandleIssueComment): Promise<HandleIssueCommentResult> => {
    const { installationId, repository, issue, comment } = data

    const { isMentioned, instruction } = extractBotMention(comment.body)
    if (!isMentioned) {
        return { handled: false, reason: 'not_mentioned' }
    }

    const isAuthorized = isAuthorizedGithubSender(comment.authorAssociation)

    let token: string
    try {
        const tokenRes = await getInstallationAccessToken({ installationId })
        token = tokenRes.token
    } catch (err: any) {
        console.error('[GitHubApp Service] Failed to obtain installation access token:', err)
        return { handled: false, reason: 'token_error' }
    }

    if (!isAuthorized) {
        try {
            await createIssueComment({
                token,
                owner: repository.owner.login,
                repo: repository.name,
                issueNumber: issue.number,
                body: `@${comment.user.login} December is configured to only execute tasks requested by repository collaborators.`,
            })
        } catch {
            // Intentionally swallowed: fallback if unauthorized comment fails to post
        }
        return { handled: false, reason: 'unauthorized_sender' }
    }

    // Acknowledge immediately with an emoji reaction on the comment
    try {
        await createCommentReaction({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            commentId: comment.id,
            reaction: 'eyes',
        })
    } catch {
        // Intentionally swallowed: emoji reaction fallback
    }

    // Check installation and user wallet credits
    const installation = await githubAppRepository.findByInstallationId(installationId)
    const effectiveUserId = installation?.userId || null

    if (effectiveUserId) {
        const user = await prisma.user.findUnique({
            where: { id: effectiveUserId },
            select: { creditBalance: true },
        })

        if (user && user.creditBalance < 50) {
            try {
                await createIssueComment({
                    token,
                    owner: repository.owner.login,
                    repo: repository.name,
                    issueNumber: issue.number,
                    body: `@${comment.user.login} Insufficient wallet credits to run December on this issue. Please top up credits at https://app.trydecember.com/settings/billing to continue.`,
                })
            } catch {
                // Intentionally swallowed: credit warning comment fallback
            }
            return { handled: false, reason: 'insufficient_credits' }
        }
    }

    // Dispatch job to worker queue
    const jobData: GithubIssueJobData = {
        taskType: 'github_issue_fix',
        installationId,
        gitToken: token,
        repoFullName: repository.fullName,
        repoOwner: repository.owner.login,
        repoName: repository.name,
        defaultBranch: repository.defaultBranch || 'main',
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueBody: issue.body || '',
        commentId: comment.id,
        commentAuthor: comment.user.login,
        prompt: instruction,
        userId: effectiveUserId,
        isPullRequest: Boolean(issue.pullRequest),
        slackWebhookUrl: env.SLACK_WEBHOOK_URL,
        discordWebhookUrl: env.DISCORD_WEBHOOK_URL,
    }

    const job = await enqueueJob('github_issue_fix', jobData)

    return {
        handled: true,
        issueNumber: issue.number,
        jobId: job?.id?.toString(),
    }
}

const handlePullRequestOpened = async (
    data: HandlePullRequestOpened
): Promise<HandlePullRequestOpenedResult> => {
    const { installationId, repository, pullRequest } = data

    const { isMentioned, instruction } = extractBotMention(pullRequest.body || '')
    if (!isMentioned) {
        return { handled: false, reason: 'not_mentioned' }
    }

    const isAuthorized = isAuthorizedGithubSender(pullRequest.authorAssociation)

    let token: string
    try {
        const tokenRes = await getInstallationAccessToken({ installationId })
        token = tokenRes.token
    } catch (err: any) {
        console.error('[GitHubApp Service] Failed to obtain installation access token:', err)
        return { handled: false, reason: 'token_error' }
    }

    if (!isAuthorized) {
        try {
            await createIssueComment({
                token,
                owner: repository.owner.login,
                repo: repository.name,
                issueNumber: pullRequest.number,
                body: `@${pullRequest.user.login} December is configured to only execute tasks requested by repository collaborators.`,
            })
        } catch {
            // Intentionally swallowed: fallback if unauthorized comment fails to post
        }
        return { handled: false, reason: 'unauthorized_sender' }
    }

    // Acknowledge immediately with an emoji reaction on the pull request
    try {
        await createIssueReaction({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            issueNumber: pullRequest.number,
            reaction: 'eyes',
        })
    } catch {
        // Intentionally swallowed: emoji reaction fallback
    }

    // Check installation and user wallet credits
    const installation = await githubAppRepository.findByInstallationId(installationId)
    const effectiveUserId = installation?.userId || null

    if (effectiveUserId) {
        const user = await prisma.user.findUnique({
            where: { id: effectiveUserId },
            select: { creditBalance: true },
        })

        if (user && user.creditBalance < 50) {
            try {
                await createIssueComment({
                    token,
                    owner: repository.owner.login,
                    repo: repository.name,
                    issueNumber: pullRequest.number,
                    body: `@${pullRequest.user.login} Insufficient wallet credits to run December on this pull request. Please top up credits at https://app.trydecember.com/settings/billing to continue.`,
                })
            } catch {
                // Intentionally swallowed: credit warning comment fallback
            }
            return { handled: false, reason: 'insufficient_credits' }
        }
    }

    // Dispatch job to worker queue
    const jobData: GithubIssueJobData = {
        taskType: 'github_issue_fix',
        installationId,
        gitToken: token,
        repoFullName: repository.fullName,
        repoOwner: repository.owner.login,
        repoName: repository.name,
        defaultBranch: repository.defaultBranch || 'main',
        issueNumber: pullRequest.number,
        issueTitle: pullRequest.title,
        issueBody: pullRequest.body || '',
        commentAuthor: pullRequest.user.login,
        prompt: instruction,
        userId: effectiveUserId,
        isPullRequest: true,
        pullRequestHead: pullRequest.head?.ref,
        pullRequestBase: pullRequest.base?.ref || repository.defaultBranch || 'main',
        slackWebhookUrl: env.SLACK_WEBHOOK_URL,
        discordWebhookUrl: env.DISCORD_WEBHOOK_URL,
    }

    const job = await enqueueJob('github_issue_fix', jobData)

    return {
        handled: true,
        pullRequestNumber: pullRequest.number,
        jobId: job?.id?.toString(),
    }
}

// who owns December's pull request: the session that opened it, else (for PRs opened from an
// @trydecember issue comment, which have no session) the owner of the installation
const findPullRequestOwner = async (data: FindPullRequestOwner): Promise<string | null> => {
    const { installationId, repoOwner, repoName, prNumber, prAuthorLogin } = data
    const session = await githubAppRepository.findSessionByPullRequest({
        repoOwner,
        repoName,
        prNumber,
    })
    if (session?.userId) return session.userId
    if (installationId && isDecemberBotLogin(prAuthorLogin)) {
        const installation = await githubAppRepository.findByInstallationId(installationId)
        return installation?.userId ?? null
    }
    return null
}

// puts replies, review comments, @trydecember mentions and failed checks into the inbox (K2)
const notifyGithubActivity = async (data: NotifyGithubActivity) => {
    const {
        installationId,
        repoOwner,
        repoName,
        number,
        actorLogin,
        actorType,
        prAuthorLogin,
        activity,
    } = data

    // December's own comments and other bots (CI, dependabot) never notify
    if (actorType === 'Bot' || isDecemberBotLogin(actorLogin) || actorLogin?.endsWith('[bot]')) {
        return { notified: false, reason: 'bot' }
    }

    const repoLink = `https://github.com/${repoOwner}/${repoName}`
    const actor = actorLogin || 'someone'
    const send = async (input: {
        userId: string
        title: string
        message: string
        link: string
        category: 'GENERAL' | 'MENTION'
        type?: 'INFO' | 'WARNING' | 'ERROR'
        toast: boolean
    }) => {
        // your own comments on December's pull request are not news to you
        const username = await githubAppRepository.findUserGithubUsername(input.userId)
        if (username && actorLogin && username.toLowerCase() === actorLogin.toLowerCase()) {
            return { notified: false, reason: 'own_comment' }
        }
        await notificationService.sendNotificationToUser({
            userId: input.userId,
            title: input.title,
            message: input.message,
            link: input.link,
            category: input.category,
            type: input.type ?? 'INFO',
            toast: input.toast,
        })
        return { notified: true }
    }

    if (activity.kind === 'comment') {
        const { isMentioned } = extractBotMention(activity.body)
        if (isMentioned) {
            if (!installationId) return { notified: false, reason: 'no_installation' }
            const installation = await githubAppRepository.findByInstallationId(installationId)
            if (!installation?.userId) return { notified: false, reason: 'no_owner' }
            return send({
                userId: installation.userId,
                title: `${actor} mentioned December on #${number}`,
                message: toInboxPreview(activity.body),
                link: activity.url || `${repoLink}/issues/${number}`,
                category: 'MENTION',
                toast: true,
            })
        }
        if (!activity.isPullRequest) return { notified: false, reason: 'not_pull_request' }
    }

    if (activity.kind === 'review' && activity.state === 'commented' && !activity.body.trim()) {
        // an empty "commented" review only wraps review comments, which notify on their own
        return { notified: false, reason: 'empty_review' }
    }

    const userId = await findPullRequestOwner({
        installationId,
        repoOwner,
        repoName,
        prNumber: number,
        prAuthorLogin,
    })
    if (!userId) return { notified: false, reason: 'not_december_pull_request' }

    switch (activity.kind) {
        case 'comment':
        case 'review_comment': {
            return send({
                userId,
                title: `${actor} commented on #${number}`,
                message: toInboxPreview(activity.body),
                link: activity.url || `${repoLink}/pull/${number}`,
                category: 'MENTION',
                toast: true,
            })
        }
        case 'review': {
            const state = activity.state.toLowerCase()
            const title =
                state === 'changes_requested'
                    ? `${actor} requested changes on #${number}`
                    : state === 'approved'
                      ? `${actor} approved #${number}`
                      : `${actor} reviewed #${number}`
            const isApproval = state === 'approved'
            return send({
                userId,
                title,
                message: toInboxPreview(activity.body) || title,
                link: activity.url || `${repoLink}/pull/${number}`,
                category: isApproval ? 'GENERAL' : 'MENTION',
                type: state === 'changes_requested' ? 'WARNING' : 'INFO',
                toast: !isApproval,
            })
        }
        case 'checks_failed': {
            const title = `Checks failed on #${number}`
            const since = new Date(Date.now() - 30 * 60 * 1000)
            if (await githubAppRepository.hasUnreadNotification({ userId, title, since })) {
                return { notified: false, reason: 'duplicate' }
            }
            await notificationService.sendNotificationToUser({
                userId,
                title,
                message: `${repoOwner}/${repoName}: one or more checks failed on the latest push.`,
                link: `${repoLink}/pull/${number}/checks`,
                category: 'GENERAL',
                type: 'ERROR',
                toast: false,
            })
            return { notified: true }
        }
        default:
            return { notified: false, reason: 'unknown' }
    }
}

export const githubAppService = {
    claimInstallation,
    findInstallationOwner,
    processInstallation,
    processUninstallation,
    verifySignature,
    getInstallationAccessToken,
    getUserInstallationToken,
    getUserInstallationRepos,
    getUserInstallationStatus,
    handleIssueComment,
    handlePullRequestOpened,
    notifyGithubActivity,
}
