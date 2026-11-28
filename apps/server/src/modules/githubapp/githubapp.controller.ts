import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { listInstallationReposQuerySchema } from './githubapp.schema'
import { githubAppService } from './githubapp.service'
import {
    resolveInstallReturnUrl,
    toGithubActivity,
    toInstallProblem,
    toLocalCallbackUrl,
    withInstallProblem,
    toPullRequestStateEvent,
    toWebhookRepository,
} from './githubapp.utils'

import type { InstallProblem } from './githubapp.types'
import type { Request, Response } from 'express'

const startInstall = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id
    if (!userId) {
        throw new AppError('Unauthorized', 401)
    }

    const appName = env.GITHUB_APP_NAME || 'trydecember'
    const returnUrl = (req.query.returnUrl as string) || '/settings/repositories'
    const state = encodeURIComponent(`${userId}|${returnUrl}`)

    return res.redirect(`https://github.com/apps/${appName}/installations/new?state=${state}`)
})

const handleCallback = asyncHandler(async (req: Request, res: Response) => {
    const installationId = req.query.installation_id as string
    const state = req.query.state as string

    // state is `<userId>|<returnUrl>` or just `<returnUrl>`. Only the return url
    // is used: anyone can write a state, so the user comes from the auth cookie.
    let returnUrl = '/settings/repositories'
    if (state) {
        const decoded = decodeURIComponent(state)
        const separator = decoded.indexOf('|')
        const statePath = separator === -1 ? decoded : decoded.slice(separator + 1)
        if (statePath) {
            returnUrl = statePath
        }
    }

    const setupAction = req.query.setup_action as string | undefined
    // the user authorization code github adds to an install (V1): the proof the user can see it
    const code = typeof req.query.code === 'string' ? req.query.code : undefined
    const localCallback = toLocalCallbackUrl({
        returnUrl,
        installationId,
        setupAction,
        state,
        code,
    })
    if (localCallback) {
        return res.redirect(localCallback)
    }

    const userId: string | undefined = (req as any).user?.userId
    let problem: InstallProblem | null = null
    if (installationId && userId) {
        const result = await githubAppService.claimInstallation({
            installationId: installationId.toString(),
            userId,
            code,
        })
        problem = toInstallProblem(result)
    } else if (installationId) {
        problem = 'signed_out'
    } else if (setupAction === 'request') {
        // an organisation member asked for the install: an owner must approve it on github
        problem = 'requested'
    }

    const redirectTarget = withInstallProblem(resolveInstallReturnUrl({ returnUrl }), problem)

    return res.redirect(redirectTarget)
})

const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-hub-signature-256'] as string
    if (!signature) {
        throw new AppError('Missing signature', 401)
    }

    const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body)

    if (!githubAppService.verifySignature({ payload: rawBody, signature })) {
        throw new AppError('Invalid signature', 401)
    }

    const payload =
        typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody)
    const event = req.headers['x-github-event']

    if (event === 'installation' && payload.action === 'created') {
        const installationId = payload.installation.id.toString()
        const accountLogin = payload.installation.account?.login
        const accountType = payload.installation.account?.type
        const targetType = payload.installation.target_type
        const permissions = payload.installation.permissions

        const userId = await githubAppService.findInstallationOwner({
            accountId: payload.installation.account?.id?.toString(),
            accountType,
            senderId: payload.sender?.id?.toString(),
        })

        await githubAppService.processInstallation({
            installationId,
            userId,
            ...(accountLogin ? { accountLogin } : {}),
            ...(accountType ? { accountType } : {}),
            ...(targetType ? { targetType } : {}),
            ...(permissions ? { permissions } : {}),
        })
    } else if (event === 'installation' && payload.action === 'deleted') {
        const installationId = payload.installation.id.toString()
        await githubAppService.processUninstallation({ installationId })
    } else if (event === 'installation' && payload.action === 'suspend') {
        // the row stays: an unsuspend makes it work again
        const installationId = payload.installation.id.toString()
        await githubAppService.notifyInstallationLost({ installationId, reason: 'suspended' })
    } else if (event === 'issue_comment' && payload.action === 'created') {
        const installationId = payload.installation?.id?.toString()
        if (installationId) {
            await githubAppService.handleIssueComment({
                installationId,
                repository: toWebhookRepository(payload),
                issue: {
                    number: payload.issue?.number,
                    title: payload.issue?.title,
                    body: payload.issue?.body,
                    pullRequest: payload.issue?.pull_request,
                },
                comment: {
                    id: payload.comment?.id,
                    body: payload.comment?.body,
                    user: {
                        login: payload.comment?.user?.login,
                        id: payload.comment?.user?.id,
                        type: payload.comment?.user?.type,
                    },
                    authorAssociation: payload.comment?.author_association || 'NONE',
                },
            })
        }
    } else if (
        event === 'pull_request' &&
        ['opened', 'synchronize', 'ready_for_review'].includes(payload.action)
    ) {
        const installationId = payload.installation?.id?.toString()
        if (installationId) {
            await githubAppService.handlePullRequestEvent({
                installationId,
                action: payload.action,
                repository: toWebhookRepository(payload),
                pullRequest: {
                    number: payload.pull_request?.number,
                    title: payload.pull_request?.title,
                    body: payload.pull_request?.body,
                    draft: Boolean(payload.pull_request?.draft),
                    head: {
                        ref: payload.pull_request?.head?.ref,
                        sha: payload.pull_request?.head?.sha,
                        repoFullName: payload.pull_request?.head?.repo?.full_name,
                    },
                    base: {
                        ref: payload.pull_request?.base?.ref || 'main',
                    },
                    user: {
                        login: payload.pull_request?.user?.login || '',
                        type: payload.pull_request?.user?.type,
                    },
                    authorAssociation: payload.pull_request?.author_association || 'NONE',
                },
            })
        }
    } else if (event === 'pull_request_review_comment' && payload.action === 'created') {
        const installationId = payload.installation?.id?.toString()
        if (installationId) {
            await githubAppService.handleReviewComment({
                installationId,
                repository: toWebhookRepository(payload),
                pullRequest: {
                    number: payload.pull_request?.number,
                    title: payload.pull_request?.title,
                    body: payload.pull_request?.body,
                    authorLogin: payload.pull_request?.user?.login,
                    head: {
                        ref: payload.pull_request?.head?.ref,
                        sha: payload.pull_request?.head?.sha,
                        repoFullName: payload.pull_request?.head?.repo?.full_name,
                    },
                    base: {
                        ref: payload.pull_request?.base?.ref || 'main',
                    },
                },
                comment: {
                    id: payload.comment?.id,
                    body: payload.comment?.body || '',
                    path: payload.comment?.path,
                    line: payload.comment?.line ?? null,
                    diffHunk: payload.comment?.diff_hunk,
                    user: {
                        login: payload.comment?.user?.login,
                        type: payload.comment?.user?.type,
                    },
                    authorAssociation: payload.comment?.author_association || 'NONE',
                },
            })
        }
    } else if (event === 'check_suite' && payload.action === 'completed') {
        const installationId = payload.installation?.id?.toString()
        if (installationId) {
            await githubAppService.handleCheckSuite({
                installationId,
                repository: toWebhookRepository(payload),
                conclusion: payload.check_suite?.conclusion,
                headSha: payload.check_suite?.head_sha,
                pullRequestNumbers: (payload.check_suite?.pull_requests || [])
                    .map((pr: any) => pr?.number)
                    .filter((n: unknown): n is number => typeof n === 'number'),
            })
        }
    }

    // the saved pull request state on december sessions (#632); never fails the webhook
    const stateEvent = toPullRequestStateEvent(event, payload)
    if (stateEvent) {
        try {
            await githubAppService.syncPullRequestState(stateEvent)
        } catch (err) {
            console.error('[GitHubApp Webhook] pull request state sync failed:', err)
        }
    }

    // inbox notices (replies, reviews, mentions, failed checks) never fail the webhook
    const activity = toGithubActivity(event, payload)
    if (activity) {
        try {
            await githubAppService.notifyGithubActivity(activity)
        } catch (err) {
            console.error('[GitHubApp Webhook] inbox notification failed:', err)
        }
    }

    return sendSuccess(res, 'webhook processed successfully', null)
})

const getRepos = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id
    if (!userId) {
        throw new AppError('Unauthorized', 401)
    }

    const { page, limit, search } = listInstallationReposQuerySchema.parse(req.query)

    // the cli reads a plain list here
    const { repos } = await githubAppService.getUserInstallationRepos({
        userId,
        page,
        limit,
        search,
    })
    return sendSuccess(res, 'repositories retrieved successfully', repos)
})

const getStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId || (req as any).user?.id
    if (!userId) {
        throw new AppError('Unauthorized', 401)
    }

    const status = await githubAppService.getUserInstallationStatus({ userId })
    return sendSuccess(res, 'installation status retrieved successfully', status)
})

export const githubAppController = {
    startInstall,
    handleCallback,
    handleWebhook,
    getRepos,
    getStatus,
}
