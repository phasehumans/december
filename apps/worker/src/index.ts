import './env'
import { prisma } from '@december/database'
import { isSessionEffort, pausesAfterStop, readStopRequest, runMarkKey } from '@december/shared'
import { Queue, Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import jwt from 'jsonwebtoken'

import { readJobAttachments } from './attachments'
import { readNameList } from './connections'
import { E2BSandboxService } from './e2b-sandbox.service'
import { processGrpcStream, subscribeToInterrupts } from './listener'
import {
    loadOwnKeyProvider,
    normalizeBillingSource,
    OwnKeyUnavailableError,
    resolveSecretsEncKey,
    tagOwnKeyErrors,
} from './llm-source'
import { createRedisSteeringStore, joinRun, watchRunSteering } from './run-steering'
import { stoppedRunEnd, stoppedRunEvents, watchRunStop } from './run-stop'
import { IdleSandboxSweeper } from './sandbox-limits'
import {
    checkRunSpend,
    clearStaleHeldRun,
    prismaSpendLimitStore,
    spendLimitEvent,
    toHeldRun,
} from './spend-limits'
import { TerminalBridgeService } from './terminal-bridge.service'
import { WakeUpSweeper } from './wake-up-sweeper'

import type { RunSteering } from './run-steering'
import type { RunStop } from './run-stop'
import type { LLMProvider } from '@december/providers'

if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    throw new Error('REDIS_URL must be configured in production for Worker.')
}

if (process.env.NODE_ENV === 'production' && !resolveSecretsEncKey()) {
    // credits runs still work; every own-key run would fail until this is set
    console.error(
        '[WORKER ENGINE] SECRETS_ENC_KEY is not set (same value as the server). Own-key runs will fail.'
    )
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const redisConnection: any = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
})
redisConnection.on('error', (err: any) => {
    console.error('[Worker Redis Connection Error]', err?.message || err)
})

// a new message while December works (#637): the waiting messages and the run mark
const steeringStore = createRedisSteeringStore(() => redisConnection)
let agentJobsQueue: Queue | null = null
const getAgentJobsQueue = () => {
    agentJobsQueue ??= new Queue('agent_jobs', { connection: redisConnection })
    return agentJobsQueue
}

console.log("Worker started, waiting for jobs on 'agent_jobs'...")

export const worker = new Worker(
    'agent_jobs',
    async (job: Job) => {
        const { sessionId, userId, taskType, prUrl, gitToken, reviewId, secrets, model, provider } =
            job.data
        const billingSource = normalizeBillingSource(job.data.billingSource)
        const effectiveTaskType = taskType || job.name

        console.log(
            `Processing job ${job.id} (type: ${effectiveTaskType}) for session ${sessionId || reviewId}`
        )

        // admin page (a9): pause or stop one sandbox, on whichever worker started it
        if (effectiveTaskType === 'sandbox_control') {
            const { action, sandboxId } = job.data
            if (action === 'stop' && sandboxId) {
                await E2BSandboxService.destroySandbox({ sandboxId })
                await prisma.session
                    .update({
                        where: { id: sessionId },
                        data: { vmStatus: 'STOPPED', sandboxStatus: 'STOPPED' },
                    })
                    .catch(() => {
                        // Intentionally swallowed: the session may be gone
                    })
                return { status: 'STOPPED' }
            }
            // the pause that follows a stop (#637) must not pause the sandbox under an agent
            // that is still going to run: a prompt sent after the stop holds the session
            if (job.data.afterStop === true && sessionId) {
                const markOwner = await redisConnection
                    .get(runMarkKey(sessionId))
                    .catch((error: unknown) => {
                        console.warn('[WORKER ENGINE] could not read the run mark', error)
                        return null
                    })
                const stoppedRunId =
                    typeof job.data.stoppedRunId === 'string' ? job.data.stoppedRunId : null
                if (!pausesAfterStop({ markOwner, stoppedRunId })) {
                    console.log(
                        `[WORKER ENGINE] Session '${sessionId}' has a new run. Leaving its sandbox as it is.`
                    )
                    return { status: 'SKIPPED', reason: 'a run holds the session' }
                }
            }
            await E2BSandboxService.pauseSandbox({ sessionId, sandboxId })
            return { status: 'PAUSED' }
        }

        // the old github job: github runs are normal sessions now (Session.githubRun)
        if (effectiveTaskType === 'github_issue_fix') {
            console.warn(`[WORKER ENGINE] Discarding old github_issue_fix job #${job.id}`)
            return { status: 'DISCARDED', error: 'github_issue_fix jobs are no longer used' }
        }

        // Handle Ephemeral Tasks (One-Click Fix, Security Audit)
        const isEphemeralTask = ['one_click_fix', 'security_audit'].includes(effectiveTaskType)

        if (isEphemeralTask) {
            if (userId) {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { creditBalance: true },
                })
                if (user && user.creditBalance < 50) {
                    console.warn(
                        `[WORKER ENGINE] Insufficient credits for user '${userId}' to run ephemeral task '${effectiveTaskType}'`
                    )
                    return {
                        reviewId,
                        status: 'FAILED',
                        taskType: effectiveTaskType,
                        output: 'Insufficient balance: A minimum balance of $0.50 is required.',
                    }
                }
            }

            const result = await E2BSandboxService.runEphemeralTask({
                sessionId: sessionId || reviewId,
                taskType: effectiveTaskType as any,
                repoUrl: prUrl,
                gitToken,
                taskRunner: async (sandbox) => {
                    let runOutput = ''
                    if (sandbox.commands?.run) {
                        await sandbox.commands.run('mkdir -p /workspace').catch(() => {})
                        if (prUrl) {
                            await sandbox.commands
                                .run(`git clone ${prUrl} /workspace`)
                                .catch((e: any) => {
                                    console.warn(
                                        `Git clone warning for ephemeral task: ${e?.message || e}`
                                    )
                                })
                        }

                        if (effectiveTaskType === 'security_audit') {
                            const auditRes = await sandbox.commands
                                .run('npm audit --json', { cwd: '/workspace' })
                                .catch(() => null)
                            runOutput = auditRes?.stdout || ''
                        } else if (effectiveTaskType === 'one_click_fix') {
                            const fixRes = await sandbox.commands
                                .run('npm run fix --if-present', { cwd: '/workspace' })
                                .catch(() => null)
                            runOutput = fixRes?.stdout || 'Fix applied'
                        }
                    }
                    return {
                        reviewId,
                        status: 'COMPLETED',
                        taskType: effectiveTaskType,
                        output: runOutput,
                    }
                },
            })
            return result
        }

        // the stop watch of this run (#637), from the sandbox start until the run ends
        let stop: RunStop | undefined
        // the messages sent while this run works (#637). the listener ends it with the run;
        // a job that ends before the run starts ends it here
        let steering: RunSteering | undefined
        let runStarted = false
        // the run was stopped before the agent started (a stop while the job waited in the
        // queue or ran its checks): the run ends as stopped, and no sandbox is started for it
        const endStoppedBeforeStart = async (reason: 'user' | 'limit') => {
            console.log(
                `[WORKER ENGINE] Session '${sessionId}' was stopped before job #${job.id} started. The agent does not start.`
            )
            await prisma.session
                .updateMany({
                    where: { id: sessionId, vmStatus: { in: ['PROVISIONING', 'RUNNING'] } },
                    data: { vmStatus: 'STOPPED' },
                })
                .catch(() => {
                    // Intentionally swallowed: the events below still end the run for the web
                })
            for (const event of stoppedRunEvents({ runningToolCallIds: [], reason })) {
                await E2BSandboxService.emitSessionEvent({ sessionId, event })
            }
            return { status: 'STOPPED', reason }
        }
        try {
            console.log(
                `[WORKER ENGINE] Picked up job #${job.id} (type: ${effectiveTaskType}) for session '${sessionId}'`
            )

            if (sessionId) {
                const session = await prisma.session.findUnique({
                    where: { id: sessionId },
                    select: { id: true },
                })
                if (!session) {
                    console.warn(
                        `[WORKER ENGINE] Session '${sessionId}' not found in database. Discarding stale/orphan job #${job.id}.`
                    )
                    return { status: 'DISCARDED', error: 'Session not found' }
                }
                // one run for a session: the id of this run owns the run mark. a job whose
                // run does not own it must not work; its prompt goes to the run that does
                const runId =
                    typeof job.data.runId === 'string' && job.data.runId
                        ? job.data.runId
                        : `job:${job.id}`
                const joined = await joinRun({
                    store: steeringStore,
                    sessionId,
                    runId,
                    item: {
                        prompt: String(job.data.prompt ?? ''),
                        ...(Number.isInteger(job.data.userMessageSequence)
                            ? { userMessageSequence: job.data.userMessageSequence }
                            : {}),
                        ...(Array.isArray(job.data.attachments)
                            ? { attachments: job.data.attachments }
                            : {}),
                        skills: readNameList(job.data.skills),
                    },
                }).catch((error: unknown) => {
                    // redis failed: the run still works, as it did before marks had an owner
                    console.warn(`[WORKER ENGINE] could not join the run of '${sessionId}'`, error)
                    return 'owner' as const
                })
                if (joined === 'handed-off') {
                    console.warn(
                        `[WORKER ENGINE] Another run works on session '${sessionId}'. Job #${job.id} gave it its prompt.`
                    )
                    return { status: 'DISCARDED', error: 'another run works on the session' }
                }

                // from here the session counts as working. a message that nobody took
                // before the run ended starts a run like this one, with its own prompt
                steering = watchRunSteering({
                    sessionId,
                    runId,
                    store: steeringStore,
                    // the session is free again: the web sends its next queued message
                    onClosed: ({ runFollows }) =>
                        E2BSandboxService.emitSessionEvent({
                            sessionId,
                            event: { type: 'RunClosed', sessionId, runFollows },
                        }),
                    startRun: async (items, nextRunId) => {
                        const last = items[items.length - 1]
                        if (!last) return
                        const {
                            userMessageSequence: _sequence,
                            attachments: _attachments,
                            ...sameRun
                        } = job.data
                        await getAgentJobsQueue().add('run_agent', {
                            ...sameRun,
                            // the session is already marked for this run
                            runId: nextRunId,
                            prompt: last.prompt,
                            // the plan of this run stands: the agent goes on with the work
                            planFirst: false,
                            skills: last.skills ?? [],
                            ...(last.userMessageSequence
                                ? { userMessageSequence: last.userMessageSequence }
                                : {}),
                            ...(last.attachments ? { attachments: last.attachments } : {}),
                        })
                    },
                })

                // a stop can arrive from here on. a stop that came earlier (while the job
                // waited in the queue) left a request in redis: the watch reads it now
                stop = watchRunStop({
                    sessionId,
                    subscribe: subscribeToInterrupts,
                    readStopRequest: () => readStopRequest(redisConnection, { sessionId, runId }),
                })
                await stop.ready
                const stoppedBy = stop.stoppedBy()
                if (stoppedBy) return await endStoppedBeforeStart(stoppedBy)
            }

            // own key: load and decrypt it before a sandbox is provisioned. it stays in memory.
            let ownKeyLlm: LLMProvider | undefined
            let runModel = model
            if (billingSource === 'OWN_KEY') {
                try {
                    const ownKey = await loadOwnKeyProvider({ userId, provider })
                    ownKeyLlm = ownKey.llm
                    // never fall back to december's default model on the user's provider
                    runModel = model || ownKey.defaultModel
                } catch (keyErr: any) {
                    if (!(keyErr instanceof OwnKeyUnavailableError)) throw keyErr
                    await prisma.session
                        .update({ where: { id: sessionId }, data: { vmStatus: 'FAILED' } })
                        .catch(() => {
                            // Intentionally swallowed: DB fallback on own key failure
                        })
                    await E2BSandboxService.emitRunFailure({
                        sessionId,
                        error: {
                            type: 'AgentError',
                            code: 'BYOK_KEY_FAILED',
                            keyFailure: 'missing_key',
                            provider,
                            billingSource,
                            error: keyErr.message,
                            message: keyErr.message,
                        },
                    })
                    return { status: 'FAILED', error: keyErr.message }
                }
            }

            if (userId && billingSource === 'CREDITS') {
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { creditBalance: true },
                })
                if (user && user.creditBalance < 1) {
                    console.warn(
                        `[WORKER ENGINE] Insufficient credits for user '${userId}' on session '${sessionId}'`
                    )
                    await prisma.session
                        .update({
                            where: { id: sessionId },
                            data: { vmStatus: 'FAILED' },
                        })
                        .catch(() => {
                            // Intentionally swallowed: DB fallback on credit check failure
                        })
                    await E2BSandboxService.emitRunFailure({
                        sessionId,
                        error: {
                            type: 'AgentError',
                            code: 'INSUFFICIENT_CREDITS',
                            error: 'Insufficient wallet credits',
                            message:
                                'Insufficient wallet credits. Please add credits at https://app.trydecember.com/settings/billing to continue.',
                        },
                    })
                    return { status: 'FAILED', error: 'Insufficient credits' }
                }
            }

            // spend limits (#638): a run on credits that would start at or over the session
            // limit or the day limit is asked first. it waits on the session row (with no
            // secrets) until the user answers "Continue"; the server then queues it again
            if (sessionId) {
                const reached = await checkRunSpend({
                    userId,
                    sessionId,
                    billingSource,
                    store: prismaSpendLimitStore,
                })
                if (reached) {
                    console.warn(
                        `[WORKER ENGINE] Session '${sessionId}' is at its ${reached.kind} spend limit. Holding job #${job.id}.`
                    )
                    await prisma.session.update({
                        where: { id: sessionId },
                        data: { limitHeldRun: toHeldRun(job.data) as any },
                    })
                    await E2BSandboxService.emitSessionEvent({
                        sessionId,
                        event: spendLimitEvent(reached),
                    })
                    // the open session stops waiting for this run
                    await E2BSandboxService.emitSessionEvent({
                        sessionId,
                        event: stoppedRunEnd('limit'),
                    })
                    return { status: 'HELD', reason: reached.kind }
                }
                // this run starts: a held run that no question asks about is left over, and
                // must not start with the answer to a later question
                await clearStaleHeldRun({ db: prisma, sessionId }).catch((error: unknown) => {
                    console.warn(
                        `[WORKER ENGINE] could not clear the held run of '${sessionId}'`,
                        error
                    )
                })
            }

            // generate short-lived jwt
            const agentTokenSecret = process.env.AGENT_TOKEN_SECRET
            if (process.env.NODE_ENV === 'production' && !agentTokenSecret) {
                throw new Error('AGENT_TOKEN_SECRET must be configured in production for Worker.')
            }

            const token = jwt.sign({ userId, sessionId }, agentTokenSecret || 'secret', {
                expiresIn: '15m',
            })

            // a stop during the checks: no sandbox is started for an agent that never starts.
            // a stop while the sandbox starts cancels the start of the agent: the run then
            // ends as stopped, with the sandbox left as it is
            stop ??= watchRunStop({ sessionId, subscribe: subscribeToInterrupts })
            const stoppedInChecks = stop.stoppedBy()
            if (stoppedInChecks) return await endStoppedBeforeStart(stoppedInChecks)

            // reuse, resume or provision the session's sandbox; past 10 running sandboxes
            // per user the least recently used one is paused first
            console.log(
                `[WORKER ENGINE] Acquiring the sandbox for session '${sessionId}' (userId: '${userId || 'anonymous'}')...`
            )
            const provisionResult = await E2BSandboxService.acquireSessionSandbox({
                sessionId,
                userId,
                secrets,
            })
            console.log(
                `[WORKER ENGINE] E2B Sandbox container '${provisionResult.sandboxId}' is RUNNING (isMock: ${provisionResult.isMock}). Initializing agent session...`
            )

            const isProd = process.env.NODE_ENV === 'production'
            const defaultApiUrl = isProd
                ? 'https://api.trydecember.com/api/v1'
                : 'http://localhost:4000/api/v1'

            const apiHostUrl = process.env.SERVER_URL
                ? `${process.env.SERVER_URL.replace(/\/+$/, '')}/api/v1`
                : process.env.API_URL || defaultApiUrl
            const stream = await E2BSandboxService.runAgentSession({
                sessionId,
                userId,
                sandboxId: provisionResult.sandboxId,
                prompt: job.data.prompt || 'You are Antigravity, an AI agent.',
                workspaceDir: '/workspace',
                token,
                apiHostUrl,
                secrets,
                model: runModel,
                provider,
                ...(ownKeyLlm ? { llm: ownKeyLlm } : {}),
                ...(isSessionEffort(job.data.effort) ? { effort: job.data.effort } : {}),
                planFirst: job.data.planFirst === true,
                ...(Number.isInteger(job.data.userMessageSequence)
                    ? { userMessageSequence: job.data.userMessageSequence }
                    : {}),
                // skills picked for this message, mcp servers off for this session (#632)
                skills: readNameList(job.data.skills),
                disabledMcps: readNameList(job.data.disabledMcps),
                // the files sent with this message (#634)
                attachments: readJobAttachments({ sessionId, value: job.data.attachments }),
                stop,
                steering,
            })

            console.log(
                `[WORKER ENGINE] Agent loop started for session '${sessionId}'. Spawning stream listener...`
            )

            const eventStream =
                billingSource === 'OWN_KEY' && provider ? tagOwnKeyErrors(stream, provider) : stream

            // start listening in the background without blocking the worker pool
            // the listener ends the stop watch and the steering when the run ends
            runStarted = true
            processGrpcStream(sessionId, eventStream, undefined, {
                billingSource,
                stop,
                steering,
            }).catch((e: any) =>
                console.error(`[WORKER ENGINE] Stream failed for session ${sessionId}`, e)
            )

            return { status: 'RUNNING', sandboxId: provisionResult.sandboxId, token }
        } catch (e: any) {
            console.error(
                `[WORKER ENGINE] Failed to process job #${job.id} for session ${sessionId}`,
                e
            )
            // no run started: nothing is left to stop
            stop?.end()
            await prisma.session
                .update({
                    where: { id: sessionId },
                    data: { vmStatus: 'FAILED' },
                })
                .catch(() => {
                    // Intentionally swallowed: DB fallback on job processing error
                })
            throw e
        } finally {
            // no run started (no key, no credits, held at a limit, an error): the session
            // no longer counts as working, and a waiting message starts no run
            if (!runStarted) {
                stop?.end()
                await steering?.end({ discard: true })
            }
        }
    },
    {
        connection: redisConnection,
        concurrency: 5,
    }
)

worker.on('failed', (job: any, err: any) => {
    console.error(`Job ${job?.id} failed with ${err.message}`)
})

export const wakeUpSweeper = new WakeUpSweeper()
// pauses sandboxes with no agent step, terminal input or preview request for 10 minutes
export const idleSandboxSweeper = new IdleSandboxSweeper({
    pause: ({ sessionId, vmId }) =>
        E2BSandboxService.pauseSandbox({ sessionId, sandboxId: vmId ?? undefined }),
    extend: ({ sessionId, vmId }) =>
        E2BSandboxService.extendSandboxTimeout({ sessionId, sandboxId: vmId ?? undefined }),
})
if (process.env.NODE_ENV !== 'test') {
    wakeUpSweeper.start()
    idleSandboxSweeper.start()
    TerminalBridgeService.start().catch((err) => {
        console.error('[WORKER ENGINE] Failed to start TerminalBridgeService:', err)
    })
}

const shutdownGracefully = async () => {
    console.log('Shutting down worker process gracefully...')
    try {
        wakeUpSweeper.stop()
        idleSandboxSweeper.stop()
        await TerminalBridgeService.stop()
        await E2BSandboxService.detachAllActiveAdapters()
        await worker.close()
        await redisConnection.quit()
    } catch {
        // Intentionally swallowed: Force exit on shutdown fallback
    }
    process.exit(0)
}

process.on('SIGINT', shutdownGracefully)
process.on('SIGTERM', shutdownGracefully)
