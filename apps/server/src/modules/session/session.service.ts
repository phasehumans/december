import { prisma } from '@december/database'
import {
    DEFAULT_SESSION_RUN_CONFIG,
    isSessionEffort,
    joinRepoFullName,
    readSessionRunConfig,
    readSessionSwitches,
    interruptChannel,
    SPEND_LIMIT_CONTINUE,
    SPEND_LIMIT_STOP,
} from '@december/shared'
import { detectGitProvider, getGitProvider } from '@december/shared/git'
import { enqueueJob, publishEvent } from '@december/shared/queue'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { claimOnce, setFlag, takeFlag } from '../../shared/claim-once'
import {
    sessionPrefix,
    sessionWorkspacePrefix,
    listPrefix,
    getTextFile,
} from '../../shared/project-storage'
import {
    claimRun,
    leaveStopRequest,
    pushSteering,
    releaseRun as releaseRunMark,
} from '../../shared/run-mark'
import { getIO } from '../../socket'
import { attachmentService } from '../attachment/attachment.service'
import { byokService } from '../byok/byok.service'
import { cliDispatcher } from '../cli/cli.dispatcher'
import { notificationService } from '../notification/notification.service'
import { runtimeService } from '../runtime/runtime.service'
import { secretsService } from '../secrets/secrets.service'
import { usageService } from '../usage/usage.service'

import { sessionRepository } from './session.repository'
import {
    buildSmartSearchPrompt,
    CREDIT_TIER_MODELS,
    isEmptySmartSearchFilters,
    parseSmartSearchFilters,
    decidePromptRoute,
    isLimitQuestionId,
    readMessageWhileWorking,
    toHeldRunParts,
    toCreditTier,
    toPullRequestState,
    toSessionFacets,
    toTagsCacheKey,
    toLimitQuestionPrompt,
} from './session.utils'

import type {
    RecordPreviewActivity,
    TouchPreviewActivity,
    GetUserSessions,
    CreateSession,
    GetSession,
    RenameSession,
    ArchiveSession,
    UnarchiveSession,
    PinSession,
    UnpinSession,
    ArchiveMergedSessions,
    UnarchiveSessions,
    GetSessionCounts,
    SessionCounts,
    GetSessionFacets,
    SessionFacets,
    UpdateSessionTags,
    GetSessionMessages,
    DeleteSession,
    DeleteAllSessions,
    EndSessionRuns,
    DisconnectSession,
    RehydrateSession,
    ProxyPreview,
    LoadSessionFiles,
    StreamSearchResponse,
    SmartSearchSessions,
    SmartSearchFilters,
    GetSessionDiff,
    GetSessionFileTree,
    GetSessionFileContent,
    GetSessionPullRequests,
    SessionPullRequest,
    GetSessionPlan,
    GetSessionTests,
    GetSessionPreviewPort,
    SessionPreviewPortResult,
    SubmitQuestionAnswer,
    GetPendingQuestion,
    MarkQuestionAsked,
    HandleRunEvent,
    IsUserWatchingSession,
    NotifySessionOwner,
    ClearPendingQuestion,
    OwnsSession,
    RequestRunStop,
    StopSession,
    StopSessionResult,
    GetRunningSandboxes,
    RunningSandbox,
    GetSessionDesktopViewport,
    SessionDesktopViewportResult,
    ResolveTurnConfig,
    TurnConfig,
    GetUserRunDefaults,
    ResolveOwnKeyModel,
    ResolveOwnKeyTurnModel,
    OwnKeyModel,
    RecordUserPrompt,
    RoutePrompt,
    RoutedPrompt,
    DeliverSteering,
    SteeringDelivery,
    HeldRunParts,
    ReleaseRun,
    ClaimSessionRun,
    GetPullRequests,
    RefreshStalePullRequests,
    ApplyPullRequestEvent,
    PauseAtLimit,
    AnswerLimitQuestion,
    ContinueAtLimit,
    PromptAtLimit,
    InvalidateRecentSessions,
} from './session.types'
import type { SessionRunConfig, SpendLimitKind } from '@december/shared'

let sessionRedis: Redis | null = null

const getSessionRedis = (): Redis | null => {
    if (env.NODE_ENV === 'test') return null
    if (!sessionRedis) {
        const redisUrl =
            env.REDIS_URL || (env.NODE_ENV !== 'production' ? 'redis://localhost:6379' : undefined)
        if (redisUrl) {
            sessionRedis = new Redis(redisUrl, {
                lazyConnect: true,
                maxRetriesPerRequest: 1,
                enableOfflineQueue: false,
            })
            sessionRedis.on('error', () => {
                // Intentionally swallowed: Redis error fallback in session service
            })
        }
    }
    return sessionRedis
}

const loadSessionFiles = async (data: LoadSessionFiles) => {
    // Deprecated: Monolithic full-repo S3 loading deprecated in favor of on-demand fetching and git diff
    return {}
}

const invalidateUserRecentSessions = async (userId: string) => {
    await appCache.delPattern(appCache.key('sessions', 'recent', userId, '*'))
}

// for other modules: the recent list of a user changed (a session was archived, for one)
const invalidateRecentSessions = async (data: InvalidateRecentSessions) => {
    const { userId } = data
    await invalidateUserRecentSessions(userId)
}

const getUserSessions = async (data: GetUserSessions) => {
    const { userId, filters } = data

    const fetchSessions = async () => {
        const result = await sessionRepository.findManySessions(userId, filters)
        const sessions = result.sessions.map((session: any) => {
            const prNumber: number | null = session.prNumber ?? null

            return {
                id: session.id,
                title:
                    session.title ||
                    (session.messages?.[0]?.content
                        ? session.messages[0].content.substring(0, 50) + '...'
                        : 'New Chat'),
                type: session.type,
                isArchived: session.isArchived,
                isPinned: Boolean(session.pinnedAt),
                pinnedAt: session.pinnedAt ?? null,
                needsAnswer: Boolean(session.pendingQuestionAt),
                tags: session.tags,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
                lastMessage: session.messages?.[0]?.content || null,
                createdBy: session.user?.githubUsername
                    ? `@${session.user.githubUsername.toLowerCase()}`
                    : session.user?.email
                      ? `@${session.user.email.split('@')[0].toLowerCase()}`
                      : '@user',
                createdByName:
                    session.user?.name ||
                    session.user?.githubUsername ||
                    session.user?.email ||
                    'User',
                vmStatus: session.vmStatus ?? null,
                branch: session.branch ?? null,
                // only what the worker saved when it opened the pull request; unknown stays null
                prNumber,
                prState: prNumber ? toPullRequestState(session.prState) : null,
                prTitle: prNumber ? (session.prTitle ?? null) : null,
                prUrl: prNumber ? (session.prUrl ?? null) : null,
                prBranch: prNumber ? (session.prBranch ?? null) : null,
                // the owner apart from the name: the web joins them to match a repository
                githubRepoOwner: session.githubRepoOwner ?? null,
                githubRepoName: session.githubRepoName ?? null,
                repoUrl: session.repoUrl ?? session.githubRepoUrl ?? null,
            }
        })

        return {
            sessions,
            pagination: result.pagination,
        }
    }

    const hasSearchFilters =
        (filters?.search && filters.search.trim().length > 0) ||
        (filters?.titleAny && filters.titleAny.length > 0) ||
        Boolean(filters?.updatedAfter) ||
        Boolean(filters?.repoName)
    if (hasSearchFilters) {
        return fetchSessions()
    }

    const cacheKey = appCache.key(
        'sessions',
        'recent',
        userId,
        String(filters?.isArchived ?? 'all'),
        filters?.type ?? 'all',
        filters?.vmStatus ?? 'any',
        filters?.hasPr ? 'pr' : 'all-pr',
        filters?.needsAnswer ? 'needs-answer' : 'any-answer',
        filters?.pinnedFirst ? 'pinned-first' : 'plain',
        filters?.sortBy ?? 'updatedAt',
        filters?.sortOrder ?? 'desc',
        String(filters?.limit ?? 50),
        String(filters?.page ?? 1),
        // without the tags a tag list and the full list shared one entry (#641)
        toTagsCacheKey(filters?.tags)
    )

    return appCache.wrap(cacheKey, 30, fetchSessions)
}

const getMaxConcurrentSessions = (userId?: string, requestedLimit?: number): number => {
    if (requestedLimit && requestedLimit > 0) {
        return requestedLimit
    }
    const envVal = Number(
        process.env.MAX_CONCURRENT_SESSIONS_PER_USER ??
            (env as any)?.MAX_CONCURRENT_SESSIONS_PER_USER
    )
    if (!isNaN(envVal) && envVal > 0) {
        return envVal
    }
    return 10
}

const createSession = async (data: CreateSession) => {
    const {
        userId,
        title,
        type,
        prompt,
        projectId,
        repoUrl,
        branch,
        gitRef,
        issueNumber,
        maxConcurrentSessions,
        billingSource,
        provider,
        model,
        tier,
        planFirst,
        effort,
        openPullRequest,
        disabledPlugins,
        disabledMcps,
    } = data

    // a cloud session on the user's own key needs that key, not credits. search
    // always runs on december keys, so it always needs credits.
    let ownKeyModel: OwnKeyModel = {}
    if (billingSource === 'OWN_KEY' && type !== 'SEARCH') {
        ownKeyModel = await resolveOwnKeyModel({ userId, provider, model })
    } else {
        const minBalance =
            type === 'SEARCH'
                ? 1
                : parseInt(process.env.MIN_SESSION_START_BALANCE_IN_CENTS || '50', 10)
        const hasBalance = await usageService.hasMinimumBalance({
            userId,
            minBalanceInCents: minBalance,
        })

        if (!hasBalance) {
            throw new AppError(
                `Insufficient balance. A minimum balance of $${(minBalance / 100).toFixed(2)} is required to start a session.`,
                402
            )
        }
    }

    if (type !== 'SEARCH') {
        const activeSessions = await sessionRepository.countWorkingSessions(userId)

        const maxConcurrency = getMaxConcurrentSessions(userId, maxConcurrentSessions)
        if (activeSessions >= maxConcurrency) {
            throw new AppError(
                `Maximum concurrent active sessions limit (${maxConcurrency}) reached`,
                409
            )
        }
    }

    // the github* columns hold the repo on any git host until they get neutral names (#627)
    const gitProvider = repoUrl ? (detectGitProvider(repoUrl) ?? 'GITHUB') : 'GITHUB'
    const repoRef = repoUrl ? getGitProvider(gitProvider).parseRepoUrl(repoUrl) : null
    const githubRepoOwner = repoRef?.owner
    const githubRepoName = repoRef?.name
    const githubRepoUrl = repoUrl

    const defaultTitle = githubRepoName
        ? `${githubRepoName}${issueNumber ? ` #${issueNumber}` : ''}`
        : 'New Session'

    const session = await sessionRepository.createSession({
        userId,
        title: title || defaultTitle,
        type: type || 'WEB',
        vmStatus: 'STOPPED',
        projectId,
        repoUrl,
        branch,
        gitRef,
        issueNumber,
        gitProvider,
        githubRepoOwner,
        githubRepoName,
        githubRepoUrl,
    })

    if (prompt) {
        await prisma.message.create({
            data: {
                sessionId: session.id,
                role: 'USER',
                content: prompt,
                sequence: 1,
            },
        })
    }

    // the configuration of the session: a field the request leaves out takes the user's
    // default. on december credits the picked tier is also the effort.
    const defaults = await getUserRunDefaults({ userId })
    const config: SessionRunConfig = {
        planFirst: planFirst ?? defaults.planFirst,
        effort: effort ?? (billingSource !== 'OWN_KEY' ? tier : undefined) ?? defaults.effort,
        openPullRequest: openPullRequest ?? defaults.openPullRequest,
    }
    await sessionRepository.saveSessionRunConfig(
        session.id,
        {
            ...config,
            ...ownKeyModel,
            ...(disabledPlugins ? { disabledPlugins } : {}),
            ...(disabledMcps ? { disabledMcps } : {}),
        },
        null
    )

    await invalidateUserRecentSessions(userId)

    return { ...session, config: { ...config, ...ownKeyModel } }
}

/**
 * The model of a new session on the user's own key. A request with no model takes the
 * user's default own-key model (#637) when the user still has a key for that provider and
 * the key serves the model. Without a usable default the check is the same as before: the
 * request must name a provider with a saved key, and no model is saved.
 */
const resolveOwnKeyModel = async (data: ResolveOwnKeyModel): Promise<OwnKeyModel> => {
    const { userId, provider, model } = data

    if (!model) {
        const saved = await sessionRepository.findUserRunDefaults(userId)
        const defaultProvider = saved?.defaultOwnKeyProvider
        const defaultModel = saved?.defaultOwnKeyModel
        if (defaultProvider && defaultModel && (!provider || provider === defaultProvider)) {
            const isUsable = await byokService
                .assertOwnKeyUsable({ userId, provider: defaultProvider, model: defaultModel })
                .then(
                    () => true,
                    (error: unknown) => {
                        // the key is gone or no longer serves the model: no default
                        if (error instanceof AppError) return false
                        throw error
                    }
                )
            if (isUsable) return { provider: defaultProvider, model: defaultModel }
        }
    }

    await byokService.assertOwnKeyUsable({ userId, provider, model })
    return model ? { provider, model } : {}
}

/**
 * The model of one message on the user's own key. A message that names no model runs on
 * the model saved for the session (when the key still serves it), so the saved model is not
 * replaced by the key's default. Only a session with no saved model takes the key's default.
 */
const resolveOwnKeyTurnModel = async (data: ResolveOwnKeyTurnModel): Promise<OwnKeyModel> => {
    const { userId, sessionId, provider, model } = data

    if (!model) {
        const saved = await sessionRepository.findSessionRunConfig(sessionId, userId)
        const config = (saved?.config ?? {}) as { model?: unknown; provider?: unknown }
        const savedModel = typeof config.model === 'string' ? config.model : undefined
        const savedProvider = typeof config.provider === 'string' ? config.provider : undefined
        if (savedModel && savedProvider && (!provider || provider === savedProvider)) {
            const isUsable = await byokService
                .assertOwnKeyUsable({ userId, provider: savedProvider, model: savedModel })
                .then(
                    () => true,
                    (error: unknown) => {
                        // the key is gone or no longer serves the model: the key's default
                        if (error instanceof AppError) return false
                        throw error
                    }
                )
            if (isUsable) return { provider: savedProvider, model: savedModel }
        }
    }

    const credential = await byokService.assertOwnKeyUsable({ userId, provider, model })
    // no model picked and none saved: the key's own default, never a december model
    return { provider, model: model || credential.defaultModel || undefined }
}

const getUserRunDefaults = async (data: GetUserRunDefaults): Promise<SessionRunConfig> => {
    const { userId } = data
    const user = await sessionRepository.findUserRunDefaults(userId)
    if (!user) return DEFAULT_SESSION_RUN_CONFIG
    return {
        planFirst: user.defaultPlanFirst,
        effort: isSessionEffort(user.defaultEffort)
            ? user.defaultEffort
            : DEFAULT_SESSION_RUN_CONFIG.effort,
        openPullRequest: user.defaultOpenPullRequest,
    }
}

/**
 * The configuration and model of one message in a session. `planFirst` and `effort` sent
 * with the message are saved, so they hold for the next turns too; `openPullRequest` is
 * fixed when the session starts. On december credits the model comes from the tier (fast
 * or deep), never from the client, and the tier is also the effort unless one is sent.
 */
const resolveTurnConfig = async (data: ResolveTurnConfig): Promise<TurnConfig> => {
    const {
        userId,
        sessionId,
        billingSource,
        model,
        provider,
        tier,
        planFirst,
        effort,
        disabledPlugins,
        disabledMcps,
    } = data

    const saved = userId ? await sessionRepository.findSessionRunConfig(sessionId, userId) : null
    const defaults = userId ? await getUserRunDefaults({ userId }) : DEFAULT_SESSION_RUN_CONFIG
    const current = readSessionRunConfig(saved?.config, defaults)

    const isCredits = billingSource === 'CREDITS'
    // a client from before tiers sends a model: the fast model is fast, any other is deep
    const creditTier = isCredits
        ? (tier ?? effort ?? (model ? toCreditTier(model) : current.effort))
        : undefined

    const next: SessionRunConfig = {
        planFirst: planFirst ?? current.planFirst,
        effort: effort ?? creditTier ?? current.effort,
        openPullRequest: current.openPullRequest,
    }

    const turnModel = creditTier ? CREDIT_TIER_MODELS[creditTier] : { model, provider }
    const savedModel = (saved?.config ?? {}) as Record<string, unknown>
    const savedSwitches = readSessionSwitches(saved?.config)
    const switches = {
        disabledPlugins: disabledPlugins ?? savedSwitches.disabledPlugins,
        disabledMcps: disabledMcps ?? savedSwitches.disabledMcps,
    }

    // the model is kept for /context, which reads its context window
    const changed =
        next.planFirst !== current.planFirst ||
        next.effort !== current.effort ||
        saved?.config === null ||
        savedModel.model !== turnModel.model ||
        savedModel.provider !== turnModel.provider ||
        disabledPlugins !== undefined ||
        disabledMcps !== undefined
    if (saved && changed) {
        await sessionRepository.saveSessionRunConfig(
            sessionId,
            {
                ...next,
                ...switches,
                ...(turnModel.model ? { model: turnModel.model } : {}),
                ...(turnModel.provider ? { provider: turnModel.provider } : {}),
            },
            saved.config
        )
    }

    return { ...next, ...switches, ...turnModel }
}

/**
 * Saves a prompt sent to a running session as a user message, so the agent's history,
 * /rewind and /compact see every turn. The first prompt of a new session is already
 * saved by createSession: when the last message is that same prompt with no answer
 * yet, its sequence is used. Returns the sequence, or null for a session that is not
 * the user's.
 */
const recordUserPrompt = async (data: RecordUserPrompt): Promise<number | null> => {
    const { userId, sessionId, prompt } = data
    if (!userId) return null
    const owned = await sessionRepository.findSessionRunConfig(sessionId, userId)
    if (!owned) return null
    return sessionRepository.saveUserPrompt(sessionId, prompt)
}

/**
 * What a prompt that arrives now does (#637). The run mark in redis is the truth: it is set
 * here when no run is active (the caller then queues the run), and the worker clears it
 * when the run ends. During a run the account preference decides: "send now" gives the
 * message to the running agent, "queue" leaves it with the web.
 */
const routePrompt = async (data: RoutePrompt): Promise<RoutedPrompt> => {
    const { userId, sessionId } = data
    const runId = await claimRun(sessionId)
    if (runId) return { route: 'run', runId }
    const preferences = userId ? await sessionRepository.findUserPreferences(userId) : null
    return {
        route: decidePromptRoute({ runActive: true, mode: readMessageWhileWorking(preferences) }),
        runId: null,
    }
}

/**
 * Gives a saved message to the running agent (#637): the worker reads it at the next turn.
 * `run` when the run ended in between: the session is marked again, and the caller queues
 * a normal run, so the message is never lost.
 */
const deliverSteering = async (data: DeliverSteering): Promise<SteeringDelivery> => {
    const { sessionId, message } = data
    // a run can end and another one start between the two steps: try again a few times
    for (let attempt = 0; attempt < 3; attempt += 1) {
        if (await pushSteering(sessionId, message)) return { delivery: 'steered', runId: null }
        const runId = await claimRun(sessionId)
        if (runId) return { delivery: 'run', runId }
    }
    throw new AppError('could not send the message. try again', 503)
}

/**
 * Claims the session for a run that the server starts by itself (a github run, "Continue"
 * at a limit). The id of the run, to put in its job, or null when a run is queued or active.
 */
const claimSessionRun = async (data: ClaimSessionRun): Promise<string | null> => {
    const { sessionId } = data
    return claimRun(sessionId)
}

/** the run that routePrompt or deliverSteering marked was not queued: the mark is removed */
const releaseRun = async (data: ReleaseRun) => {
    const { sessionId, runId } = data
    await releaseRunMark(sessionId, runId)
}

const getSession = async (data: GetSession) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)

    const generatedFiles = {} // Deprecated: Monolithic full-repo JSON payload deprecated

    const saved = await sessionRepository.findSessionRunConfig(sessionId, userId)
    const config = readSessionRunConfig(saved?.config, await getUserRunDefaults({ userId }))
    // the files sent with each prompt (#634)
    const filesByMessage = await attachmentService.getSessionAttachments({ sessionId })

    return {
        session: { ...session, config },
        chatMessages: (session.messages || []).map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            status: message.status,
            sequence: message.sequence,
            blocks: (message as any).blocks ?? undefined,
            attachments: filesByMessage[message.id],
            createdAt: message.createdAt,
            updatedAt: message.updatedAt,
        })),
        generatedFiles,
    }
}

const renameSession = async (data: RenameSession) => {
    const { userId, sessionId, title } = data
    const existing = await sessionRepository.findSessionById(sessionId, userId)
    if (!existing) throw new AppError('Session not found', 404)
    const updated = await sessionRepository.updateSession(sessionId, userId, { title })
    await invalidateUserRecentSessions(userId)
    return updated
}

const archiveSession = async (data: ArchiveSession) => {
    const { userId, sessionId } = data
    const existing = await sessionRepository.findSessionById(sessionId, userId)
    if (!existing) throw new AppError('Session not found', 404)
    // an archived session leaves the recent list, so it loses its pin
    const updated = await sessionRepository.updateSession(sessionId, userId, {
        isArchived: true,
        pinnedAt: null,
        updatedAt: existing.updatedAt,
    })
    await invalidateUserRecentSessions(userId)
    return updated
}

const unarchiveSession = async (data: UnarchiveSession) => {
    const { userId, sessionId } = data
    const existing = await sessionRepository.findSessionById(sessionId, userId)
    if (!existing) throw new AppError('Session not found', 404)
    const updated = await sessionRepository.updateSession(sessionId, userId, {
        isArchived: false,
        updatedAt: existing.updatedAt,
    })
    await invalidateUserRecentSessions(userId)
    return updated
}

const MAX_PINNED_SESSIONS = 10

const pinSession = async (data: PinSession) => {
    const { userId, sessionId } = data
    const existing = await sessionRepository.findSessionById(sessionId, userId)
    if (!existing) throw new AppError('Session not found', 404)
    if (existing.isArchived) throw new AppError('Unarchive the session to pin it', 409)
    if (existing.pinnedAt) return existing

    const updated = await sessionRepository.pinSessionWithinLimit(
        sessionId,
        userId,
        MAX_PINNED_SESSIONS
    )
    if (!updated) {
        throw new AppError(`You can pin up to ${MAX_PINNED_SESSIONS} sessions`, 409)
    }
    await invalidateUserRecentSessions(userId)
    return updated
}

const unpinSession = async (data: UnpinSession) => {
    const { userId, sessionId } = data
    const existing = await sessionRepository.findSessionById(sessionId, userId)
    if (!existing) throw new AppError('Session not found', 404)
    if (!existing.pinnedAt) return existing

    const updated = await sessionRepository.updateSession(sessionId, userId, {
        pinnedAt: null,
        updatedAt: existing.updatedAt,
    })
    await invalidateUserRecentSessions(userId)
    return updated
}

const archiveMergedSessions = async (data: ArchiveMergedSessions) => {
    const { userId } = data
    const result = await sessionRepository.archiveMergedSessions(userId)
    if (result.sessionIds.length > 0) await invalidateUserRecentSessions(userId)
    return result
}

/** the undo of an archive: only sessions of this user change, and their pins come back */
const unarchiveSessions = async (data: UnarchiveSessions) => {
    const { userId, sessionIds, pins } = data
    const changed = await sessionRepository.unarchiveSessions(
        userId,
        sessionIds,
        pins ?? [],
        MAX_PINNED_SESSIONS
    )
    if (changed.length > 0) await invalidateUserRecentSessions(userId)
    return { sessionIds: changed }
}

// a pull request that is open or draft is read from the host again after an hour, so a
// missed webhook is repaired when the list is read. at most this many per read
const PR_REFRESH_AFTER_MS = 60 * 60 * 1000
const PR_REFRESH_LIMIT = 10

const toDateOrNull = (value: string | null | undefined): Date | null =>
    value ? new Date(value) : null

/** reads the state of stale open pull requests from GitHub or GitLab; never throws */
const refreshStalePullRequests = async (data: RefreshStalePullRequests) => {
    const { userId } = data
    const stale = await sessionRepository.findStalePullRequests(
        userId,
        new Date(Date.now() - PR_REFRESH_AFTER_MS),
        PR_REFRESH_LIMIT
    )
    if (stale.length === 0) return

    // loaded here: the platform module imports the github app module, which imports this one
    const { platformService } = await import('../platform/platform.service')
    const tokens = new Map<string, Promise<string | null>>()
    const tokenFor = (gitProvider: 'GITHUB' | 'GITLAB', owner: string) => {
        const key = `${gitProvider}:${owner}`
        if (!tokens.has(key)) {
            tokens.set(
                key,
                platformService.resolveRepoToken({ userId, gitProvider, owner }).catch(() => null)
            )
        }
        return tokens.get(key) as Promise<string | null>
    }

    let changed = false
    await Promise.all(
        stale.map(async (session) => {
            const owner = session.githubRepoOwner as string
            const repoPath = `${owner}/${session.githubRepoName}`
            const token = await tokenFor(session.gitProvider, owner)
            const pr = token
                ? await getGitProvider(session.gitProvider)
                      .getPullRequest({ token, repoPath, number: session.prNumber as number })
                      .catch(() => null)
                : null
            // checked either way, so a pull request the host refuses is not asked every read
            await sessionRepository.updatePullRequestFields(
                { id: session.id },
                {
                    prCheckedAt: new Date(),
                    ...(pr
                        ? {
                              prState: pr.status,
                              prTitle: pr.title,
                              prUrl: pr.url,
                              ...(session.gitProvider === 'GITHUB'
                                  ? { prAdditions: pr.additions, prDeletions: pr.deletions }
                                  : {}),
                              ...(pr.createdAt ? { prOpenedAt: new Date(pr.createdAt) } : {}),
                              prMergedAt: toDateOrNull(pr.mergedAt),
                              prClosedAt: toDateOrNull(pr.closedAt),
                          }
                        : {}),
                }
            )
            if (pr) changed = true
            // the webhook was missed: the merge is found here, so the archive happens here
            if (pr?.status === 'merged') {
                await sessionRepository.archiveSessionsOnMerge([session.id])
            }
        })
    )
    if (changed) await invalidateUserRecentSessions(userId)
}

/** the pull requests list: one row per session that opened a pull request (#632) */
const getPullRequests = async (data: GetPullRequests) => {
    const { userId, filters } = data

    await refreshStalePullRequests({ userId }).catch((error: unknown) => {
        console.error('[Session] could not refresh pull request states', error)
    })

    const result = await sessionRepository.findPullRequests(userId, filters)
    return {
        pullRequests: result.rows.map((row) => ({
            sessionId: row.id,
            title: row.title || 'Untitled session',
            tags: row.tags,
            gitProvider: row.gitProvider,
            repo:
                joinRepoFullName(row.githubRepoOwner, row.githubRepoName) ??
                row.githubRepoName ??
                null,
            prNumber: row.prNumber as number,
            prState: toPullRequestState(row.prState),
            prTitle: row.prTitle ?? null,
            prUrl: row.prUrl ?? null,
            prBranch: row.prBranch ?? row.branch ?? null,
            additions: row.prAdditions ?? null,
            deletions: row.prDeletions ?? null,
            prOpenedAt: row.prOpenedAt ?? null,
            prMergedAt: row.prMergedAt ?? null,
            prClosedAt: row.prClosedAt ?? null,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
        })),
        pagination: result.pagination,
    }
}

/**
 * A pull request changed on the host (the GitHub App webhook): every session that opened
 * it gets the new state, and the lists of their users are cleared.
 */
const applyPullRequestEvent = async (data: ApplyPullRequestEvent) => {
    const {
        gitProvider,
        repoOwner,
        repoName,
        number,
        state,
        title,
        additions,
        deletions,
        openedAt,
        mergedAt,
        closedAt,
    } = data

    const sessions = await sessionRepository.updatePullRequestFields(
        {
            gitProvider,
            githubRepoOwner: { equals: repoOwner, mode: 'insensitive' },
            githubRepoName: { equals: repoName, mode: 'insensitive' },
            prNumber: number,
            deletedAt: null,
        },
        {
            prState: state,
            prCheckedAt: new Date(),
            ...(title ? { prTitle: title } : {}),
            ...(additions !== undefined ? { prAdditions: additions } : {}),
            ...(deletions !== undefined ? { prDeletions: deletions } : {}),
            ...(openedAt ? { prOpenedAt: new Date(openedAt) } : {}),
            ...(mergedAt !== undefined ? { prMergedAt: toDateOrNull(mergedAt) } : {}),
            ...(closedAt !== undefined ? { prClosedAt: toDateOrNull(closedAt) } : {}),
        }
    )

    // "archive the session when the pull request merges" (#637): only when the state changes
    // to merged, so a later event of the same pull request leaves a session the user took
    // out of the archive
    if (state === 'merged') {
        await sessionRepository.archiveSessionsOnMerge(
            sessions
                .filter((session) => session.previousState !== 'merged')
                .map((session) => session.id)
        )
    }

    const userIds = [...new Set(sessions.map((session) => session.userId))]
    await Promise.all(userIds.map((userId) => invalidateUserRecentSessions(userId)))
    return { updated: sessions.length }
}

// under the recent list key, so every write that clears the list clears the counts too
const getSessionCounts = async (data: GetSessionCounts): Promise<SessionCounts> => {
    const { userId } = data
    const cacheKey = appCache.key('sessions', 'recent', userId, 'counts')
    return appCache.wrap(cacheKey, 30, () => sessionRepository.countSessions(userId))
}

// the repositories and tags for the sort and filter menu (#641). under the recent list
// key too, so a new session, a tag change and a delete clear them with the list
const getSessionFacets = async (data: GetSessionFacets): Promise<SessionFacets> => {
    const { userId, hasPr = false } = data
    const cacheKey = appCache.key('sessions', 'recent', userId, hasPr ? 'facets-pr' : 'facets')
    return appCache.wrap(cacheKey, 30, async () =>
        toSessionFacets(await sessionRepository.findSessionFacets(userId, hasPr))
    )
}

const updateSessionTags = async (data: UpdateSessionTags) => {
    const { userId, sessionId, tags } = data
    const existing = await sessionRepository.findSessionById(sessionId, userId)
    if (!existing) throw new AppError('Session not found', 404)
    const singleTag = tags ? tags.slice(0, 1) : []
    const updated = await sessionRepository.updateSession(sessionId, userId, { tags: singleTag })
    await invalidateUserRecentSessions(userId)
    return updated
}

// stops the agent runs, closes the sockets and queues the storage wipe of each session
const endSessionRuns = async (data: EndSessionRuns) => {
    const { sessionIds } = data

    for (const sessionId of sessionIds) {
        try {
            await publishEvent(`session_events:${sessionId}`, { type: 'SIGKILL', data: {} })
        } catch {
            // Intentionally swallowed: Redis pubsub event publishing fallback in test or offline environment
        }

        try {
            getIO().in(`session:${sessionId}`).disconnectSockets()
        } catch (e) {
            console.warn('Socket not connected or io not available', e)
        }
    }

    if (env.NODE_ENV === 'test' || sessionIds.length === 0) return

    const redisUrl =
        env.REDIS_URL || (env.NODE_ENV !== 'production' ? 'redis://localhost:6379' : undefined)
    if (!redisUrl) return

    let redis: Redis | null = null
    let minioWipeQueue: Queue | null = null
    try {
        redis = new Redis(redisUrl)
        minioWipeQueue = new Queue('minio_wipe', { connection: redis as any })
        for (const sessionId of sessionIds) {
            await minioWipeQueue.add(
                'wipe',
                { prefix: sessionPrefix(sessionId) },
                { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
            )
        }
    } catch (e) {
        console.warn('[Session] Failed to enqueue minio_wipe job:', e)
    } finally {
        if (minioWipeQueue) {
            await minioWipeQueue.close().catch(() => {
                // Intentionally swallowed: queue close error during deletion cleanup
            })
        }
        if (redis) {
            redis.disconnect()
        }
    }
}

const LIVE_SANDBOX_STATUSES = new Set(['STARTING', 'RUNNING', 'PAUSED'])

// every session of the user (#636): stop the sandboxes first, then delete
const deleteAllSessions = async (data: DeleteAllSessions) => {
    const { userId } = data

    const sessions = await sessionRepository.findSessionsForDeleteAll(userId)
    if (sessions.length === 0) {
        return { deleted: 0, sandboxesStopped: 0 }
    }

    // a row without a sandbox status is from before that column: stop it to be safe
    const withSandbox = sessions.filter(
        (session) =>
            session.vmId &&
            (session.sandboxStatus === null || LIVE_SANDBOX_STATUSES.has(session.sandboxStatus))
    )
    try {
        for (const session of withSandbox) {
            await enqueueJob('sandbox_control', {
                taskType: 'sandbox_control',
                action: 'stop',
                sessionId: session.id,
                sandboxId: session.vmId,
            })
        }
    } catch (error) {
        // nothing is deleted while a sandbox may still run and cost money
        console.error('[Session] could not queue sandbox stops:', error)
        throw new AppError('could not stop the sandboxes, nothing was deleted. try again', 503)
    }

    const sessionIds = sessions.map((session) => session.id)
    await endSessionRuns({ sessionIds })
    // the files sent with prompts (#634) go now; their rows go with the sessions
    await attachmentService.deleteSessionFiles({ sessionIds })
    const { count } = await sessionRepository.deleteSessionsByIds({ userId, sessionIds })
    await invalidateUserRecentSessions(userId)

    return { deleted: count, sandboxesStopped: withSandbox.length }
}

const deleteSession = async (data: DeleteSession) => {
    const { userId, sessionId } = data

    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner) {
        throw new AppError('Session not found', 404)
    }
    if (owner.userId !== userId) {
        throw new AppError('Only the session creator can delete this session', 403)
    }

    await endSessionRuns({ sessionIds: [sessionId] })
    // the files sent with prompts (#634) go now; their rows go with the session
    await attachmentService.deleteSessionFiles({ sessionIds: [sessionId] })

    await sessionRepository.deleteSession(sessionId)
    await invalidateUserRecentSessions(userId)

    return { message: 'session deleted successfully' }
}

const rehydrateSession = async (data: RehydrateSession) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const messages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { sequence: 'asc' },
    })

    let gitDiff: string | null = null
    let gitStatus: string | null = null

    try {
        const redis = getSessionRedis()
        if (redis) {
            const cached = await redis.get(`session_git_diff:${sessionId}`)
            if (cached) {
                const parsed = JSON.parse(cached)
                gitDiff = parsed.gitDiff ?? null
                gitStatus = parsed.gitStatus ?? null
            }
        }
    } catch {
        // Intentionally swallowed: Redis retrieval fallback for cached git diff
    }

    const chatMessages = messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: message.status,
        sequence: message.sequence,
        blocks: (message as any).blocks ?? undefined,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
    }))

    return {
        session,
        chatMessages,
        messages,
        fileTree: {},
        generatedFiles: {},
        terminalScrollback: [],
        gitDiff,
        gitStatus,
    }
}

const disconnectSession = async (data: DisconnectSession) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    // Client tab disconnects do not pause or terminate running containers.
    // Preserving background execution.
    return { message: 'Disconnect acknowledged. Background execution continues.' }
}

// one activity write per session per 30 seconds is enough for the 10 minute idle window
const PREVIEW_TOUCH_THROTTLE_MS = 30 * 1000
const lastPreviewTouch = new Map<string, number>()

const touchPreviewActivity = async (data: TouchPreviewActivity) => {
    const { sessionId } = data
    const now = Date.now()
    if (now - (lastPreviewTouch.get(sessionId) ?? 0) < PREVIEW_TOUCH_THROTTLE_MS) return
    lastPreviewTouch.set(sessionId, now)
    await sessionRepository.touchSandboxActivity(sessionId)
}

/**
 * The open preview pings this. The preview frame talks to E2B directly, so without it
 * a sandbox someone is looking at would be paused as idle (#624 part 4).
 */
const recordPreviewActivity = async (data: RecordPreviewActivity) => {
    const { userId, sessionId } = data
    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner || owner.userId !== userId) {
        throw new AppError('Session not found', 404)
    }
    await touchPreviewActivity({ sessionId })
    return { sessionId }
}

const proxyPreview = async (data: ProxyPreview) => {
    const { userId, sessionId, port, reqPath } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    // a preview request is sandbox activity: it keeps the sandbox from the idle pause
    await touchPreviewActivity({ sessionId })

    let targetHost = `session-${sessionId}-${port}.preview.trydecember.com`
    if (session.vmId && !session.vmId.startsWith('mock-')) {
        targetHost = `${port}-${session.vmId}.e2b.dev`
    }

    const normalizedPath = reqPath ? (reqPath.startsWith('/') ? reqPath : `/${reqPath}`) : '/'
    const previewUrl = `https://${targetHost}${normalizedPath}`

    return {
        previewUrl,
        port,
        targetHost,
        headers: {
            'X-Forwarded-Host': targetHost,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
        },
    }
}

const streamSearchResponse = async (data: StreamSearchResponse) => {
    const { userId, sessionId, prompt, messageHistory, res, signal } = data

    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const hasBalance = await usageService.hasMinimumBalance({
        userId,
        minBalanceInCents: 1,
    })
    if (!hasBalance) {
        throw new AppError(
            'Insufficient credits in December Wallet. Please add credits at https://app.trydecember.com/settings/billing to continue using Search.',
            402
        )
    }

    const existingMessages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { sequence: 'asc' },
    })

    const lastSequence =
        existingMessages.length > 0 ? Math.max(...existingMessages.map((m) => m.sequence)) : 0

    const userMessageSequence = lastSequence + 1
    await prisma.message.create({
        data: {
            sessionId,
            role: 'USER',
            content: prompt,
            sequence: userMessageSequence,
        },
    })

    if (!session.title || session.title === 'New Session' || session.title === 'Untitled Session') {
        const titleSnippet = prompt.length > 50 ? prompt.slice(0, 47) + '...' : prompt
        await sessionRepository
            .updateSession(sessionId, userId, { title: titleSnippet })
            .catch(() => {
                // Intentionally swallowed: optional title update fallback
            })
    }

    const llmMessages: import('@december/providers').Message[] = []
    if (messageHistory && messageHistory.length > 0) {
        for (const msg of messageHistory) {
            llmMessages.push({
                role:
                    msg.role === 'assistant'
                        ? 'assistant'
                        : msg.role === 'system'
                          ? 'system'
                          : 'user',
                content: msg.content,
            })
        }
    } else {
        for (const msg of existingMessages) {
            llmMessages.push({
                role:
                    msg.role === 'ASSISTANT'
                        ? 'assistant'
                        : msg.role === 'SYSTEM'
                          ? 'system'
                          : 'user',
                content: msg.content,
            })
        }
    }

    if (llmMessages.length === 0 || llmMessages[llmMessages.length - 1]?.content !== prompt) {
        llmMessages.push({
            role: 'user',
            content: prompt,
        })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    if (typeof (res as any).flushHeaders === 'function') {
        ;(res as any).flushHeaders()
    }

    const requestedModel = process.env.SEARCH_MODEL || 'gemini-3.6-flash'
    const systemPrompt =
        'You are December Search, a helpful, precise, and fast AI assistant. First, briefly reason inside <thought>...</thought> tags about what the user is asking and how best to answer. Then, provide concise, clear, and direct answers formatted in GitHub-flavored Markdown without horizontal divider lines (do not use ---). When providing code, use markdown code blocks with the appropriate language identifier.'

    let fullAssistantContent = ''
    let usageInfo: { inputTokens: number; outputTokens: number; totalTokens: number } | null = null

    try {
        const { provider, model } = cliDispatcher.resolveServerProvider(requestedModel)
        const stream = provider.stream(
            llmMessages,
            undefined,
            systemPrompt,
            { model, temperature: 0.7 },
            signal
        )

        for await (const chunk of stream) {
            if (chunk.type === 'text') {
                fullAssistantContent += chunk.text
                res.write(
                    `event: token\ndata: ${JSON.stringify({ token: chunk.text, text: chunk.text })}\n\n`
                )
            } else if (chunk.type === 'thinking_delta') {
                res.write(
                    `event: thought\ndata: ${JSON.stringify({ thought: chunk.text, text: chunk.text })}\n\n`
                )
            } else if (chunk.type === 'usage') {
                usageInfo = {
                    inputTokens: chunk.promptTokens,
                    outputTokens: chunk.completionTokens,
                    totalTokens: chunk.promptTokens + chunk.completionTokens,
                }
            }
        }

        if (!usageInfo) {
            const inputChars =
                llmMessages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0) +
                systemPrompt.length
            const outputChars = fullAssistantContent.length
            const inputTokens = Math.max(1, Math.ceil(inputChars / 4))
            const outputTokens = Math.max(1, Math.ceil(outputChars / 4))
            usageInfo = {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
            }
        }

        const assistantMessageSequence = userMessageSequence + 1
        await prisma.message.create({
            data: {
                sessionId,
                role: 'ASSISTANT',
                content: fullAssistantContent,
                sequence: assistantMessageSequence,
            },
        })

        const calculatedCost = usageService.calculateGenerationCost({
            modelName: requestedModel,
            inputTokens: usageInfo.inputTokens,
            outputTokens: usageInfo.outputTokens,
        })

        await usageService
            .recordUsageEvent({
                userId,
                sessionId,
                model: requestedModel,
                inputTokens: usageInfo.inputTokens,
                outputTokens: usageInfo.outputTokens,
                totalTokens: usageInfo.totalTokens,
                externalRequestId: `search-${sessionId}-${assistantMessageSequence}-${Date.now()}`,
                metadata: {
                    type: 'search',
                    sessionId,
                },
            })
            .catch((e) => {
                console.error('[Search Usage Record Error]:', e)
            })

        res.write(
            `event: done\ndata: ${JSON.stringify({
                inputTokens: usageInfo.inputTokens,
                outputTokens: usageInfo.outputTokens,
                totalTokens: usageInfo.totalTokens,
                costInCents: calculatedCost,
            })}\n\n`
        )
    } catch (err: any) {
        console.error('[Search Stream Error]:', err)
        if (!res.headersSent) {
            throw new AppError(err?.message || 'Failed to stream search response', 500)
        } else {
            res.write(
                `event: error\ndata: ${JSON.stringify({
                    error: err?.message || 'Stream error',
                    message: err?.message || 'Stream error',
                })}\n\n`
            )
        }
    } finally {
        if (!res.writableEnded) {
            res.end()
        }
    }
}

const getSessionMessages = async (data: GetSessionMessages) => {
    const { userId, sessionId, beforeSequence, limit } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const messages = await sessionRepository.findMessagesBySessionId({
        sessionId,
        beforeSequence,
        limit,
    })
    // the files sent with each prompt (#634)
    const filesByMessage = await attachmentService.getSessionAttachments({ sessionId })
    return messages.map((message) =>
        filesByMessage[message.id]
            ? { ...message, attachments: filesByMessage[message.id] }
            : message
    )
}

const getSessionDiff = async (data: GetSessionDiff) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    try {
        const redis = getSessionRedis()
        if (redis) {
            const cached = await redis.get(`session_git_diff:${sessionId}`)
            if (cached) {
                const parsed = JSON.parse(cached)
                return {
                    gitStatus: parsed.gitStatus ?? '',
                    gitDiff: parsed.gitDiff ?? '',
                }
            }
        }
    } catch {
        // Intentionally swallowed: Redis retrieval fallback for git diff
    }

    return {
        gitStatus: '',
        gitDiff: '',
    }
}

const getSessionFileTree = async (data: GetSessionFileTree) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const prefix = sessionWorkspacePrefix(sessionId)
    try {
        const objects = await listPrefix(prefix)
        const files: string[] = []
        for (const obj of objects) {
            const key = obj.Key
            if (!key) continue
            const relativePath = key.substring(prefix.length)
            if (!relativePath || relativePath.endsWith('/')) continue
            files.push(relativePath)
        }
        return { files }
    } catch {
        // Intentionally swallowed: storage fallback if S3 prefix cannot be listed
        return { files: [] }
    }
}

// about 1 MB of text: more would freeze the file viewer
const MAX_OPEN_FILE_CHARS = 1_000_000

const getSessionFileContent = async (data: GetSessionFileContent) => {
    const { userId, sessionId, path } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const prefix = sessionWorkspacePrefix(sessionId)
    const cleanPath = path.replace(/^\/+/, '')
    const key = `${prefix}${cleanPath}`

    try {
        const content = (await getTextFile(key)) ?? ''
        // /open shows a file in the browser: a binary file or a huge one is not shown whole
        if (content.includes('\u0000')) {
            return { path: cleanPath, content: '', binary: true, truncated: false }
        }
        const truncated = content.length > MAX_OPEN_FILE_CHARS
        return {
            path: cleanPath,
            content: truncated ? content.slice(0, MAX_OPEN_FILE_CHARS) : content,
            binary: false,
            truncated,
            size: content.length,
        }
    } catch {
        // Intentionally swallowed: storage fallback if file does not exist or S3 is unreachable
        return { path: cleanPath, content: '' }
    }
}

const getSessionPullRequests = async (
    data: GetSessionPullRequests
): Promise<{ pullRequest: SessionPullRequest | null }> => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    try {
        const redis = getSessionRedis()
        if (redis) {
            const cached = await redis.get(`session_pull_requests:${sessionId}`)
            if (cached) {
                const parsed = JSON.parse(cached)
                return { pullRequest: parsed.pullRequest ?? parsed }
            }
        }
    } catch {
        // Intentionally swallowed: Redis retrieval fallback for pull request
    }

    return { pullRequest: null }
}

const getSessionPlan = async (data: GetSessionPlan) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    try {
        const redis = getSessionRedis()
        if (redis) {
            const cached = await redis.get(`session_plan:${sessionId}`)
            if (cached) {
                const parsed = JSON.parse(cached)
                return { plan: parsed.plan ?? parsed }
            }
        }
    } catch {
        // Intentionally swallowed: Redis retrieval fallback for session plan
    }

    // Baseline fallback plan with 5 canonical phases
    const now = new Date().toISOString()
    return {
        plan: {
            sessionId,
            activePhaseId: 'reproduce',
            milestones: [
                {
                    id: 'reproduce',
                    title: 'Reproduce & Understand',
                    description:
                        'Analyze user prompt, inspect issue context, and reproduce problem state.',
                    status: 'in_progress',
                    logs: [],
                    startedAt: now,
                },
                {
                    id: 'locate',
                    title: 'Locate Relevant Code',
                    description:
                        'Search repository, inspect source tree, and locate files requiring changes.',
                    status: 'pending',
                    logs: [],
                },
                {
                    id: 'implement',
                    title: 'Implement Solution',
                    description:
                        'Apply targeted modifications, refactor code, and update components.',
                    status: 'pending',
                    logs: [],
                },
                {
                    id: 'test',
                    title: 'Run Tests & Verify',
                    description: 'Run automated tests, verify builds, and ensure no regressions.',
                    status: 'pending',
                    logs: [],
                },
                {
                    id: 'pr',
                    title: 'Branch & Create PR',
                    description:
                        'Commit to task branch, push to origin, and generate pull request.',
                    status: 'pending',
                    logs: [],
                },
            ],
            updatedAt: Date.now(),
        },
    }
}

const getSessionTests = async (data: GetSessionTests) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const redis = getSessionRedis()
    if (redis) {
        try {
            const cached = await redis.get(`session_test_results:${sessionId}`)
            if (cached) {
                return JSON.parse(cached)
            }
        } catch {
            // Intentionally swallowed: Redis offline fallback handled
        }
    }

    return null
}

const getSessionPreviewPort = async (
    data: GetSessionPreviewPort
): Promise<SessionPreviewPortResult> => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    let port: number | null = null
    let ports: number[] = []
    let previewUrl: string | null = null

    const redis = getSessionRedis()
    if (redis) {
        try {
            const cached = await redis.get(`session_preview_port:${sessionId}`)
            if (cached) {
                const parsed = JSON.parse(cached)
                port = parsed.port ?? null
                ports = parsed.ports ?? []
                previewUrl = parsed.previewUrl ?? null
            }
        } catch {
            // Intentionally swallowed: Redis offline fallback handled
        }
    }

    if (!port) {
        port = runtimeService.getSessionListeningPort({ sessionId })
    }

    if (port && !previewUrl) {
        let targetHost = `session-${sessionId}-${port}.preview.trydecember.com`
        if (session.vmId && !session.vmId.startsWith('mock-')) {
            targetHost = `${port}-${session.vmId}.e2b.dev`
        }
        previewUrl = `https://${targetHost}/`
    }

    return {
        sessionId,
        port,
        ports,
        previewUrl,
    }
}

const submitQuestionAnswer = async (data: SubmitQuestionAnswer) => {
    const { userId, sessionId, questionId, answer } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    // a session paused at a spend limit: the answer goes to the server, not to the agent
    // an answer to another question card (an older agent question) goes to the agent
    if (session.limitQuestionKind && isLimitQuestionId(questionId)) {
        return answerLimitQuestion({ userId, sessionId, questionId, answer })
    }

    const redis = getSessionRedis()
    if (redis) {
        const payload = JSON.stringify({
            sessionId,
            questionId,
            answer,
            answeredAt: Date.now(),
        })
        await redis.publish(`session_question_answer:${sessionId}`, payload).catch(() => {
            // Intentionally swallowed: Redis answer publish fallback
        })
        await redis.del(`session_pending_question:${sessionId}`).catch(() => {
            // Intentionally swallowed: Redis pending question cleanup fallback
        })
    }
    await clearPendingQuestion({ userId, sessionId })

    return {
        success: true,
        sessionId,
        questionId,
        answer,
    }
}

/** the worker asked a question (AskQuestionPrompt event): mark the session in the list */
const markQuestionAsked = async (data: MarkQuestionAsked) => {
    const { sessionId } = data
    // only the first ask changes the row, so every server node tries and one notifies
    const owner = await sessionRepository.setPendingQuestion(sessionId)
    if (!owner) return
    await invalidateUserRecentSessions(owner.userId)
    await notifySessionOwner({ owner, kind: 'SESSION_NEEDS_INPUT' })
}

/** true while the user has this session open in a tab (any server node) */
const isUserWatchingSession = async (data: IsUserWatchingSession) => {
    const { sessionId, userId } = data
    try {
        const sockets = await getIO().in(`session:${sessionId}`).fetchSockets()
        return sockets.some((socket) => socket.data.userId === userId)
    } catch {
        // Intentionally swallowed: no socket server (tests, scripts) means nobody watches
        return false
    }
}

// email and push wait while the user watches the session; low credits always go out
const notifySessionOwner = async (data: NotifySessionOwner) => {
    const { owner, kind, detail } = data
    const isWatching =
        kind === 'LOW_CREDITS'
            ? false
            : await isUserWatchingSession({ sessionId: owner.id, userId: owner.userId })
    try {
        await notificationService.notifyEvent({
            userId: owner.userId,
            kind,
            sessionId: owner.id,
            sessionTitle: owner.title,
            detail,
            isWatching,
        })
    } catch (error) {
        console.error(`[Session] could not notify ${kind} for ${owner.id}:`, error)
    }
}

/**
 * The worker's run events that tell the user something (#636): AgentError (failed),
 * AgentEnd (finished, unless it failed) and CreditsLow. Every server node gets them, so
 * each side effect is claimed once.
 */
const handleRunEvent = async (data: HandleRunEvent) => {
    const { sessionId, event } = data

    switch (event.type) {
        case 'AgentError': {
            // first, so the AgentEnd right after it sees the mark
            await setFlag(`run:failed:${sessionId}`, 300)
            if (!(await claimOnce(`notify:failed:${sessionId}`, 60))) return
            const owner = await sessionRepository.findSessionOwner(sessionId)
            if (!owner) return
            const detail = typeof event.error === 'string' ? event.error : undefined
            await notifySessionOwner({ owner, kind: 'SESSION_FAILED', detail })
            return
        }
        case 'AgentEnd': {
            // the end of a failed run (its AgentError told the user) or of a stopped run
            // (#637) is not a "finished". it only clears the failed mark and takes no
            // claim, so the end of the next run still notifies
            if (event.failed === true || event.stopped === true) {
                await takeFlag(`run:failed:${sessionId}`)
                return
            }
            if (!(await claimOnce(`notify:end:${sessionId}`, 30))) return
            if (await takeFlag(`run:failed:${sessionId}`)) return
            const owner = await sessionRepository.findSessionOwner(sessionId)
            if (!owner) return
            await notifySessionOwner({ owner, kind: 'SESSION_FINISHED' })
            return
        }
        case 'SpendLimitReached': {
            // a charge or the start of a run reached a spend limit (#638)
            await pauseAtLimit({ sessionId })
            return
        }
        case 'CreditsLow': {
            const owner = await sessionRepository.findSessionOwner(sessionId)
            if (!owner) return
            // the same call as the server's own charges (usage.service), with one claim for
            // both, so one drop under the amount gives one alert
            try {
                await notificationService.notifyLowCredits({
                    userId: owner.userId,
                    balanceInCents: Number(event.balanceInCents),
                })
            } catch (error) {
                console.error(`[Session] could not notify LOW_CREDITS for ${owner.id}:`, error)
            }
            return
        }
        default:
            return
    }
}

/**
 * the worker ended a wait without the server (timeout, run end) and sent QuestionSettled.
 * clears the mark again, in case the ask event landed after an answer, and the list cache
 */
const markQuestionSettled = async (data: MarkQuestionAsked) => {
    const { sessionId } = data
    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner) return
    await sessionRepository.clearPendingQuestion(sessionId, owner.userId)
    await invalidateUserRecentSessions(owner.userId)
}

/** true when this session is a session of this user. every socket event checks it first */
const ownsSession = async (data: OwnsSession): Promise<boolean> => {
    const { userId, sessionId } = data
    if (!userId || typeof sessionId !== 'string' || !sessionId) return false
    const session = await sessionRepository.findSessionRunState(sessionId, userId)
    return Boolean(session)
}

/** an answer or a stop ends the wait; only a session of this user changes */
const clearPendingQuestion = async (data: ClearPendingQuestion) => {
    const { userId, sessionId } = data
    const changed = await sessionRepository.clearPendingQuestion(sessionId, userId)
    if (changed) await invalidateUserRecentSessions(userId)
}

// spend limits (#638)

/**
 * A session reached a spend limit (the SpendLimitReached event of a charge or of a run
 * start). The run is stopped with reason `limit`, the session waits for an answer, and the
 * question goes to the session, the inbox, email and push. The question never answers
 * itself. Every server node gets the event: the first one to save the question does this.
 */
const pauseAtLimit = async (data: PauseAtLimit) => {
    const { sessionId } = data
    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner) return { paused: false }

    // the server checks again: the event can be late (a "continue" came in between)
    const state = await usageService.getSpendLimitState({ userId: owner.userId, sessionId })
    if (!state.kind || state.limitCents === null) {
        // nothing is asked, so no "Continue" will start a run the worker held: it must not
        // stay and start with the answer to a later question
        await sessionRepository.clearStaleHeldRun(sessionId)
        return { paused: false }
    }

    const asked = await sessionRepository.setLimitQuestion({
        sessionId,
        kind: state.kind,
        limitCents: state.limitCents,
    })
    if (!asked) return { paused: false }

    await requestRunStop({ sessionId, userId: owner.userId, reason: 'limit' })
    await invalidateUserRecentSessions(owner.userId)

    const prompt = toLimitQuestionPrompt({
        sessionId,
        kind: state.kind,
        limitCents: state.limitCents,
    })
    try {
        // the open session shows the question at once
        await publishEvent(`session_events:${sessionId}`, { ...prompt, type: 'SpendLimitQuestion' })
    } catch (error) {
        // the question is saved: the session shows it when it loads
        console.error('[Session] could not publish the spend limit question:', error)
    }
    await notifySessionOwner({
        owner,
        kind: 'SPEND_LIMIT',
        detail: prompt.questions[0]?.question,
    })
    return { paused: true }
}

/**
 * "Continue" at a limit: the session (or the day) gets the same amount again, and the run
 * starts again. A run that was held before it started runs as it was sent. A run that was
 * paused in the middle goes on with a short prompt.
 */
const continueAtLimit = async (data: ContinueAtLimit) => {
    const { userId, sessionId, kind, heldRun } = data
    // one run for a session: a run that still closes holds the session
    const runId = await claimSessionRun({ sessionId })
    if (!runId) {
        throw new AppError('December still works in this session. try again in a moment', 409)
    }

    try {
        await usageService.continuePastLimit({ userId, sessionId, kind })

        // secrets are never saved with a held run: they are read again here
        const secrets = await secretsService
            .getAllDecryptedSecrets({ userId, sessionId })
            .catch((error: unknown) => {
                console.warn('[Session] could not read the secrets for a continued run:', error)
                return []
            })

        if (heldRun) {
            await enqueueJob('run_agent', { ...heldRun, sessionId, userId, secrets, runId })
            return
        }

        const turn = await resolveTurnConfig({ userId, sessionId, billingSource: 'CREDITS' })
        const userMessageSequence = await recordUserPrompt({
            userId,
            sessionId,
            prompt: SPEND_LIMIT_CONTINUE,
        })
        await enqueueJob('run_agent', {
            sessionId,
            projectId: sessionId,
            userId,
            runId,
            prompt: SPEND_LIMIT_CONTINUE,
            secrets,
            model: turn.model,
            provider: turn.provider,
            billingSource: 'CREDITS',
            // the plan of the paused run stands: the agent goes on with the work
            planFirst: false,
            effort: turn.effort,
            skills: [],
            disabledMcps: turn.disabledMcps,
            ...(userMessageSequence ? { userMessageSequence } : {}),
        })
    } catch (error) {
        // no run was queued: the session is free again
        await releaseRunMark(sessionId, runId)
        throw error
    }
}

/** the user's answer to the limit question: "Continue", or "Stop here" (anything else) */
const answerLimitQuestion = async (data: AnswerLimitQuestion) => {
    const { userId, sessionId, questionId, answer } = data
    const question = await sessionRepository.findLimitQuestion(sessionId, userId)
    const kind = question?.limitQuestionKind as SpendLimitKind | null | undefined
    const picked = Array.isArray(answer) ? answer[0] : answer
    const result = { success: true, sessionId, questionId: `spend-limit:${kind ?? ''}`, answer }

    // the web sends an answer over the socket and over http: only the first one counts.
    // an answer to another question card (an older agent question) is not for this one
    if (!kind || !isLimitQuestionId(questionId)) {
        return { ...result, handled: false, continued: false }
    }
    if (!(await sessionRepository.takeLimitQuestion(sessionId, userId))) {
        return { ...result, handled: true, continued: false }
    }

    const continued = picked === SPEND_LIMIT_CONTINUE
    if (continued) {
        const heldRun = (question?.limitHeldRun ?? null) as Record<string, unknown> | null
        try {
            await continueAtLimit({ userId, sessionId, kind, heldRun })
        } catch (error) {
            // no run was queued: the question and the held prompt come back, so the user
            // can answer again
            await sessionRepository.restoreLimitQuestion({
                sessionId,
                kind,
                limitCents: question?.limitQuestionCents ?? null,
                heldRun,
            })
            throw error
        }
    }
    await invalidateUserRecentSessions(userId)
    try {
        await publishEvent(`session_events:${sessionId}`, {
            type: 'SpendLimitAnswered',
            sessionId,
            answer: continued ? SPEND_LIMIT_CONTINUE : SPEND_LIMIT_STOP,
        })
    } catch (error) {
        // the answer is saved: an open tab only misses the live update
        console.error('[Session] could not publish the spend limit answer:', error)
    }
    return { ...result, handled: true, continued }
}

/**
 * A new prompt from the user, before its run is queued. It counts as "Continue" for an
 * open limit question, and for a session that is at its session limit: the user asks for
 * more work in this session. The day limit is asked again when the run starts (the worker).
 * A prompt on the user's own key only ends the question: own-key runs have no limit.
 */
const promptAtLimit = async (data: PromptAtLimit) => {
    const { userId, sessionId, billingSource } = data
    if (!userId) return { continued: false, heldRun: null }

    const question = await sessionRepository.findLimitQuestion(sessionId, userId)
    if (!question) return { continued: false, heldRun: null }
    const open = question.limitQuestionKind as SpendLimitKind | null
    // a prompt that was held before it started never ran. its text is saved in the
    // conversation; its files and skills go with the run of the new prompt
    let heldRun: HeldRunParts | null = null
    if (open && (await sessionRepository.takeLimitQuestion(sessionId, userId))) {
        heldRun = toHeldRunParts(question.limitHeldRun)
        await invalidateUserRecentSessions(userId)
    }
    if (billingSource !== 'CREDITS') return { continued: false, heldRun }

    const raised: boolean[] = []
    for (const kind of new Set<SpendLimitKind>(open ? ['session', open] : ['session'])) {
        const result = await usageService.continuePastLimit({ userId, sessionId, kind })
        raised.push(result.raised)
    }
    return { continued: raised.includes(true), heldRun }
}

/**
 * Asks the worker that runs this session to stop the agent (#637). The session, its files
 * and the sandbox stay. The worker ends the run with AgentEnd { stopped: true, reason }.
 * Safe when no run is active: no worker listens for the session then.
 */
const requestRunStop = async (data: RequestRunStop) => {
    const { sessionId, userId, reason } = data
    const session = await sessionRepository.findSessionRunState(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)

    // a stopped run no longer waits for an answer. the stop button also answers a spend
    // limit question with "stop here". a limit stop keeps the question it just asked
    if (reason === 'user') {
        await clearPendingQuestion({ userId, sessionId })
        if (await sessionRepository.takeLimitQuestion(sessionId, userId)) {
            await invalidateUserRecentSessions(userId)
        }
    }
    // a publish reaches only a worker that listens. a run that waits in the queue, or
    // still runs its start checks, reads this request when it starts
    const stoppedRunId = await leaveStopRequest(sessionId, reason)
    await publishEvent(interruptChannel(sessionId), { type: 'INTERRUPT', reason })
    return { sessionId, reason, stoppedRunId }
}

// the agent works in the session
const WORKING_VM_STATUSES = new Set(['PROVISIONING', 'RUNNING'])

/**
 * Stop (#637): ends the agent run, then pauses the sandbox. The session, its files and the
 * paused sandbox stay, and the next prompt resumes the sandbox.
 */
const stopSession = async (data: StopSession): Promise<StopSessionResult> => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionRunState(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)

    // a sandbox that still starts has nothing to pause yet: the stop cancels the start of
    // the agent, and the idle sweep of the worker pauses the sandbox
    const pausesSandbox = Boolean(session.vmId) && session.sandboxStatus === 'RUNNING'
    try {
        // always sent, because the saved status can be late: the worker knows if a run is active
        const { stoppedRunId } = await requestRunStop({ sessionId, userId, reason: 'user' })
        if (pausesSandbox) {
            // pause, not stop: the worker that owns the sandbox, or any worker through the
            // E2B api, keeps the files and the memory. the worker leaves the sandbox as it
            // is when another run holds the session by then (a prompt sent after the stop)
            await enqueueJob('sandbox_control', {
                taskType: 'sandbox_control',
                action: 'pause',
                sessionId,
                sandboxId: session.vmId,
                afterStop: true,
                stoppedRunId,
            })
        }
    } catch (error) {
        if (error instanceof AppError) throw error
        console.error('[Session] could not stop the session:', error)
        throw new AppError('could not stop the session. try again', 503)
    }
    await invalidateUserRecentSessions(userId)

    return {
        sessionId,
        vmStatus: WORKING_VM_STATUSES.has(session.vmStatus) ? 'STOPPED' : session.vmStatus,
        sandboxStatus: pausesSandbox ? 'PAUSED' : session.sandboxStatus,
    }
}

/** the "running now" list of the sandbox settings (#637): sandboxes that start or run */
const getRunningSandboxes = async (
    data: GetRunningSandboxes
): Promise<{ items: RunningSandbox[] }> => {
    const { userId } = data
    const sessions = await sessionRepository.findRunningSandboxes(userId)
    const costs = await sessionRepository.sumCreditCostBySession(
        sessions.map((session) => session.id)
    )

    return {
        items: sessions.map((session) => ({
            sessionId: session.id,
            title: session.title,
            // the github* columns hold the repository on any git host
            repoFullName: joinRepoFullName(session.githubRepoOwner, session.githubRepoName),
            startedAt: session.sandboxStartedAt ?? session.createdAt,
            costInCents: costs.get(session.id) ?? 0,
            sandboxStatus: session.sandboxStatus === 'STARTING' ? 'STARTING' : 'RUNNING',
        })),
    }
}

const getPendingQuestion = async (data: GetPendingQuestion) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    // a spend limit question is saved with the session and never ends on its own (#638)
    if (session.limitQuestionKind && session.limitQuestionCents !== null) {
        return toLimitQuestionPrompt({
            sessionId,
            kind: session.limitQuestionKind as SpendLimitKind,
            limitCents: session.limitQuestionCents,
        })
    }

    const redis = getSessionRedis()
    if (redis) {
        try {
            const cached = await redis.get(`session_pending_question:${sessionId}`)
            if (cached) {
                return JSON.parse(cached)
            }
        } catch {
            // Intentionally swallowed: Redis offline fallback handled
        }
    }

    return null
}

const getSessionDesktopViewport = async (
    data: GetSessionDesktopViewport
): Promise<SessionDesktopViewportResult> => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

    let viewport: SessionDesktopViewportResult['viewport'] = null
    const redis = getSessionRedis()
    if (redis) {
        try {
            const cached = await redis.get(`session_desktop_viewport:${sessionId}`)
            if (cached) {
                viewport = JSON.parse(cached)
            }
        } catch {
            // Intentionally swallowed: Redis offline fallback handled
        }
    }

    return { viewport }
}

const SMART_SEARCH_MODEL = 'gemini-3.5-flash-lite'
const SMART_SEARCH_CACHE_SECONDS = 10 * 60
const SMART_SEARCH_RESULT_LIMIT = 6

/** asks the model for filters and charges the call; null when the reply is unusable */
const parseSmartSearchQuery = async (data: SmartSearchSessions) => {
    const { userId, query, signal } = data
    const repoNames = await sessionRepository.findUserRepoNames(userId)
    const systemPrompt = buildSmartSearchPrompt({ today: new Date(), repoNames })
    const { provider, model } = cliDispatcher.resolveServerProvider(SMART_SEARCH_MODEL)

    let text = ''
    let inputTokens = 0
    let outputTokens = 0
    const stream = provider.stream(
        [{ role: 'user', content: query }],
        undefined,
        systemPrompt,
        { model, temperature: 0 },
        signal
    )
    for await (const chunk of stream) {
        if (chunk.type === 'text') text += chunk.text
        else if (chunk.type === 'usage') {
            inputTokens = chunk.promptTokens
            outputTokens = chunk.completionTokens
        }
    }
    if (!inputTokens && !outputTokens) {
        inputTokens = Math.ceil((systemPrompt.length + query.length) / 4)
        outputTokens = Math.ceil(text.length / 4)
    }

    await usageService
        .recordDailyUsage({
            userId,
            model: SMART_SEARCH_MODEL,
            inputTokens,
            outputTokens,
            kind: 'search-filters',
        })
        .catch((err) => console.error('[Smart Search Usage Record Error]:', err))

    return parseSmartSearchFilters(text, repoNames)
}

/**
 * Search sessions by description ("stripe from last week"). A model turns the text
 * into filters, then the normal session query runs. Returns applied: false when the
 * user has no credits or the model gives nothing usable, so the client keeps plain results.
 */
const smartSearchSessions = async (data: SmartSearchSessions) => {
    const { userId, query, signal } = data
    const notApplied = { applied: false, sessions: [] as unknown[] }

    const hasBalance = await usageService.hasMinimumBalance({ userId, minBalanceInCents: 0.01 })
    if (!hasBalance) return notApplied

    const normalized = query.trim().toLowerCase().replace(/\s+/g, ' ')
    let filters: SmartSearchFilters | null
    try {
        // the same text within 10 minutes reuses the filters and is not charged again
        filters = await appCache.wrap(
            appCache.key('sessions', 'smart-search', userId, normalized),
            SMART_SEARCH_CACHE_SECONDS,
            () => parseSmartSearchQuery({ userId, query: normalized, signal })
        )
    } catch (err) {
        console.error('[Smart Search Error]:', err)
        return notApplied
    }
    if (!filters || isEmptySmartSearchFilters(filters)) return notApplied

    const result = await getUserSessions({
        userId,
        filters: {
            titleAny: filters.topic.length > 0 ? filters.topic : undefined,
            updatedAfter: filters.updatedWithinDays
                ? new Date(Date.now() - filters.updatedWithinDays * 24 * 60 * 60 * 1000)
                : undefined,
            repoName: filters.repo ?? undefined,
            vmStatus: filters.running ? 'running' : undefined,
            isArchived: filters.archived,
            sortBy: 'updatedAt',
            sortOrder: filters.sort === 'oldest' ? 'asc' : 'desc',
            limit: SMART_SEARCH_RESULT_LIMIT,
        },
    })

    return { applied: true, sessions: result.sessions }
}

export const sessionService = {
    invalidateRecentSessions,
    recordPreviewActivity,
    loadSessionFiles,
    getUserSessions,
    createSession,
    getSession,
    getSessionMessages,
    renameSession,
    archiveSession,
    unarchiveSession,
    pinSession,
    unpinSession,
    archiveMergedSessions,
    unarchiveSessions,
    getSessionCounts,
    getSessionFacets,
    resolveTurnConfig,
    recordUserPrompt,
    routePrompt,
    deliverSteering,
    releaseRun,
    claimSessionRun,
    resolveOwnKeyTurnModel,
    getPullRequests,
    applyPullRequestEvent,
    updateSessionTags,
    deleteSession,
    deleteAllSessions,
    rehydrateSession,
    disconnectSession,
    proxyPreview,
    streamSearchResponse,
    smartSearchSessions,
    getSessionDiff,
    getSessionFileTree,
    getSessionFileContent,
    getSessionPullRequests,
    getSessionPlan,
    getSessionTests,
    getSessionPreviewPort,
    submitQuestionAnswer,
    getPendingQuestion,
    handleRunEvent,
    markQuestionAsked,
    markQuestionSettled,
    clearPendingQuestion,
    ownsSession,
    requestRunStop,
    pauseAtLimit,
    answerLimitQuestion,
    promptAtLimit,
    stopSession,
    getRunningSandboxes,
    getSessionDesktopViewport,
}
