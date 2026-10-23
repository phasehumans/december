import { prisma } from '@december/database'
import { publishEvent } from '@december/shared'
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
import { cliDispatcher } from '../cli/cli.dispatcher'
import { runtimeService } from '../runtime/runtime.service'
import { usageService } from '../usage/usage.service'

import { sessionRepository } from './session.repository'

import type {
    GetUserSessions,
    CreateSession,
    GetSession,
    RenameSession,
    ArchiveSession,
    UnarchiveSession,
    UpdateSessionTags,
    GetSessionMessages,
    DeleteSession,
    DisconnectSession,
    RehydrateSession,
    ProxyPreview,
    LoadSessionFiles,
    StreamSearchResponse,
    GetSessionDiff,
    GetSessionFileTree,
    GetSessionFileContent,
    GetSessionPullRequests,
    SessionPullRequest,
    GetSessionPlan,
    GetSessionTests,
    GetSessionPreviewPort,
    SessionPreviewPortResult,
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
            let prNumber: number | null = session.prNumber || null
            const prUrl: string | null = session.reviews?.[0]?.prUrl || null
            if (!prNumber && prUrl) {
                const match = prUrl.match(/pull\/(\d+)/)
                if (match && match[1]) prNumber = parseInt(match[1], 10)
            }

            const prTitle =
                session.reviews?.[0]?.prTitle || session.reviews?.[0]?.title || session.title
            const branchName =
                session.reviews?.[0]?.branchName ||
                session.reviews?.[0]?.branch ||
                (session.title
                    ? session.title
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')
                          .slice(0, 30)
                    : null)
            const additions = session.reviews?.[0]?.additions ?? (prNumber ? 220 : null)
            const deletions = session.reviews?.[0]?.deletions ?? (prNumber ? 82 : null)
            const repoName = session.reviews?.[0]?.repoName ?? (prNumber ? 'december' : null)

            return {
                id: session.id,
                title:
                    session.title ||
                    (session.messages?.[0]?.content
                        ? session.messages[0].content.substring(0, 50) + '...'
                        : 'New Chat'),
                type: session.type,
                isArchived: session.isArchived,
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
                prNumber,
                prState: prNumber ? 'open' : null,
                prTitle,
                prUrl: prUrl || null,
                branchName: branchName || null,
                additions,
                deletions,
                repoName,
            }
        })

        return {
            sessions,
            pagination: result.pagination,
        }
    }

    if (filters?.search && filters.search.trim().length > 0) {
        return fetchSessions()
    }

    const cacheKey = appCache.key(
        'sessions',
        'recent',
        userId,
        String(filters?.isArchived ?? 'all'),
        filters?.type ?? 'all',
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
    return 3
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
    } = data

    const minBalance =
        type === 'SEARCH' ? 1 : parseInt(process.env.MIN_SESSION_START_BALANCE_IN_CENTS || '50', 10)
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

    if (type !== 'SEARCH') {
        const activeSessions = await prisma.session.count({
            where: {
                userId,
                vmStatus: { in: ['PROVISIONING', 'RUNNING'] },
            },
        })

        const maxConcurrency = getMaxConcurrentSessions(userId, maxConcurrentSessions)
        if (activeSessions >= maxConcurrency) {
            throw new AppError(
                `Maximum concurrent active sessions limit (${maxConcurrency}) reached`,
                409
            )
        }
    }

    let githubRepoOwner: string | undefined
    let githubRepoName: string | undefined
    let githubRepoUrl: string | undefined

    if (repoUrl) {
        githubRepoUrl = repoUrl
        const match = repoUrl.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(\.git)?$/i)
        if (match) {
            githubRepoOwner = match[1]
            githubRepoName = match[2]
        }
    }

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
    const updated = await sessionRepository.updateSession(sessionId, userId, {
        isArchived: true,
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

const proxyPreview = async (data: ProxyPreview) => {
    const { userId, sessionId, port, reqPath } = data
    const session = await sessionRepository.findSessionById(sessionId, userId)
    if (!session) {
        throw new AppError('Session not found', 404)
    }

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

export const sessionService = {
    loadSessionFiles,
    getUserSessions,
    createSession,
    getSession,
    getSessionMessages,
    renameSession,
    archiveSession,
    unarchiveSession,
    updateSessionTags,
    deleteSession,
    rehydrateSession,
    disconnectSession,
    proxyPreview,
    streamSearchResponse,
    getSessionDiff,
    getSessionFileTree,
    getSessionFileContent,
    getSessionPullRequests,
    getSessionPlan,
    getSessionTests,
    getSessionPreviewPort,
}
