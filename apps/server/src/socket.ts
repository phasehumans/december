import { isSessionEffort } from '@december/shared'
import { createAdapter } from '@socket.io/redis-adapter'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

import { env } from './env'
import { attachmentService } from './modules/attachment/attachment.service'
import { secretsService } from './modules/secrets/secrets.service'
import { sessionService } from './modules/session/session.service'
import { mergeHeldRun } from './modules/session/session.utils'
import { usageService } from './modules/usage/usage.service'
import { AppError } from './shared/appError'

const pubClient = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
})
pubClient.on('error', (err) => {
    console.error('[Socket Redis PubClient Error]', err?.message || err)
})

const subClient = pubClient.duplicate({ enableReadyCheck: false })
subClient.on('error', (err) => {
    console.error('[Socket Redis SubClient Error]', err?.message || err)
})

// this one is specifically for subscribing to worker session events
const redisSubClient = pubClient.duplicate({ enableReadyCheck: false })
redisSubClient.on('error', (err) => {
    console.error('[Socket Redis EventSubClient Error]', err?.message || err)
})

const agentJobsQueue = new Queue('agent_jobs', { connection: pubClient as any })

let io: Server

export function initSocket(httpServer: any) {
    const allowedOrigins = [
        env.WEB_URL?.replace(/\/+$/, ''),
        env.APP_URL?.replace(/\/+$/, ''),
        'https://app.trydecember.com',
        'https://trydecember.com',
        'https://www.trydecember.com',
        ...(env.NODE_ENV !== 'production'
            ? [
                  'http://localhost:3000',
                  'http://localhost:2000',
                  'http://localhost:5173',
                  'http://127.0.0.1:3000',
                  'http://127.0.0.1:2000',
              ]
            : []),
    ].filter(Boolean) as string[]

    io = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || (env.NODE_ENV !== 'production' && origin === 'null')) {
                    return callback(null, true)
                }
                if (
                    allowedOrigins.includes(origin) ||
                    (env.NODE_ENV !== 'production' &&
                        (origin.includes('localhost') || origin.includes('127.0.0.1')))
                ) {
                    return callback(null, true)
                }
                return callback(null, false)
            },
            credentials: true,
        },
        perMessageDeflate: {
            threshold: 1024, // only compress payloads larger than 1kb
        },
        adapter: createAdapter(pubClient, subClient),
    })

    // subscribe to all session events & terminal streams from redis (worker)
    redisSubClient.psubscribe(
        'session_events:*',
        'session_terminal_data:*',
        'user_notifications:*',
        (err, count) => {
            if (err) console.error('Failed to psubscribe:', err)
            else console.log(`[Socket] Subscribed to ${count} Redis pattern(s)`)
        }
    )

    redisSubClient.on('pmessage', (pattern, channel, message) => {
        if (pattern === 'session_events:*') {
            const sessionId = channel.replace('session_events:', '')
            try {
                const event = typeof message === 'string' ? JSON.parse(message) : message
                console.log(
                    `[SERVER CORE -> CLIENT] Relaying event '${event.type || 'unknown'}' to room session:${sessionId}`
                )
                io.to(`session:${sessionId}`).emit('agent_event', event)
                // the sessions list marks a session that waits for an answer
                if (event?.type === 'AskQuestionPrompt') {
                    sessionService.markQuestionAsked({ sessionId }).catch((error: unknown) => {
                        console.error('[SERVER CORE] could not mark the pending question', error)
                    })
                } else if (event?.type === 'QuestionSettled') {
                    sessionService.markQuestionSettled({ sessionId }).catch((error: unknown) => {
                        console.error('[SERVER CORE] could not clear the pending question', error)
                    })
                } else if (
                    event?.type === 'AgentError' ||
                    event?.type === 'AgentEnd' ||
                    event?.type === 'CreditsLow' ||
                    // a charge or a run start reached a spend limit: the session pauses (#638)
                    event?.type === 'SpendLimitReached'
                ) {
                    // failed, finished and low credits reach the inbox, email and push (#636)
                    sessionService.handleRunEvent({ sessionId, event }).catch((error: unknown) => {
                        console.error('[SERVER CORE] could not notify the run event', error)
                    })
                }
            } catch (err) {
                console.error(`[SERVER CORE] Failed to parse Redis message on ${channel}`, err)
            }
        } else if (pattern === 'session_terminal_data:*') {
            const sessionId = channel.replace('session_terminal_data:', '')
            io.to(`session_terminal:${sessionId}`).emit('TERMINAL_DATA', message)
        } else if (pattern === 'user_notifications:*') {
            // new inbox notification: every open tab of that user refreshes its badge
            const userId = channel.replace('user_notifications:', '')
            try {
                io.to(`user:${userId}`).emit('notification', JSON.parse(message))
            } catch (err) {
                console.error(`[SERVER CORE] Failed to parse notification on ${channel}`, err)
            }
        }
    })

    io.use((socket, next) => {
        let token = socket.handshake.auth.token
        if (!token && socket.request.headers.cookie) {
            const cookies = socket.request.headers.cookie.split(';').reduce((acc: any, cookie) => {
                const [key, value] = cookie.trim().split('=')
                if (key) acc[key] = value
                return acc
            }, {})
            token = cookies['accessToken']
        }

        if (!token) {
            return next(new Error('Authentication error'))
        }
        try {
            const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as any
            socket.data.userId = decoded.userId
            next()
        } catch (err) {
            next(new Error('Authentication error'))
        }
    })

    io.on('connection', (socket: Socket) => {
        console.log(`[Socket] User connected: ${socket.data.userId} (socket: ${socket.id})`)
        if (socket.data.userId) {
            socket.join(`user:${socket.data.userId}`)
        }

        socket.on('join_session', async (sessionId: string) => {
            if (!(await canUseSession(socket, sessionId))) return
            console.log(`[Socket] User ${socket.data.userId} joined session ${sessionId}`)
            socket.data.activeSessionId = sessionId
            socket.join(`session:${sessionId}`)
        })

        socket.on('leave_session', (sessionId: string) => {
            socket.leave(`session:${sessionId}`)
            if (socket.data.activeSessionId === sessionId) {
                delete socket.data.activeSessionId
            }
        })

        socket.on('join_session_terminal', async (data: { sessionId: string } | string) => {
            const sId = typeof data === 'string' ? data : data?.sessionId
            if (sId && (await canUseSession(socket, sId))) {
                console.log(
                    `[Socket] User ${socket.data.userId} joined terminal room for session ${sId}`
                )
                socket.join(`session_terminal:${sId}`)
                if (!socket.data.terminalSessions) {
                    socket.data.terminalSessions = new Set<string>()
                }
                socket.data.terminalSessions.add(sId)
                await pubClient
                    .publish(
                        `session_terminal_attach:${sId}`,
                        JSON.stringify({ userId: socket.data.userId })
                    )
                    .catch(() => {
                        // Intentionally swallowed: Redis publish fallback
                    })
            }
        })

        socket.on('leave_session_terminal', async (data: { sessionId: string } | string) => {
            const sId = typeof data === 'string' ? data : data?.sessionId
            // only a terminal this socket joined is left: the join checked the owner
            if (sId && socket.data.terminalSessions?.has(sId)) {
                socket.leave(`session_terminal:${sId}`)
                if (socket.data.terminalSessions) {
                    socket.data.terminalSessions.delete(sId)
                }
                await pubClient
                    .publish(
                        `session_terminal_detach:${sId}`,
                        JSON.stringify({ userId: socket.data.userId })
                    )
                    .catch(() => {
                        // Intentionally swallowed: Redis publish fallback
                    })
            }
        })

        socket.on('TERMINAL_INPUT', async (data: { sessionId: string; data: string }) => {
            if (data?.sessionId && data?.data && (await canUseSession(socket, data.sessionId))) {
                await pubClient
                    .publish(`session_terminal_input:${data.sessionId}`, data.data)
                    .catch(() => {
                        // Intentionally swallowed: Redis publish fallback
                    })
            }
        })

        socket.on(
            'TERMINAL_RESIZE',
            async (data: { sessionId: string; cols: number; rows: number }) => {
                if (
                    data?.sessionId &&
                    data?.cols &&
                    data?.rows &&
                    (await canUseSession(socket, data.sessionId))
                ) {
                    await pubClient
                        .publish(
                            `session_terminal_resize:${data.sessionId}`,
                            JSON.stringify({ cols: data.cols, rows: data.rows })
                        )
                        .catch(() => {
                            // Intentionally swallowed: Redis publish fallback
                        })
                }
            }
        )

        socket.on(
            'QUESTION_ANSWER',
            async (data: { sessionId: string; questionId?: string; answer: string | string[] }) => {
                if (
                    data?.sessionId &&
                    data?.answer !== undefined &&
                    (await canUseSession(socket, data.sessionId))
                ) {
                    // the answer to a spend limit question (#638) goes to the server, not to
                    // the agent: "Continue" starts the run again
                    const limitAnswer = await sessionService
                        .answerLimitQuestion({
                            userId: socket.data.userId,
                            sessionId: data.sessionId,
                            // an answer to another question card goes to the agent
                            questionId:
                                typeof data.questionId === 'string' ? data.questionId : undefined,
                            answer: data.answer,
                        })
                        .catch((error: unknown) => {
                            console.error('[Socket] could not answer the limit question', error)
                            return null
                        })
                    if (limitAnswer?.handled) return
                    await sessionService
                        .clearPendingQuestion({
                            userId: socket.data.userId,
                            sessionId: data.sessionId,
                        })
                        .catch((error: unknown) => {
                            console.error('[Socket] could not clear the pending question', error)
                        })
                    await pubClient
                        .publish(
                            `session_question_answer:${data.sessionId}`,
                            JSON.stringify({
                                sessionId: data.sessionId,
                                questionId: data.questionId,
                                answer: data.answer,
                                answeredAt: Date.now(),
                            })
                        )
                        .catch(() => {
                            // Intentionally swallowed: Redis publish fallback
                        })
                }
            }
        )

        socket.on('disconnect', async () => {
            console.log(`[Socket] User disconnected: ${socket.data.userId} (socket: ${socket.id})`)
            // AFK background execution: do NOT terminate or pause background tasks on client disconnect
            if (socket.data.terminalSessions && socket.data.terminalSessions.size > 0) {
                for (const sId of socket.data.terminalSessions) {
                    await pubClient
                        .publish(
                            `session_terminal_detach:${sId}`,
                            JSON.stringify({ userId: socket.data.userId })
                        )
                        .catch(() => {
                            // Intentionally swallowed: Redis publish fallback on disconnect
                        })
                }
                socket.data.terminalSessions.clear()
            }
        })

        // custom application-level heartbeat
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() })
        })

        socket.on(
            'send_prompt',
            async (data: {
                sessionId?: string
                prompt: string
                projectId?: string
                model?: string
                provider?: string
                billingSource?: 'CREDITS' | 'OWN_KEY'
                // december credits: fast or deep picks the model on the server
                tier?: 'fast' | 'deep'
                // session configuration for this turn and the next ones (#632)
                planFirst?: boolean
                effort?: 'fast' | 'deep'
                // skills picked with /name for this message, and the + menu switches
                skills?: string[]
                disabledPlugins?: string[]
                disabledMcps?: string[]
                // the ids of the files uploaded for this prompt (#634)
                attachments?: string[]
                // the id the web gave this message (#637), sent back with its events
                clientMessageId?: string
            }) => {
                const targetSessionId = data.sessionId || data.projectId
                if (!targetSessionId) {
                    socket.emit('error', { message: 'sessionId is required' })
                    return
                }
                // a prompt goes only to a session of this user
                if (!(await canUseSession(socket, targetSessionId))) {
                    socket.emit('error', { message: 'Session not found' })
                    return
                }

                // a prompt with no text starts no run and is never given to a running agent
                if (isBlankPrompt(data.prompt)) {
                    socket.emit('error', { message: 'prompt is required' })
                    return
                }

                socket.data.activeSessionId = targetSessionId
                socket.join(`session:${targetSessionId}`)

                // a new message while December works (#637): `run` starts a run, `steer`
                // reaches the running agent, `queued` stays with the web
                let route: 'run' | 'steer' | 'queued' | null = null
                // the run this prompt claimed: the owner of the session's run mark
                let runId: string | null = null
                const clientMessageId =
                    typeof data.clientMessageId === 'string'
                        ? data.clientMessageId.slice(0, 64)
                        : undefined

                try {
                    console.log(
                        `[SERVER CORE] Prompt received for session '${targetSessionId}' (user: ${socket.data.userId || 'anonymous'}): "${data.prompt?.slice(0, 80)}..."`
                    )

                    const userId = socket.data.userId
                    const billingSource = data.billingSource === 'OWN_KEY' ? 'OWN_KEY' : 'CREDITS'
                    let model = data.model
                    let provider = data.provider

                    // own key: the user's key pays, so no credits are needed. the key itself is
                    // never put in the job: the worker loads and decrypts it.
                    if (billingSource === 'OWN_KEY') {
                        // own keys belong to a signed-in user: stop here, before any lookup
                        if (!userId) {
                            const message = 'Sign in to use your own key.'
                            socket.emit('agent_event', {
                                type: 'AgentError',
                                code: 'BYOK_KEY_MISSING',
                                message,
                            })
                            socket.emit('error', { message })
                            return
                        }
                        try {
                            // no model picked: the model saved for the session, then the
                            // key's own default, never a december model
                            const ownKey = await sessionService.resolveOwnKeyTurnModel({
                                userId,
                                sessionId: targetSessionId,
                                provider: data.provider,
                                model: data.model,
                            })
                            model = ownKey.model
                            provider = ownKey.provider
                        } catch (keyErr: any) {
                            // only our own errors carry a message meant for the user; anything
                            // else (a database error, say) gets the generic message
                            const message =
                                keyErr instanceof AppError
                                    ? keyErr.message
                                    : 'Your own key cannot be used.'
                            if (!(keyErr instanceof AppError)) {
                                console.error('[SERVER CORE] own key check failed:', keyErr)
                            }
                            socket.emit('agent_event', {
                                type: 'AgentError',
                                code: 'BYOK_KEY_MISSING',
                                message,
                            })
                            socket.emit('error', { message })
                            return
                        }
                    } else if (userId) {
                        const hasBalance = await usageService.hasMinimumBalance({
                            userId,
                            minBalanceInCents: 1,
                        })
                        if (!hasBalance) {
                            socket.emit('agent_event', {
                                type: 'AgentError',
                                message:
                                    'Insufficient wallet credits. Please add credits at https://app.trydecember.com/settings/billing to continue.',
                            })
                            socket.emit('error', {
                                message:
                                    'Insufficient wallet credits. Please add credits at https://app.trydecember.com/settings/billing to continue.',
                            })
                            return
                        }
                    }

                    // fetch user secrets (phase 3.6 secrets management)
                    let decryptedSecrets: Array<{ key: string; value: string }> = []
                    if (socket.data.userId) {
                        try {
                            // "all repositories" secrets plus the ones of this session's repository
                            decryptedSecrets = await secretsService.getAllDecryptedSecrets({
                                userId: socket.data.userId,
                                sessionId: targetSessionId,
                            })
                        } catch (secErr) {
                            console.warn('[Socket] Failed to fetch secrets for user:', secErr)
                        }
                    }

                    // one run for a session: a prompt that arrives during a run never starts a
                    // second job. on "queue" the web keeps it and sends it when the run ends
                    const routed = await sessionService.routePrompt({
                        userId,
                        sessionId: targetSessionId,
                    })
                    route = routed.route
                    runId = routed.runId
                    if (route === 'queued') {
                        socket.emit('prompt_queued', {
                            sessionId: targetSessionId,
                            prompt: data.prompt,
                            ...(clientMessageId ? { clientMessageId } : {}),
                        })
                        return
                    }

                    // plan first and effort for this turn; on credits also the model of the tier
                    const turn = await sessionService.resolveTurnConfig({
                        userId,
                        sessionId: targetSessionId,
                        billingSource,
                        model,
                        provider,
                        tier: isSessionEffort(data.tier) ? data.tier : undefined,
                        planFirst: typeof data.planFirst === 'boolean' ? data.planFirst : undefined,
                        effort: isSessionEffort(data.effort) ? data.effort : undefined,
                        disabledPlugins: toNameList(data.disabledPlugins),
                        disabledMcps: toNameList(data.disabledMcps),
                    })

                    // a new prompt counts as "Continue" for a spend limit question (#638).
                    // a prompt that was held at the limit gives its files and skills to
                    // this run; its text is saved in the conversation
                    const atLimit = await sessionService
                        .promptAtLimit({ userId, sessionId: targetSessionId, billingSource })
                        .catch((error: unknown) => {
                            console.error('[SERVER CORE] could not check the spend limit', error)
                            return null
                        })

                    // the prompt is saved first, so the agent's history and /rewind have it
                    const userMessageSequence = await sessionService
                        .recordUserPrompt({
                            userId,
                            sessionId: targetSessionId,
                            prompt: data.prompt,
                        })
                        .catch((error: unknown) => {
                            console.error('[SERVER CORE] could not save the prompt', error)
                            return null
                        })

                    // the files of this prompt (#634): the client sends ids only. the
                    // server ties them to the saved message and names their stored bytes
                    const attachments = await attachmentService
                        .attachToPrompt({
                            userId,
                            sessionId: targetSessionId,
                            attachmentIds: toNameList(data.attachments) ?? [],
                            sequence: userMessageSequence,
                        })
                        .catch((error: unknown) => {
                            console.error('[SERVER CORE] could not attach the files', error)
                            return []
                        })
                    const runParts = mergeHeldRun({
                        heldRun: atLimit?.heldRun ?? null,
                        attachments,
                        skills: toNameList(data.skills) ?? [],
                    })

                    // "send now" during a run: the saved message goes to the running agent,
                    // with no new job. when the run ended in between, a normal run follows
                    if (route === 'steer') {
                        const delivery = await sessionService.deliverSteering({
                            sessionId: targetSessionId,
                            message: {
                                prompt: data.prompt,
                                skills: runParts.skills,
                                ...(userMessageSequence ? { userMessageSequence } : {}),
                                ...(runParts.attachments.length > 0
                                    ? { attachments: runParts.attachments }
                                    : {}),
                                ...(clientMessageId ? { clientMessageId } : {}),
                            },
                        })
                        if (delivery.delivery === 'steered') {
                            console.log(
                                `[SERVER CORE] Prompt sent to the running agent of session '${targetSessionId}'`
                            )
                            return
                        }
                        route = 'run'
                        runId = delivery.runId
                    }

                    // enqueue to worker
                    console.log(
                        `[SERVER CORE] Enqueuing job 'run_agent' to BullMQ queue 'agent_jobs'...`
                    )
                    const job = await agentJobsQueue.add('run_agent', {
                        sessionId: targetSessionId,
                        projectId: targetSessionId,
                        userId: socket.data.userId,
                        // the owner of the session's run mark: the worker runs only this job
                        ...(runId ? { runId } : {}),
                        prompt: data.prompt,
                        secrets: decryptedSecrets,
                        model: turn.model,
                        provider: turn.provider,
                        billingSource,
                        planFirst: turn.planFirst,
                        effort: turn.effort,
                        skills: runParts.skills,
                        disabledMcps: turn.disabledMcps,
                        ...(userMessageSequence ? { userMessageSequence } : {}),
                        ...(runParts.attachments.length > 0
                            ? { attachments: runParts.attachments }
                            : {}),
                    })

                    console.log(
                        `[SERVER CORE] Job #${job.id} enqueued successfully to Redis for session '${targetSessionId}'`
                    )
                } catch (err: any) {
                    console.error('[SERVER CORE] Failed to enqueue agent job:', err)
                    if (route === 'steer') {
                        // the run of the session still works: an `error` would end it in
                        // the web. the web keeps the message, and sends it after the run
                        socket.emit('prompt_queued', {
                            sessionId: targetSessionId,
                            prompt: data.prompt,
                            ...(clientMessageId ? { clientMessageId } : {}),
                        })
                        return
                    }
                    // the run this prompt marked was not queued: the session is free again
                    if (route === 'run' && runId) {
                        await sessionService.releaseRun({ sessionId: targetSessionId, runId })
                    }
                    socket.emit('error', { message: 'Failed to start agent: ' + err.message })
                }
            }
        )

        // the stop button: ends the agent run, the sandbox keeps running (#637). only the
        // owner's stop is sent to the worker
        socket.on('stop_session', async (data: { sessionId: string }) => {
            const sessionId = data?.sessionId
            console.log(`[Socket] Received STOP signal for session ${sessionId}`)
            if (typeof sessionId !== 'string' || !sessionId || !socket.data.userId) return
            await sessionService
                .requestRunStop({ sessionId, userId: socket.data.userId, reason: 'user' })
                .catch((error: unknown) => {
                    console.error('[Socket] could not stop the run', error)
                })
        })
    })

    return io
}

/**
 * True when the session named by a socket event is a session of the signed-in user.
 * A session that passed once is kept on the socket, so terminal input does not read
 * the database for each key.
 */
export async function canUseSession(
    socket: { data: { userId?: string; ownedSessions?: Set<string> } },
    sessionId: unknown
): Promise<boolean> {
    if (typeof sessionId !== 'string' || !sessionId) return false
    if (socket.data.ownedSessions?.has(sessionId)) return true
    const owned = await sessionService
        .ownsSession({ userId: socket.data.userId, sessionId })
        .catch((error: unknown) => {
            console.error('[Socket] could not check the session owner', error)
            return false
        })
    if (!owned) return false
    if (!socket.data.ownedSessions) socket.data.ownedSessions = new Set<string>()
    socket.data.ownedSessions.add(sessionId)
    return true
}

/** true for a prompt with no text: not a string, empty, or only spaces and line breaks */
export function isBlankPrompt(prompt: unknown): boolean {
    return typeof prompt !== 'string' || prompt.trim().length === 0
}

/** a list of names from the client: strings only, at most 50, or undefined */
function toNameList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) return undefined
    return value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim().slice(0, 64))
        .slice(0, 50)
}

export function getIO(): Server {
    if (!io) {
        throw new Error('Socket.io is not initialized')
    }
    return io
}
