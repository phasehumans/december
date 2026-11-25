import './env'
import { prisma } from '@december/database'
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import jwt from 'jsonwebtoken'

import { E2BSandboxService } from './e2b-sandbox.service'
import { processGrpcStream } from './listener'
import {
    loadOwnKeyProvider,
    normalizeBillingSource,
    OwnKeyUnavailableError,
    resolveSecretsEncKey,
    tagOwnKeyErrors,
} from './llm-source'
import { IdleSandboxSweeper } from './sandbox-limits'
import { TerminalBridgeService } from './terminal-bridge.service'
import { WakeUpSweeper } from './wake-up-sweeper'

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
                    await E2BSandboxService.emitSessionEvent({
                        sessionId,
                        event: {
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
                    await E2BSandboxService.emitSessionEvent({
                        sessionId,
                        event: {
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

            // generate short-lived jwt
            const agentTokenSecret = process.env.AGENT_TOKEN_SECRET
            if (process.env.NODE_ENV === 'production' && !agentTokenSecret) {
                throw new Error('AGENT_TOKEN_SECRET must be configured in production for Worker.')
            }

            const token = jwt.sign({ userId, sessionId }, agentTokenSecret || 'secret', {
                expiresIn: '15m',
            })

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
            })

            console.log(
                `[WORKER ENGINE] Agent loop started for session '${sessionId}'. Spawning stream listener...`
            )

            const eventStream =
                billingSource === 'OWN_KEY' && provider ? tagOwnKeyErrors(stream, provider) : stream

            // start listening in the background without blocking the worker pool
            processGrpcStream(sessionId, eventStream, undefined, { billingSource }).catch(
                (e: any) =>
                    console.error(`[WORKER ENGINE] Stream failed for session ${sessionId}`, e)
            )

            return { status: 'RUNNING', sandboxId: provisionResult.sandboxId, token }
        } catch (e: any) {
            console.error(
                `[WORKER ENGINE] Failed to process job #${job.id} for session ${sessionId}`,
                e
            )
            await prisma.session
                .update({
                    where: { id: sessionId },
                    data: { vmStatus: 'FAILED' },
                })
                .catch(() => {
                    // Intentionally swallowed: DB fallback on job processing error
                })
            throw e
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
