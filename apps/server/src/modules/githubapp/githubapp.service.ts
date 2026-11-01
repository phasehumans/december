import crypto from 'crypto'

import { prisma } from '@december/database'
import { enqueueJob } from '@december/shared/queue'

import { env } from '../../env'
import { AppError } from '../../shared/appError'

import { githubAppRepository } from './githubapp.repository'
import {
    createCommentReaction,
    createIssueComment,
    extractBotMention,
    generateAppJwt,
    isAuthorizedGithubSender,
} from './githubapp.utils'

import type {
    GetInstallationAccessToken,
    GetUserInstallationRepos,
    GetUserInstallationStatus,
    GetUserInstallationToken,
    GithubInstallationRepo,
    GithubIssueJobData,
    HandleIssueComment,
    HandleIssueCommentResult,
    InstallationStatusResponse,
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

    let token = ''
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
    }

    const job = await enqueueJob('github_issue_fix', jobData)

    return {
        handled: true,
        issueNumber: issue.number,
        jobId: job?.id?.toString(),
    }
}

export const githubAppService = {
    processInstallation,
    processUninstallation,
    verifySignature,
    getInstallationAccessToken,
    getUserInstallationToken,
    getUserInstallationRepos,
    getUserInstallationStatus,
    handleIssueComment,
}
