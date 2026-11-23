import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { asyncHandler } from '../../shared/asyncHandler'
import { sendSuccess } from '../../shared/response'

import { githubAppService } from './githubapp.service'
import { toGithubActivity } from './githubapp.utils'
import { resolveInstallReturnUrl } from './githubapp.utils'

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

    const userId: string | undefined = (req as any).user?.userId
    if (installationId && userId) {
        await githubAppService.claimInstallation({
            installationId: installationId.toString(),
            userId,
        })
    }

    const redirectTarget = resolveInstallReturnUrl({ returnUrl })

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
    } else if (event === 'issue_comment' && payload.action === 'created') {
        const installationId = payload.installation?.id?.toString()
        if (installationId) {
            await githubAppService.handleIssueComment({
                installationId,
                repository: {
                    name: payload.repository?.name,
                    fullName: payload.repository?.full_name,
                    owner: {
                        login: payload.repository?.owner?.login,
                    },
                    defaultBranch: payload.repository?.default_branch || 'main',
                    private: payload.repository?.private ?? false,
                },
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
                    },
                    authorAssociation: payload.comment?.author_association || 'NONE',
                },
            })
        }
    } else if (event === 'pull_request' && payload.action === 'opened') {
        const installationId = payload.installation?.id?.toString()
        if (installationId) {
            await githubAppService.handlePullRequestOpened({
                installationId,
                repository: {
                    name: payload.repository?.name,
                    fullName: payload.repository?.full_name,
                    owner: {
                        login: payload.repository?.owner?.login,
                    },
                    defaultBranch: payload.repository?.default_branch || 'main',
                    private: payload.repository?.private ?? false,
                },
                pullRequest: {
                    number: payload.pull_request?.number,
                    title: payload.pull_request?.title,
                    body: payload.pull_request?.body,
                    head: {
                        ref: payload.pull_request?.head?.ref,
                        sha: payload.pull_request?.head?.sha,
                    },
                    base: {
                        ref: payload.pull_request?.base?.ref || 'main',
                    },
                    user: {
                        login: payload.pull_request?.user?.login,
                        id: payload.pull_request?.user?.id,
                    },
                    authorAssociation: payload.pull_request?.author_association || 'NONE',
                },
            })
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

    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
    const search = (req.query.search as string) || undefined

    const repos = await githubAppService.getUserInstallationRepos({ userId, page, limit, search })
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
