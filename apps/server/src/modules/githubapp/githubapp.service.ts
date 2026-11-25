import crypto from 'crypto'

import { toPullRequestSettings } from '@december/shared'
import { enqueueJob } from '@december/shared/queue'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { notificationService } from '../notification/notification.service'
import { secretsService } from '../secrets/secrets.service'
import { sessionService } from '../session/session.service'

import { githubAppRepository } from './githubapp.repository'
import {
    buildGithubRunPrompt,
    canClaimInstallation,
    createCommentReaction,
    createIssueComment,
    createReviewCommentReaction,
    extractBotMention,
    generateAppJwt,
    getInstallationDetails,
    getPullRequest,
    isAuthorizedGithubSender,
    isDecemberBotLogin,
    listFailedCheckRuns,
    parseBotCommand,
    sessionLink,
    shouldAutoReview,
    toGithubRunTitle,
    toInboxPreview,
} from './githubapp.utils'

import type {
    PullRequestStateEvent,
    ClaimInstallation,
    ClaimInstallationResult,
    FindInstallationOwner,
    FindPullRequestOwner,
    GetInstallationAccessToken,
    GetUserInstallationRepos,
    GetUserInstallationStatus,
    GetUserInstallationToken,
    GithubInstallationRepo,
    HandleCheckSuite,
    HandleGithubEventResult,
    HandleIssueComment,
    HandlePullRequestEvent,
    HandleReviewComment,
    InstallationStatusResponse,
    NotifyGithubActivity,
    ProcessInstallation,
    ProcessUninstallation,
    ResolveRunModel,
    RunModelChoice,
    StartGithubRun,
    StartGithubRunResult,
    VerifySignature,
} from './githubapp.types'
import type { FailedCheckRun, GithubRun, PullRequestInfo } from '@december/shared'

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
                            provider: 'GITHUB',
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

// the model a github run uses: the installer's default source, and on own keys the key they
// used last with its default model. own key runs never fall back to credits.
const resolveRunModel = async (data: ResolveRunModel): Promise<RunModelChoice> => {
    const { userId, defaultModelSource } = data
    if (defaultModelSource !== 'OWN_KEY') {
        return { ok: true, billingSource: 'CREDITS' }
    }
    const key = await githubAppRepository.findLatestOwnKey(userId)
    if (!key) {
        return {
            ok: false,
            message: `Your December account runs on your own key, but no key is saved. Add one or switch to credits: ${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/settings`,
        }
    }
    return {
        ok: true,
        billingSource: 'OWN_KEY',
        provider: key.provider,
        model: key.defaultModel,
    }
}

const replyOnGithub = async (data: { token: string; run: GithubRun; body: string }) => {
    const { token, run, body } = data
    try {
        await createIssueComment({
            token,
            owner: run.repoOwner,
            repo: run.repoName,
            issueNumber: run.number,
            body,
        })
    } catch (err) {
        console.error('[GitHubApp Service] could not post a reply on GitHub:', err)
    }
}

/**
 * Starts one github run as a normal cloud session for the installer: the session pays from
 * their wallet (or own key), shows in their recent list, and the worker does the GitHub part
 * (push, pull request, review, reply) when the agent ends.
 */
const startGithubRun = async (data: StartGithubRun): Promise<StartGithubRunResult> => {
    const { token, userId, run, body, instruction, context, announce } = data

    const owner = await githubAppRepository.findRunOwner(userId)
    if (!owner) return { started: false, reason: 'no_owner' }

    const choice = await resolveRunModel({
        userId,
        defaultModelSource: owner.defaultModelSource,
    })
    if (!choice.ok) {
        if (announce) await replyOnGithub({ token, run, body: choice.message })
        return { started: false, reason: 'no_own_key' }
    }

    const prompt = buildGithubRunPrompt({ run, body, instruction, context })
    // review runs start on the base branch; the worker checks out the pull request head
    const branch = run.mode === 'change' ? run.headRef : run.baseRef

    let session: { id: string }
    try {
        session = await sessionService.createSession({
            userId,
            title: toGithubRunTitle(run),
            prompt,
            repoUrl: `https://github.com/${run.repoFullName}`,
            branch,
            issueNumber: run.number,
            billingSource: choice.billingSource,
            provider: choice.provider,
            model: choice.model,
        })
    } catch (err) {
        // our own errors (no balance, too many running sessions, a bad key) are meant for people
        if (err instanceof AppError) {
            const billing = `${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/settings/billing`
            const message =
                err.statusCode === 402 ? `${err.message} Add credits: ${billing}` : err.message
            if (announce) await replyOnGithub({ token, run, body: message })
            return { started: false, reason: `session_${err.statusCode}` }
        }
        throw err
    }

    await githubAppRepository.setSessionGithubRun(session.id, { ...run })

    let secrets: Array<{ key: string; value: string }> = []
    try {
        // "all repositories" secrets plus the ones of the repository of this run
        secrets = await secretsService.getAllDecryptedSecrets({
            userId,
            repoFullName: run.repoFullName,
        })
    } catch (err) {
        console.warn('[GitHubApp Service] could not load secrets for a github run:', err)
    }

    // one run for a session: the run of this new session claims it like any other run
    const runId = await sessionService.claimSessionRun({ sessionId: session.id })
    if (!runId) return { started: false, reason: 'session_busy', sessionId: session.id }
    try {
        await enqueueJob('run_agent', {
            sessionId: session.id,
            projectId: session.id,
            userId,
            runId,
            prompt,
            secrets,
            model: choice.model,
            provider: choice.provider,
            billingSource: choice.billingSource,
        })
    } catch (err) {
        // no run was queued: the session is free again
        await sessionService.releaseRun({ sessionId: session.id, runId })
        throw err
    }

    if (announce) {
        const what = run.mode === 'review' ? 'Reviewing' : 'On it'
        await replyOnGithub({
            token,
            run,
            body: `${what}. Follow the session: ${sessionLink(session.id)}`,
        })
    }

    return { started: true, sessionId: session.id }
}

const installationToken = async (installationId: string): Promise<string | null> => {
    try {
        const { token } = await getInstallationAccessToken({ installationId })
        return token
    } catch (err) {
        console.error('[GitHubApp Service] Failed to obtain installation access token:', err)
        return null
    }
}

// the installer and their settings, or null when the installation has no linked account
const loadInstallationOwner = async (installationId: string) => {
    const installation = await githubAppRepository.findByInstallationId(installationId)
    if (!installation?.userId || installation.userId === 'system') return null
    const row = await githubAppRepository.findPullRequestSettings(installation.userId)
    return {
        userId: installation.userId,
        settings: toPullRequestSettings(row),
        accountLogin: installation.accountLogin,
    }
}

const claimLink = () =>
    `${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/settings/repositories`

const isBotAuthor = (login?: string | null, type?: string | null) =>
    type === 'Bot' || isDecemberBotLogin(login) || Boolean(login?.endsWith('[bot]'))

/**
 * `@trydecember` in an issue or pull request comment. "review" on a pull request reviews it;
 * anything else is a task: a pull request for an issue, or commits on a pull request.
 */
const handleIssueComment = async (data: HandleIssueComment): Promise<HandleGithubEventResult> => {
    const { installationId, repository, issue, comment } = data

    const command = parseBotCommand(comment.body)
    if (!command.isMentioned) {
        return { handled: false, reason: 'not_mentioned' }
    }
    // December's own comments quote the handle; never answer them
    if (isBotAuthor(comment.user.login, comment.user.type)) {
        return { handled: false, reason: 'bot' }
    }

    const token = await installationToken(installationId)
    if (!token) return { handled: false, reason: 'token_error' }

    const base = {
        installationId,
        repoFullName: repository.fullName,
        repoOwner: repository.owner.login,
        repoName: repository.name,
        number: issue.number,
        title: issue.title,
        requestedBy: comment.user.login,
        trigger: 'comment' as const,
    }

    if (!isAuthorizedGithubSender(comment.authorAssociation)) {
        await replyOnGithub({
            token,
            run: { ...base, mode: 'issue', baseRef: '' },
            body: `@${comment.user.login} December only runs tasks that repository collaborators ask for.`,
        })
        return { handled: false, reason: 'unauthorized_sender' }
    }

    const owner = await loadInstallationOwner(installationId)
    if (!owner) {
        await replyOnGithub({
            token,
            run: { ...base, mode: 'issue', baseRef: '' },
            body: `@${comment.user.login} This GitHub App installation is not linked to a December account yet. Sign in and link it: ${claimLink()}`,
        })
        return { handled: false, reason: 'no_owner' }
    }
    // paused on the pull requests settings page: stay quiet
    if (!owner.settings.githubCommentsEnabled) {
        return { handled: false, reason: 'paused' }
    }

    const isPullRequest = Boolean(issue.pullRequest)
    if (command.intent === 'review' && !isPullRequest) {
        await replyOnGithub({
            token,
            run: { ...base, mode: 'issue', baseRef: '' },
            body: `@${comment.user.login} December reviews pull requests. Comment \`@trydecember review\` on a pull request, or \`@trydecember <task>\` here.`,
        })
        return { handled: false, reason: 'review_on_issue' }
    }

    try {
        await createCommentReaction({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            commentId: comment.id,
            reaction: 'eyes',
        })
    } catch {
        // Intentionally swallowed: the reaction is only an acknowledgement
    }

    if (!isPullRequest) {
        const result = await startGithubRun({
            token,
            userId: owner.userId,
            run: { ...base, mode: 'issue', baseRef: repository.defaultBranch || 'main' },
            body: issue.body || '',
            instruction: command.instruction,
            announce: true,
        })
        return { handled: result.started, reason: result.reason, sessionId: result.sessionId }
    }

    let pr: PullRequestInfo
    try {
        pr = await getPullRequest({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            pullNumber: issue.number,
        })
    } catch (err) {
        console.error('[GitHubApp Service] could not read the pull request:', err)
        return { handled: false, reason: 'pull_request_error' }
    }

    const isFork =
        Boolean(pr.headRepoFullName) &&
        pr.headRepoFullName.toLowerCase() !== repository.fullName.toLowerCase()
    if (command.intent === 'task' && isFork) {
        await replyOnGithub({
            token,
            run: { ...base, mode: 'change', baseRef: pr.baseRef },
            body: `@${comment.user.login} This pull request comes from a fork, so December cannot push to it. December can still review it: \`@trydecember review\`.`,
        })
        return { handled: false, reason: 'fork' }
    }

    const result = await startGithubRun({
        token,
        userId: owner.userId,
        run: {
            ...base,
            title: pr.title || issue.title,
            mode: command.intent === 'review' ? 'review' : 'change',
            baseRef: pr.baseRef,
            headRef: pr.headRef,
            headSha: pr.headSha,
        },
        body: pr.body,
        // "@trydecember review" alone has no extra request
        instruction: command.intent === 'review' ? command.instruction : command.instruction || '',
        announce: true,
    })
    return { handled: result.started, reason: result.reason, sessionId: result.sessionId }
}

// a review run already started for this commit (an automatic review runs once per commit)
const hasReviewedCommit = async (data: { userId: string; run: GithubRun }): Promise<boolean> => {
    const { userId, run } = data
    const runs = await githubAppRepository.findGithubRuns({
        userId,
        repoFullName: run.repoFullName,
        number: run.number,
        since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    })
    return runs.some((s) => {
        const previous = s.githubRun as GithubRun | null
        return previous?.mode === 'review' && previous.headSha === run.headSha
    })
}

/** an automatic review on a new pull request, or on every push when the settings ask for it */
const handlePullRequestEvent = async (
    data: HandlePullRequestEvent
): Promise<HandleGithubEventResult> => {
    const { installationId, action, repository, pullRequest } = data

    const owner = await loadInstallationOwner(installationId)
    if (!owner) return { handled: false, reason: 'no_owner' }

    const ownerGithubLogin = await githubAppRepository.findUserGithubUsername(owner.userId)
    const wanted = shouldAutoReview({
        settings: owner.settings,
        action,
        draft: Boolean(pullRequest.draft),
        authorLogin: pullRequest.user.login,
        authorType: pullRequest.user.type,
        ownerGithubLogin,
        repoFullName: repository.fullName,
    })
    if (!wanted) return { handled: false, reason: 'not_wanted' }

    const run: GithubRun = {
        mode: 'review',
        installationId,
        repoFullName: repository.fullName,
        repoOwner: repository.owner.login,
        repoName: repository.name,
        number: pullRequest.number,
        title: pullRequest.title,
        requestedBy: 'december',
        baseRef: pullRequest.base.ref,
        headRef: pullRequest.head.ref,
        headSha: pullRequest.head.sha,
        trigger: 'auto_review',
    }
    if (run.headSha && (await hasReviewedCommit({ userId: owner.userId, run }))) {
        return { handled: false, reason: 'already_reviewed' }
    }

    const token = await installationToken(installationId)
    if (!token) return { handled: false, reason: 'token_error' }

    const result = await startGithubRun({
        token,
        userId: owner.userId,
        run,
        body: pullRequest.body || '',
        instruction: '',
        announce: false,
    })
    return { handled: result.started, reason: result.reason, sessionId: result.sessionId }
}

/**
 * A comment on a line of a pull request. With "@trydecember" it is a command, on any pull
 * request. Without it, December answers only on its own pull requests when the settings say
 * "All". "Off" answers no line comments at all.
 */
const handleReviewComment = async (data: HandleReviewComment): Promise<HandleGithubEventResult> => {
    const { installationId, repository, pullRequest, comment } = data

    if (isDecemberBotLogin(comment.user.login)) return { handled: false, reason: 'own_comment' }

    const owner = await loadInstallationOwner(installationId)
    if (!owner) return { handled: false, reason: 'no_owner' }
    const { settings } = owner
    if (!settings.githubCommentsEnabled || settings.reviewReplies === 'off') {
        return { handled: false, reason: 'off' }
    }

    const isBot = isBotAuthor(comment.user.login, comment.user.type)
    if (isBot && !settings.replyToBots) return { handled: false, reason: 'bot' }

    const command = parseBotCommand(comment.body)
    if (!command.isMentioned) {
        if (settings.reviewReplies !== 'all') return { handled: false, reason: 'not_mentioned' }
        const prOwner = await findPullRequestOwner({
            installationId,
            repoOwner: repository.owner.login,
            repoName: repository.name,
            prNumber: pullRequest.number,
            prAuthorLogin: pullRequest.authorLogin,
        })
        if (prOwner !== owner.userId) return { handled: false, reason: 'not_december_pull_request' }
    }
    // bots have no author association; people must be collaborators
    if (!isBot && !isAuthorizedGithubSender(comment.authorAssociation)) {
        return { handled: false, reason: 'unauthorized_sender' }
    }

    const isFork =
        Boolean(pullRequest.head.repoFullName) &&
        pullRequest.head.repoFullName!.toLowerCase() !== repository.fullName.toLowerCase()
    const mode = command.intent === 'review' ? 'review' : 'change'
    if (mode === 'change' && isFork) return { handled: false, reason: 'fork' }

    const token = await installationToken(installationId)
    if (!token) return { handled: false, reason: 'token_error' }

    try {
        await createReviewCommentReaction({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            commentId: comment.id,
        })
    } catch {
        // Intentionally swallowed: the reaction is only an acknowledgement
    }

    const location = comment.path
        ? `${comment.path}${comment.line ? ` line ${comment.line}` : ''}`
        : 'the pull request'
    const context = [
        `The request is a review comment on ${location}.`,
        ...(comment.diffHunk
            ? ['The lines it points at:', '```diff', comment.diffHunk, '```']
            : []),
    ].join('\n')

    const result = await startGithubRun({
        token,
        userId: owner.userId,
        run: {
            mode,
            installationId,
            repoFullName: repository.fullName,
            repoOwner: repository.owner.login,
            repoName: repository.name,
            number: pullRequest.number,
            title: pullRequest.title,
            requestedBy: comment.user.login,
            baseRef: pullRequest.base.ref,
            headRef: pullRequest.head.ref,
            headSha: pullRequest.head.sha,
            trigger: 'review_comment',
        },
        body: pullRequest.body || '',
        instruction: command.isMentioned ? command.instruction : comment.body,
        context,
        announce: true,
    })
    return { handled: result.started, reason: result.reason, sessionId: result.sessionId }
}

// a failing check can fail again after a fix: at most this many fix runs per pull request a day
const MAX_CHECK_FIXES_PER_DAY = 3

/** checks failed on a December pull request: start a run that fixes them, when turned on */
const handleCheckSuite = async (data: HandleCheckSuite): Promise<HandleGithubEventResult> => {
    const { installationId, repository, conclusion, headSha, pullRequestNumbers } = data

    if (!conclusion || !['failure', 'timed_out'].includes(conclusion)) {
        return { handled: false, reason: 'not_failed' }
    }
    const prNumber = pullRequestNumbers[0]
    if (!prNumber || !headSha) return { handled: false, reason: 'no_pull_request' }

    const owner = await loadInstallationOwner(installationId)
    if (!owner) return { handled: false, reason: 'no_owner' }
    if (!owner.settings.githubCommentsEnabled || !owner.settings.fixFailedChecks) {
        return { handled: false, reason: 'off' }
    }

    const token = await installationToken(installationId)
    if (!token) return { handled: false, reason: 'token_error' }

    let pr: PullRequestInfo
    try {
        pr = await getPullRequest({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            pullNumber: prNumber,
        })
    } catch (err) {
        console.error('[GitHubApp Service] could not read the pull request:', err)
        return { handled: false, reason: 'pull_request_error' }
    }

    const prOwner = await findPullRequestOwner({
        installationId,
        repoOwner: repository.owner.login,
        repoName: repository.name,
        prNumber,
        prAuthorLogin: pr.authorLogin,
    })
    if (prOwner !== owner.userId) return { handled: false, reason: 'not_december_pull_request' }
    if (pr.headSha && pr.headSha !== headSha) return { handled: false, reason: 'stale_commit' }

    const runs = await githubAppRepository.findGithubRuns({
        userId: owner.userId,
        repoFullName: repository.fullName,
        number: prNumber,
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
    })
    const fixes = runs.filter((s) => (s.githubRun as GithubRun | null)?.trigger === 'failed_checks')
    if (fixes.some((s) => (s.githubRun as GithubRun | null)?.headSha === headSha)) {
        return { handled: false, reason: 'already_fixing' }
    }
    if (fixes.length >= MAX_CHECK_FIXES_PER_DAY) return { handled: false, reason: 'limit' }

    let failed: FailedCheckRun[] = []
    try {
        failed = await listFailedCheckRuns({
            token,
            owner: repository.owner.login,
            repo: repository.name,
            sha: headSha,
        })
    } catch (err) {
        console.warn('[GitHubApp Service] could not list the failed checks:', err)
    }
    const context = failed.length
        ? [
              'Failed checks on the latest commit:',
              ...failed.map(
                  (c) => `- ${c.name} (${c.conclusion})${c.summary ? `: ${c.summary}` : ''}`
              ),
          ].join('\n')
        : undefined

    const result = await startGithubRun({
        token,
        userId: owner.userId,
        run: {
            mode: 'change',
            installationId,
            repoFullName: repository.fullName,
            repoOwner: repository.owner.login,
            repoName: repository.name,
            number: prNumber,
            title: pr.title,
            requestedBy: 'december',
            baseRef: pr.baseRef,
            headRef: pr.headRef,
            headSha,
            trigger: 'failed_checks',
        },
        body: pr.body,
        instruction:
            'The checks failed on the latest push to this pull request. Find the commands the CI runs (see the workflow files in .github/workflows), run the failing ones, fix the cause, and run them again.',
        context,
        announce: false,
    })
    return { handled: result.started, reason: result.reason, sessionId: result.sessionId }
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

/** a pull request changed on github: every december session that opened it follows */
const syncPullRequestState = async (data: PullRequestStateEvent) => {
    const { gitProvider, repoOwner, repoName, number, state, ...details } = data
    return sessionService.applyPullRequestEvent({
        gitProvider,
        repoOwner,
        repoName,
        number,
        state,
        ...details,
    })
}

export const githubAppService = {
    syncPullRequestState,
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
    handlePullRequestEvent,
    handleReviewComment,
    handleCheckSuite,
    startGithubRun,
    notifyGithubActivity,
}
