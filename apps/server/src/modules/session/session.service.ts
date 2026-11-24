import { prisma } from '@december/database'
import { detectGitProvider, getGitProvider } from '@december/shared/git'
import { publishEvent } from '@december/shared/queue'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import {
    sessionPrefix,
    sessionWorkspacePrefix,
    listPrefix,
    getTextFile,
} from '../../shared/project-storage'
import { getIO } from '../../socket'
import { byokService } from '../byok/byok.service'
import { cliDispatcher } from '../cli/cli.dispatcher'
import { runtimeService } from '../runtime/runtime.service'
import { usageService } from '../usage/usage.service'

import { sessionRepository } from './session.repository'
import {
    buildSmartSearchPrompt,
    isEmptySmartSearchFilters,
    parseSmartSearchFilters,
    toPullRequestState,
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
    UpdateSessionTags,
    GetSessionMessages,
    DeleteSession,
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
    ClearPendingQuestion,
    GetSessionDesktopViewport,
    SessionDesktopViewportResult,
} from './session.types'

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
        String(filters?.page ?? 1)
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
    } = data

    // a cloud session on the user's own key needs that key, not credits. search
    // always runs on december keys, so it always needs credits.
    if (billingSource === 'OWN_KEY' && type !== 'SEARCH') {
        await byokService.assertOwnKeyUsable({ userId, provider, model })
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

    await invalidateUserRecentSessions(userId)

    return session
}

const getSession = async (data: GetSession) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)

    const generatedFiles = {} // Deprecated: Monolithic full-repo JSON payload deprecated

    return {
        session,
        chatMessages: (session.messages || []).map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            status: message.status,
            sequence: message.sequence,
            blocks: (message as any).blocks ?? undefined,
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

// under the recent list key, so every write that clears the list clears the counts too
const getSessionCounts = async (data: GetSessionCounts): Promise<SessionCounts> => {
    const { userId } = data
    const cacheKey = appCache.key('sessions', 'recent', userId, 'counts')
    return appCache.wrap(cacheKey, 30, () => sessionRepository.countSessions(userId))
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

const deleteSession = async (data: DeleteSession) => {
    const { userId, sessionId } = data

    const owner = await sessionRepository.findSessionOwner(sessionId)
    if (!owner) {
        throw new AppError('Session not found', 404)
    }
    if (owner.userId !== userId) {
        throw new AppError('Only the session creator can delete this session', 403)
    }

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

    if (env.NODE_ENV !== 'test') {
        const redisUrl =
            env.REDIS_URL || (env.NODE_ENV !== 'production' ? 'redis://localhost:6379' : undefined)
        if (redisUrl) {
            let redis: Redis | null = null
            let minioWipeQueue: Queue | null = null
            try {
                redis = new Redis(redisUrl)
                minioWipeQueue = new Queue('minio_wipe', { connection: redis as any })
                await minioWipeQueue.add(
                    'wipe',
                    { prefix: sessionPrefix(sessionId) },
                    { attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
                )
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
    }

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

    return sessionRepository.findMessagesBySessionId({
        sessionId,
        beforeSequence,
        limit,
    })
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
        const content = await getTextFile(key)
        return { path: cleanPath, content: content ?? '' }
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
    const owner = await sessionRepository.setPendingQuestion(sessionId)
    if (owner) await invalidateUserRecentSessions(owner.userId)
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

/** an answer or a stop ends the wait; only a session of this user changes */
const clearPendingQuestion = async (data: ClearPendingQuestion) => {
    const { userId, sessionId } = data
    const changed = await sessionRepository.clearPendingQuestion(sessionId, userId)
    if (changed) await invalidateUserRecentSessions(userId)
}

const getPendingQuestion = async (data: GetPendingQuestion) => {
    const { userId, sessionId } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
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
    updateSessionTags,
    deleteSession,
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
    markQuestionAsked,
    markQuestionSettled,
    clearPendingQuestion,
    getSessionDesktopViewport,
}
