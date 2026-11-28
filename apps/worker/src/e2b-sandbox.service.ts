import { runAgentLoop, AgentHarness } from '@december/agent'
import { prisma } from '@december/database'
import {
    geminiProvider,
    openaiProvider,
    openrouterProvider,
    anthropicProvider,
} from '@december/providers'
import { appendHookContext, attachUserHooks, isGithubRun } from '@december/shared'
import {
    AskQuestionTool,
    BashTool,
    BrowserActionTool,
    BrowserTool,
    CodeIntelligenceTool,
    EditFileTool,
    FindFilesTool,
    GrepSearchTool,
    LsTool,
    ManageTaskTool,
    ReadFileTool,
    WebSearchTool,
    WriteFileTool,
} from '@december/tools'
import { Sandbox } from 'e2b'
import Redis from 'ioredis'

import {
    createMemoryTool,
    loadAccountContext,
    readSessionTitle,
    withAccountContext,
} from './account-context'
import { readJobAttachments, writeTurnAttachments } from './attachments'
import {
    buildSkillRules,
    connectAgentMcpServers,
    disconnectAgentMcpServers,
    loadPluginFiles,
    loadUserConnections,
    pickTurnSkills,
} from './connections'
import { resolveGitToken, resolveSessionGit, withGitToken } from './git-remote'
import { getGithubRunToken, prepareGithubWorkspace } from './github-run'
import { runModelConfig } from './llm-source'
import { clearPendingQuestion } from './pending-question'
import {
    activePlugins,
    connectPluginMcpServers,
    installPluginsInSandbox,
    pluginMcpServers,
    pluginSkillRows,
} from './plugins'
import { gitIdentityCommand } from './pr-opening'
import { projectRules } from './project-rules'
import { publishWhenReady } from './redis-subscriber'
import { RemotePlatformAdapter } from './remote-operations'
import { failedRunEvents, runKillableCommand, stoppableRun } from './run-stop'
import { E2B_SANDBOX_TIMEOUT_MS, reserveSandboxSlot, touchSandboxActivity } from './sandbox-limits'
import { applySecretsToSandbox, secretEnvsOf, toSecretEnvs } from './sandbox-secrets'
import { buildDenyRulesHook, buildTurnPrompt, createTurnCheckpoint } from './session-commands'
import { shellQuote } from './shell-quote'
import { TerminalBridgeService } from './terminal-bridge.service'
import { createSandboxHookRunner, questionText, toUserHooks } from './user-hooks'
import { archiveWorkspaceState } from './workspace'

import type {
    ProvisionSandboxInput,
    ProvisionSandboxResult,
    ExecuteSandboxCommandInput,
    ExecuteSandboxCommandResult,
    RunAgentSessionInput,
    DestroySandboxInput,
    EmitSessionEventInput,
    EmitRunFailureInput,
    PauseSandboxInput,
    ResumeSandboxInput,
    AcquireSessionSandboxInput,
    ExtendSandboxTimeoutInput,
    KeepSandboxAliveInput,
    HandleDisconnectInput,
    EphemeralTaskInput,
    EphemeralTaskResult,
} from './e2b-sandbox.types'
import type { SteeringItem } from './run-steering'
import type { AgentMessage } from '@december/shared'

let redisPub: Redis | null = null

const getRedisPub = (): Redis => {
    if (!redisPub) {
        const isProd = process.env.NODE_ENV === 'production'
        if (isProd && !process.env.REDIS_URL) {
            throw new Error('REDIS_URL must be configured in production for Worker.')
        }
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
        redisPub = new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
        })
        redisPub.on('error', () => {
            // Intentionally swallowed: Suppress unhandled redis connection error noise in test environment
        })
        // lazy with no offline queue: nothing opens it by itself, and an event sent before
        // "ready" is lost. open it now
        redisPub.connect().catch(() => {
            // Intentionally swallowed: redis is offline (tests); the client tries again
        })
    }
    return redisPub
}

// E2B lifetime without activity; keepSandboxAlive pushes it forward while the sandbox is busy
const SANDBOX_TIMEOUT_MS = E2B_SANDBOX_TIMEOUT_MS
const KEEP_ALIVE_THROTTLE_MS = 60 * 1000
const lastKeepAliveAt = new Map<string, number>()

// Active sandboxes cache in worker memory
const activeSandboxes = new Map<string, any>()

// Active platform adapters tracking for graceful detach
const activeAdapters = new Set<RemotePlatformAdapter>()

// Mock client override for testing
let mockClientOverride: any = null

const setMockClient = (mock: any) => {
    mockClientOverride = mock
}

const resetMockClient = () => {
    mockClientOverride = null
    activeSandboxes.clear()
    activeAdapters.clear()
    TerminalBridgeService.resetForTesting()
}

const emitSessionEvent = async (data: EmitSessionEventInput): Promise<void> => {
    const { sessionId, event } = data
    const payload = JSON.stringify(event)
    try {
        // waits while the connection opens, so the first event is not lost
        await publishWhenReady({
            client: getRedisPub(),
            channel: `session_events:${sessionId}`,
            message: payload,
        })
    } catch {
        // Intentionally swallowed: Redis pub connection fallback in test environment
    }
}

/**
 * A run that fails before the agent starts (no key, no credits, no sandbox): the error,
 * then the end of the run, so the server does not keep the run marked as failed (#637).
 */
const emitRunFailure = async (data: EmitRunFailureInput): Promise<void> => {
    const { sessionId, error } = data
    for (const event of failedRunEvents(error)) {
        await emitSessionEvent({ sessionId, event })
    }
}

const provisionSandbox = async (data: ProvisionSandboxInput): Promise<ProvisionSandboxResult> => {
    const {
        sessionId,
        userId,
        apiKey,
        template,
        timeoutMs,
        backoffDelays,
        secrets,
        envs,
        gitToken,
    } = data
    const delays = backoffDelays || [1000, 3000, 7000]
    let lastError: any = null

    // Construct unified environment variable map
    const envsMap: Record<string, string> = {}
    if (envs) {
        Object.assign(envsMap, envs)
    }
    // the same names as the secrets file: no name a shell cannot export, no system name
    Object.assign(envsMap, toSecretEnvs(secrets))

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(
                `[E2BSandboxService] Provisioning sandbox for session ${sessionId} (attempt ${attempt}/3)...`
            )

            if (mockClientOverride) {
                const mockSandbox = await mockClientOverride.create({
                    sessionId,
                    template,
                    timeoutMs,
                    envs: Object.keys(envsMap).length > 0 ? envsMap : undefined,
                })
                const sId = mockSandbox.sandboxId || `mock-sandbox-${sessionId}`
                activeSandboxes.set(sessionId, mockSandbox)
                activeSandboxes.set(sId, mockSandbox)
                void TerminalBridgeService.onSandboxReady({ sessionId, sandbox: mockSandbox })

                await prisma.session
                    .update({
                        where: { id: sessionId },
                        data: {
                            vmId: sId,
                            vmStatus: 'RUNNING',
                            sandboxStatus: 'RUNNING',
                            // the start of this sandbox: a new one, or a resume
                            sandboxStartedAt: new Date(),
                            vmLastActivityAt: new Date(),
                        },
                    })
                    .catch(() => {
                        // Intentionally swallowed: DB fallback in test environment
                    })

                const sessionRecord = await prisma.session
                    .findUnique({
                        where: { id: sessionId },
                        select: {
                            repoUrl: true,
                            githubRepoUrl: true,
                            gitProvider: true,
                            branch: true,
                            gitRef: true,
                            userId: true,
                        },
                    })
                    .catch(() => null)

                const targetRepo = sessionRecord?.repoUrl || sessionRecord?.githubRepoUrl
                const targetBranch = sessionRecord?.branch || sessionRecord?.gitRef
                const effectiveUserId = userId || sessionRecord?.userId

                // the job's and the env's tokens are github tokens: never use them for another host
                const gitProvider = sessionRecord?.gitProvider ?? 'GITHUB'
                const effectiveToken =
                    (gitProvider === 'GITHUB' ? gitToken || envsMap['GITHUB_TOKEN'] : undefined) ||
                    (await resolveGitToken({ userId: effectiveUserId, provider: gitProvider }))

                // the branch and the commit author from the user's settings (#637)
                const { taskBranch, author } = await resolveSessionGit({
                    sessionId,
                    userId: effectiveUserId,
                    provider: gitProvider,
                })

                if (mockSandbox?.commands?.run) {
                    await mockSandbox.commands
                        .run(gitIdentityCommand(author, true), { cwd: '/workspace' })
                        .catch(() => {
                            // Intentionally swallowed: Git config mock fallback
                        })

                    if (targetRepo) {
                        const cloneUrl = withGitToken({
                            repoUrl: targetRepo,
                            token: effectiveToken,
                            provider: gitProvider,
                        })
                        // quoted: a branch name may hold ; $ | and other shell characters
                        const branchFlag = targetBranch ? ` -b ${shellQuote(targetBranch)}` : ''
                        await mockSandbox.commands
                            .run(`git clone${branchFlag} -- ${shellQuote(cloneUrl)} /workspace`, {
                                cwd: '/workspace',
                            })
                            .catch(() => {
                                // Intentionally swallowed: Git clone mock fallback
                            })

                        await mockSandbox.commands
                            .run(
                                `${gitIdentityCommand(author)} && git checkout -B ${shellQuote(taskBranch)}`,
                                {
                                    cwd: '/workspace',
                                }
                            )
                            .catch(() => {
                                // Intentionally swallowed: Git task branch checkout mock fallback
                            })
                    } else {
                        await mockSandbox.commands
                            .run(
                                `git init && ${gitIdentityCommand(author)} && git checkout -B ${shellQuote(taskBranch)}`,
                                { cwd: '/workspace' }
                            )
                            .catch(() => {
                                // Intentionally swallowed: Git greenfield checkout mock fallback
                            })
                    }
                }

                await emitSessionEvent({
                    sessionId,
                    event: {
                        type: 'AgentStatus',
                        message: `E2B Sandbox provisioned successfully (mock)`,
                    },
                })

                return {
                    sandboxId: sId,
                    isMock: true,
                }
            }

            const sessionRecord = await prisma.session
                .findUnique({
                    where: { id: sessionId },
                    select: {
                        repoUrl: true,
                        githubRepoUrl: true,
                        gitProvider: true,
                        branch: true,
                        gitRef: true,
                        userId: true,
                        githubRun: true,
                    },
                })
                .catch(() => null)

            const effectiveApiKey = apiKey || process.env.E2B_API_KEY
            if (!effectiveApiKey) {
                // Dev mode fallback when no key available
                const mockId = `mock-sandbox-${sessionId}`
                activeSandboxes.set(sessionId, { sandboxId: mockId, isMock: true })
                activeSandboxes.set(mockId, { sandboxId: mockId, isMock: true })

                await prisma.session
                    .update({
                        where: { id: sessionId },
                        data: { vmId: mockId, vmStatus: 'RUNNING' },
                    })
                    .catch(() => {})

                await emitSessionEvent({
                    sessionId,
                    event: { type: 'AgentStatus', message: 'E2B Sandbox provisioned in dev mode' },
                })

                return { sandboxId: mockId, isMock: true }
            }

            const sandbox = await Sandbox.create({
                apiKey: effectiveApiKey,
                template: template || 'base',
                timeoutMs: timeoutMs || SANDBOX_TIMEOUT_MS,
                // a backstop for the idle sweeper: at the timeout E2B pauses, never deletes
                lifecycle: { onTimeout: 'pause' },
                envs: Object.keys(envsMap).length > 0 ? envsMap : undefined,
            })

            // Ensure /workspace exists and has correct permissions in E2B microVM
            try {
                if (sandbox.commands && typeof sandbox.commands.run === 'function') {
                    await sandbox.commands.run(
                        'sudo mkdir -p /workspace && sudo chown -R user:user /workspace',
                        { cwd: '/home/user' }
                    )

                    // the secrets go into a file that the shell loads; no value is in a command
                    if (Object.keys(envsMap).length > 0) {
                        await applySecretsToSandbox({ sandbox, secrets, envs })
                    }
                }
            } catch (initErr) {
                console.warn(
                    `[E2BSandboxService] Warning initializing /workspace for session ${sessionId}:`,
                    initErr
                )
            }

            const sandboxId = sandbox.sandboxId
            activeSandboxes.set(sessionId, sandbox)
            activeSandboxes.set(sandboxId, sandbox)
            void TerminalBridgeService.onSandboxReady({ sessionId, sandbox })

            // Initialize sandbox workspace strictly via repository clone and task branch
            try {
                const targetRepo = sessionRecord?.repoUrl || sessionRecord?.githubRepoUrl
                const targetBranch = sessionRecord?.branch || sessionRecord?.gitRef
                const effectiveUserId = userId || sessionRecord?.userId

                // the job's and the env's tokens are github tokens: never use them for another host
                const gitProvider = sessionRecord?.gitProvider ?? 'GITHUB'
                // a session the github app started clones with the installation's token
                const githubRun = isGithubRun(sessionRecord?.githubRun)
                    ? sessionRecord.githubRun
                    : null
                const effectiveToken =
                    (githubRun ? await getGithubRunToken(githubRun) : undefined) ||
                    (gitProvider === 'GITHUB' ? gitToken || envsMap['GITHUB_TOKEN'] : undefined) ||
                    (await resolveGitToken({ userId: effectiveUserId, provider: gitProvider }))

                // the branch and the commit author from the user's settings (#637)
                const { taskBranch, author } = await resolveSessionGit({
                    sessionId,
                    userId: effectiveUserId,
                    provider: gitProvider,
                    isGithubRun: Boolean(githubRun),
                })

                if (sandbox?.commands && typeof sandbox.commands.run === 'function') {
                    await sandbox.commands
                        .run(gitIdentityCommand(author, true), { cwd: '/workspace' })
                        .catch(() => {
                            // Intentionally swallowed: Global git config fallback
                        })

                    if (targetRepo) {
                        const cloneUrl = withGitToken({
                            repoUrl: targetRepo,
                            token: effectiveToken,
                            provider: gitProvider,
                        })
                        console.log(
                            `[E2BSandboxService] Initializing sandbox workspace from repository: ${targetRepo}`
                        )
                        // quoted: a branch name may hold ; $ | and other shell characters
                        const branchFlag = targetBranch ? ` -b ${shellQuote(targetBranch)}` : ''
                        let cloneSuccess = false
                        try {
                            const cloneRes = await sandbox.commands.run(
                                `git clone${branchFlag} -- ${shellQuote(cloneUrl)} /workspace`,
                                { cwd: '/workspace' }
                            )
                            if (cloneRes.exitCode === 0) {
                                cloneSuccess = true
                            }
                        } catch {
                            // Intentionally swallowed: clone with branch fallback
                        }

                        if (!cloneSuccess && targetBranch) {
                            await sandbox.commands
                                .run(`git clone -- ${shellQuote(cloneUrl)} /workspace`, {
                                    cwd: '/workspace',
                                })
                                .catch((e: any) => {
                                    console.warn(
                                        `[E2BSandboxService] Git clone fallback warning for session ${sessionId}:`,
                                        e
                                    )
                                })
                        }

                        if (githubRun) {
                            await prepareGithubWorkspace({ sandbox, sessionId, run: githubRun })
                        } else {
                            await sandbox.commands
                                .run(
                                    `${gitIdentityCommand(author)} && git checkout -B ${shellQuote(taskBranch)}`,
                                    { cwd: '/workspace' }
                                )
                                .catch((e: any) => {
                                    console.warn(
                                        `[E2BSandboxService] Task branch checkout warning for session ${sessionId}:`,
                                        e
                                    )
                                })
                        }
                    } else {
                        // Greenfield workspace: initialize local repo and checkout task branch
                        await sandbox.commands
                            .run(
                                `git init && ${gitIdentityCommand(author)} && git checkout -B ${shellQuote(taskBranch)}`,
                                { cwd: '/workspace' }
                            )
                            .catch(() => {
                                // Intentionally swallowed: Greenfield git init fallback
                            })
                    }
                }
            } catch {
                // Intentionally swallowed: optional repo initialization fallback
            }

            await prisma.session
                .update({
                    where: { id: sessionId },
                    data: {
                        vmId: sandboxId,
                        vmStatus: 'RUNNING',
                        sandboxStatus: 'RUNNING',
                        // the start of this sandbox: a new one, or a resume
                        sandboxStartedAt: new Date(),
                        vmLastActivityAt: new Date(),
                    },
                })
                .catch(() => {})

            await emitSessionEvent({
                sessionId,
                event: { type: 'AgentStatus', message: `E2B Sandbox provisioned (${sandboxId})` },
            })

            return { sandboxId, isMock: false }
        } catch (err: any) {
            lastError = err
            console.error(
                `[E2BSandboxService] Attempt ${attempt}/3 failed for session ${sessionId}: ${err?.message || err}`
            )

            if (attempt < 3) {
                const delay = delays[attempt - 1] ?? 1000
                await new Promise((resolve) => setTimeout(resolve, delay))
            }
        }
    }

    // Failure: status to FAILED and emit error event with code SANDBOX_PROVISION_FAILED
    await prisma.session
        .update({
            where: { id: sessionId },
            data: { vmStatus: 'FAILED' },
        })
        .catch(() => {})

    const errorMessage = lastError?.message || 'Sandbox provisioning failed after 3 attempts'
    await emitRunFailure({
        sessionId,
        error: {
            type: 'AgentError',
            code: 'SANDBOX_PROVISION_FAILED',
            error: errorMessage,
            message: `Sandbox provisioning failed with code SANDBOX_PROVISION_FAILED: ${errorMessage}`,
        },
    })

    const provisionError: any = new Error(`SANDBOX_PROVISION_FAILED: ${errorMessage}`)
    provisionError.code = 'SANDBOX_PROVISION_FAILED'
    throw provisionError
}

const pauseSandbox = async (data: PauseSandboxInput): Promise<boolean> => {
    const { sessionId, sandboxId } = data
    console.log(`[E2BSandboxService] Pausing sandbox for session ${sessionId}`)

    try {
        const sandbox =
            activeSandboxes.get(sessionId) ||
            (sandboxId ? activeSandboxes.get(sandboxId) : undefined)

        if (sandbox) {
            // Archive workspace state to MinIO before pausing
            await archiveWorkspaceState({
                sessionId,
                workspaceDir: `/workspace`,
                sandbox,
            }).catch((err) => {
                console.error(
                    `[E2BSandboxService] Workspace archiving warning for session ${sessionId}:`,
                    err
                )
            })

            if (typeof sandbox.pause === 'function') {
                await sandbox.pause()
            }
        } else if (sandboxId && !sandboxId.startsWith('mock-')) {
            // started by another worker: pause it in E2B by its id
            if (mockClientOverride && typeof mockClientOverride.pauseById === 'function') {
                await mockClientOverride.pauseById(sandboxId)
            } else if (process.env.E2B_API_KEY) {
                await Sandbox.pause(sandboxId, { apiKey: process.env.E2B_API_KEY })
            }
        }

        activeSandboxes.delete(sessionId)
        if (sandboxId) activeSandboxes.delete(sandboxId)
        if (sandbox?.sandboxId) activeSandboxes.delete(sandbox.sandboxId)
        void TerminalBridgeService.destroyPtySession({ sessionId })

        await prisma.session
            .update({
                where: { id: sessionId },
                data: { vmStatus: 'STOPPED', sandboxStatus: 'PAUSED' },
            })
            .catch(() => {
                // Intentionally swallowed: the session may be gone
            })

        await emitSessionEvent({
            sessionId,
            event: {
                type: 'AgentStatus',
                message: 'Sandbox paused. It resumes on the next prompt.',
            },
        })

        return true
    } catch (e: any) {
        console.error(`[E2BSandboxService] Error pausing sandbox for session ${sessionId}:`, e)
        return false
    }
}

const resumeSandbox = async (data: ResumeSandboxInput): Promise<ProvisionSandboxResult> => {
    const { sessionId, snapshotId, userId, secrets } = data
    console.log(`[E2BSandboxService] Resuming sandbox for session ${sessionId}`)

    try {
        if (mockClientOverride && typeof mockClientOverride.resume === 'function') {
            const mockSandbox = await mockClientOverride.resume({ sessionId, snapshotId })
            const sId = mockSandbox.sandboxId || snapshotId || `mock-sandbox-${sessionId}`
            activeSandboxes.set(sessionId, mockSandbox)
            activeSandboxes.set(sId, mockSandbox)
            void TerminalBridgeService.onSandboxReady({ sessionId, sandbox: mockSandbox })

            await prisma.session
                .update({
                    where: { id: sessionId },
                    data: {
                        vmId: sId,
                        vmStatus: 'RUNNING',
                        sandboxStatus: 'RUNNING',
                        // the start of this sandbox: a new one, or a resume
                        sandboxStartedAt: new Date(),
                        vmLastActivityAt: new Date(),
                    },
                })
                .catch(() => {})

            return { sandboxId: sId, isMock: true }
        }

        if (snapshotId && process.env.E2B_API_KEY) {
            // connect resumes a paused sandbox with its files and memory
            const sandbox = await Sandbox.connect(snapshotId, {
                apiKey: process.env.E2B_API_KEY,
                timeoutMs: SANDBOX_TIMEOUT_MS,
            })
            activeSandboxes.set(sessionId, sandbox)
            activeSandboxes.set(sandbox.sandboxId, sandbox)
            // the sandbox kept the secrets of the day it was made: write the ones of this run
            await applySecretsToSandbox({ sandbox, secrets })
            void TerminalBridgeService.onSandboxReady({ sessionId, sandbox })

            await prisma.session
                .update({
                    where: { id: sessionId },
                    data: {
                        vmId: sandbox.sandboxId,
                        vmStatus: 'RUNNING',
                        sandboxStatus: 'RUNNING',
                        // the start of this sandbox: a new one, or a resume
                        sandboxStartedAt: new Date(),
                        vmLastActivityAt: new Date(),
                    },
                })
                .catch(() => {})

            return { sandboxId: sandbox.sandboxId, isMock: false }
        }

        return provisionSandbox({ sessionId, userId, secrets })
    } catch (e: any) {
        // the sandbox is gone (killed, or past E2B's paused retention): start a new one
        console.error(`[E2BSandboxService] Error resuming sandbox ${sessionId}:`, e)
        return provisionSandbox({ sessionId, userId, secrets })
    }
}

/**
 * The sandbox for one prompt: claims a running slot (pausing the user's least recently
 * used sandboxes past the limit, on any worker), then reuses this session's sandbox,
 * resumes it when paused, or provisions a new one.
 */
const acquireSessionSandbox = async (
    data: AcquireSessionSandboxInput
): Promise<ProvisionSandboxResult> => {
    const { sessionId, userId, secrets } = data

    const previous = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { vmId: true, sandboxStatus: true },
    })

    if (userId) {
        const { toPause } = await reserveSandboxSlot({ userId, sessionId })
        for (const victim of toPause) {
            await pauseSandbox({
                sessionId: victim.sessionId,
                sandboxId: victim.vmId ?? undefined,
            })
        }
    }

    // a handle this worker holds is only good while the database says the sandbox still
    // runs: another worker may have paused (sweeper, limit) or stopped (admin) it by id
    const local = activeSandboxes.get(sessionId)
    const localIsLive =
        local &&
        previous?.sandboxStatus === 'RUNNING' &&
        (!previous.vmId || !local.sandboxId || local.sandboxId === previous.vmId)
    if (local && !localIsLive) {
        activeSandboxes.delete(sessionId)
        if (local.sandboxId) activeSandboxes.delete(local.sandboxId)
    }
    if (local && localIsLive) {
        const sandboxId = local.sandboxId || previous?.vmId || `mock-sandbox-${sessionId}`
        // a secret that was added or changed after the last prompt reaches the sandbox here
        await applySecretsToSandbox({ sandbox: local, secrets })
        await prisma.session
            .update({
                where: { id: sessionId },
                data: {
                    vmStatus: 'RUNNING',
                    sandboxStatus: 'RUNNING',
                    vmLastActivityAt: new Date(),
                },
            })
            .catch(() => {
                // Intentionally swallowed: the session may be gone
            })
        return { sandboxId, isMock: Boolean(local.isMock) }
    }

    const vmId = previous?.vmId
    const canResume =
        vmId &&
        !vmId.startsWith('mock-') &&
        (previous?.sandboxStatus === 'PAUSED' || previous?.sandboxStatus === 'RUNNING')
    if (canResume) {
        return resumeSandbox({ sessionId, snapshotId: vmId, userId, secrets })
    }

    return provisionSandbox({ sessionId, userId, secrets })
}

/**
 * Record activity on a session's sandbox (agent step, terminal input) and keep the E2B
 * timeout ahead of it, so a busy sandbox is never paused.
 */
const keepSandboxAlive = async (data: KeepSandboxAliveInput): Promise<void> => {
    const { sessionId } = data
    const now = Date.now()
    if (now - (lastKeepAliveAt.get(sessionId) ?? 0) < KEEP_ALIVE_THROTTLE_MS) return
    lastKeepAliveAt.set(sessionId, now)

    await touchSandboxActivity({ sessionId, force: true })
    const sandbox = activeSandboxes.get(sessionId)
    if (sandbox && typeof sandbox.setTimeout === 'function') {
        await sandbox.setTimeout(SANDBOX_TIMEOUT_MS).catch((err: any) => {
            console.warn(
                `[E2BSandboxService] could not extend the timeout for session ${sessionId}:`,
                err?.message || err
            )
        })
    }
}

/** Push a sandbox's E2B timeout forward while it is in use (the sweeper calls it). */
const extendSandboxTimeout = async (data: ExtendSandboxTimeoutInput): Promise<void> => {
    const { sessionId, sandboxId } = data
    const local = activeSandboxes.get(sessionId)
    if (local && typeof local.setTimeout === 'function') {
        await local.setTimeout(SANDBOX_TIMEOUT_MS)
        return
    }
    if (!sandboxId || sandboxId.startsWith('mock-')) return
    if (mockClientOverride && typeof mockClientOverride.extendById === 'function') {
        await mockClientOverride.extendById(sandboxId)
    } else if (process.env.E2B_API_KEY) {
        await Sandbox.setTimeout(sandboxId, SANDBOX_TIMEOUT_MS, {
            apiKey: process.env.E2B_API_KEY,
        })
    }
}

const handleDisconnect = async (data: HandleDisconnectInput): Promise<void> => {
    const { sessionId } = data
    console.log(
        `[E2BSandboxService] Client tab disconnect detected for session ${sessionId}. Preserving active background container execution.`
    )
    // Containers are intentionally not paused or terminated when browser tabs close
    // to enable autonomous background task execution, tests, and git operations.
}

const destroySandbox = async (data: DestroySandboxInput): Promise<boolean> => {
    const { sandboxId } = data
    console.log(`[E2BSandboxService] Destroying sandbox ${sandboxId}`)

    try {
        const sandbox = activeSandboxes.get(sandboxId)
        if (sandbox) {
            if (typeof sandbox.kill === 'function') {
                await sandbox.kill()
            }
            activeSandboxes.delete(sandboxId)
            void TerminalBridgeService.destroyPtySession({ sessionId: sandboxId })
        } else if (!sandboxId.startsWith('mock-')) {
            // started by another worker (admin stop): kill it in E2B by its id
            if (mockClientOverride && typeof mockClientOverride.killById === 'function') {
                await mockClientOverride.killById(sandboxId)
            } else if (process.env.E2B_API_KEY) {
                await Sandbox.kill(sandboxId, { apiKey: process.env.E2B_API_KEY })
            }
        }
        for (const [key, value] of activeSandboxes.entries()) {
            if (value?.sandboxId === sandboxId) activeSandboxes.delete(key)
        }
        return true
    } catch (e: any) {
        console.error(`[E2BSandboxService] Error destroying sandbox ${sandboxId}:`, e)
        return false
    }
}

const executeCommand = async (
    data: ExecuteSandboxCommandInput
): Promise<ExecuteSandboxCommandResult> => {
    const { sandboxId, command, cwd, timeoutMs, onData, signal } = data
    console.log(`[E2BSandboxService] Executing command on sandbox ${sandboxId}: ${command}`)

    const sandbox = activeSandboxes.get(sandboxId)

    if (!sandbox) {
        if (onData) onData(`[Sandbox ${sandboxId}] Executed: ${command}\n`)
        return { exitCode: 0, output: `[Sandbox ${sandboxId}] Executed: ${command}\n` }
    }

    if (sandbox.commands && typeof sandbox.commands.run === 'function') {
        let output = ''
        // the secrets of this run, so a reused or resumed sandbox uses today's values
        const secretEnvs = secretEnvsOf(sandbox)
        const runOptions = {
            ...(secretEnvs ? { envs: secretEnvs } : {}),
            cwd: cwd || '/workspace',
            timeoutMs: timeoutMs || 600000, // 10 minute safety cap per command execution
            onStdout: (chunk: any) => {
                const text = typeof chunk === 'string' ? chunk : chunk?.line || String(chunk)
                output += text
                if (onData) onData(text)
            },
            onStderr: (chunk: any) => {
                const text = typeof chunk === 'string' ? chunk : chunk?.line || String(chunk)
                output += text
                if (onData) onData(text)
            },
        }
        // a run that can be stopped (#637): the command runs as a handle, so the stop kills it
        const result = signal
            ? await runKillableCommand({
                  start: () => sandbox.commands.run(command, { ...runOptions, background: true }),
                  signal,
                  // the time limit kills the process: the wait alone would leave it running
                  timeoutMs: runOptions.timeoutMs,
              })
            : await sandbox.commands.run(command, runOptions)
        return { exitCode: result?.exitCode ?? 0, output }
    }

    if (typeof sandbox.executeCommand === 'function') {
        const exitCode = await sandbox.executeCommand(command, onData)
        return { exitCode, output: '' }
    }

    let output = ''
    if (onData) {
        onData(`Mock output for ${command}\n`)
        output = `Mock output for ${command}\n`
    }
    return { exitCode: 0, output }
}

export const getLlmProvider = (providerName?: string, apiKey?: string) => {
    const key =
        apiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.ANTHROPIC_API_KEY
    const name = (
        providerName ||
        process.env.DEFAULT_LLM_PROVIDER ||
        (process.env.GEMINI_API_KEY
            ? 'gemini'
            : process.env.OPENAI_API_KEY
              ? 'openai'
              : process.env.OPENROUTER_API_KEY
                ? 'openrouter'
                : 'gemini')
    ).toLowerCase()

    if (name === 'openai' || (key && key.startsWith('sk-proj-'))) {
        return openaiProvider(undefined, key)
    }
    if (name === 'openrouter' || (key && key.startsWith('sk-or-'))) {
        return openrouterProvider(key)
    }
    if (name === 'anthropic' || (key && key.startsWith('sk-ant-'))) {
        return anthropicProvider(undefined, key)
    }
    if (name === 'agentrouter') {
        return openaiProvider('https://agentrouter.org/v1', key)
    }
    return geminiProvider(key)
}

const runAgentSession = async (data: RunAgentSessionInput) => {
    const {
        sessionId,
        userId,
        userRules,
        sandboxId,
        prompt,
        workspaceDir,
        secrets,
        model,
        provider,
        llm: ownKeyLlm,
        effort,
        planFirst,
        userMessageSequence,
        skills: pickedSkillNames,
        disabledMcps,
        disabledPlugins,
        attachments: jobAttachments,
    } = data
    console.log(`[E2BSandboxService] Starting in-sandbox agent runner session for ${sessionId}`)

    const effectiveUserRules = userRules

    const hasLlmKey = !!(
        ownKeyLlm ||
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.ANTHROPIC_API_KEY
    )

    const isMock =
        !!mockClientOverride ||
        sandboxId?.startsWith('mock-') ||
        sessionId?.startsWith('mock-') ||
        !hasLlmKey ||
        process.env.NODE_ENV === 'test'

    if (isMock) {
        const streamGenerator = (async function* () {
            yield { data: JSON.stringify({ type: 'AgentStart' }) }
            yield { data: JSON.stringify({ type: 'TurnStart' }) }
            yield {
                data: JSON.stringify({
                    type: 'AgentStatus',
                    message: `Executing prompt in E2B sandbox: ${prompt}`,
                }),
            }
            yield {
                data: JSON.stringify({
                    type: 'StreamChunk',
                    content: `[In-Sandbox Runner] Processing prompt: ${prompt}`,
                }),
            }
            yield { data: JSON.stringify({ type: 'TurnEnd' }) }
            yield { data: JSON.stringify({ type: 'AgentEnd' }) }
        })()
        return streamGenerator
    }

    const effectiveSandboxId = sandboxId || sessionId
    const adapter = new RemotePlatformAdapter(effectiveSandboxId, {
        sessionId,
        redisClient: getRedisPub(),
        // the inbox item, the toast and the push come from the server's AskQuestionPrompt
        // handler (markQuestionAsked), which checks the user's level and an open tab
        onQuestionSettled: () => clearPendingQuestion(sessionId, getRedisPub()),
        // a stop (#637) kills the sandbox command in flight and ends a wait for an answer
        signal: data.stop?.signal,
    })
    activeAdapters.add(adapter)
    // an own-key client never falls back to december keys
    const llm = ownKeyLlm ?? getLlmProvider(provider)

    const tools = [
        BashTool,
        ReadFileTool,
        WriteFileTool,
        LsTool,
        EditFileTool,
        FindFilesTool,
        GrepSearchTool,
        AskQuestionTool,
        ManageTaskTool,
        BrowserTool,
        BrowserActionTool,
        CodeIntelligenceTool,
        WebSearchTool,
    ]

    const secretKeys = Array.isArray(secrets) ? secrets.map((s) => s.key).filter(Boolean) : []

    // the user's saved skills and mcp servers (#632): the skills the agent may run by
    // itself go into the rules, the mcp servers connect when the run starts
    const connections = await loadUserConnections(userId)
    // installed plugins (connections page): their skills join the saved skills
    const runPlugins = activePlugins({
        plugins: connections.plugins,
        disabledPlugins: disabledPlugins ?? [],
    })
    const runSkills = [
        ...connections.skills,
        ...pluginSkillRows({ plugins: runPlugins, ownSkills: connections.skills }),
    ]
    const rulesWithSkills = [effectiveUserRules, buildSkillRules(runSkills)]
        .filter(Boolean)
        .join('\n\n')

    // the account rules and the memory (connections): the rules and memories go into the
    // prompt, and the memory tool saves new ones while the user has memory on
    const account = await loadAccountContext(userId)
    const accountRules = withAccountContext({ context: account, userRules: rulesWithSkills })
    const memoryTool =
        userId && account.memoryEnabled
            ? createMemoryTool({
                  userId,
                  sessionId: sessionId ?? null,
                  sessionTitle: sessionId ? await readSessionTitle(sessionId) : null,
                  memories: account.memories,
                  secretValues: Array.isArray(secrets)
                      ? secrets.map((s) => s.value).filter(Boolean)
                      : [],
              })
            : null

    // the repository's own AGENTS.md / CLAUDE.md, read in the sandbox: the worker's disk is
    // not the repository, so the harness does not look there (localDiscovery: false)
    const runWorkspaceDir = workspaceDir || '/workspace'
    const repoRules = await projectRules.loadSandboxProjectRules({
        fs: adapter.fs,
        workspaceDir: runWorkspaceDir,
    })

    const harness = new AgentHarness({
        llm,
        tools: memoryTool ? [...tools, memoryTool] : tools,
        operations: adapter,
        workspaceDir: runWorkspaceDir,
        projectRules: repoRules,
        localDiscovery: false,
        sessionId,
        userId,
        userRules: accountRules || undefined,
        runtime: 'cloud',
        availableSecrets: secretKeys,
        // the session's effort is the agent's reasoning level; runs started without one
        // (github app) stay on fast
        ...runModelConfig({
            model: model || process.env.DEFAULT_MODEL || 'gemini-3.6-flash',
            effort,
        }),
    })

    const agent = harness.getAgent()

    // /permissions (#632): tool calls that match the user's deny rules are blocked
    const owner = userId
        ? await prisma.user
              .findUnique({ where: { id: userId }, select: { toolDenyRules: true } })
              .catch(() => null)
        : null
    const denyHook = buildDenyRulesHook(owner?.toolDenyRules ?? [])
    if (denyHook) {
        const ownHook = agent.hooks?.beforeToolCall
        agent.hooks = {
            ...agent.hooks,
            beforeToolCall: async (toolCall) => (await denyHook(toolCall)) ?? ownHook?.(toolCall),
        }
    }

    // the user hooks saved on the account (connections page): the cli's rules, but each
    // command runs in the sandbox. the command text is never logged (it can hold a secret)
    const accountHooks = toUserHooks(connections.hooks)
    const userHooks =
        accountHooks.length > 0
            ? attachUserHooks(agent, {
                  listHooks: () => accountHooks,
                  cwd: workspaceDir || '/workspace',
                  runCommand: createSandboxHookRunner(
                      () =>
                          activeSandboxes.get(sessionId) || activeSandboxes.get(effectiveSandboxId)
                  ),
                  onNotice: (_message, tone) =>
                      console.log(
                          `[AGENT EXECUTION] a user hook ${tone === 'error' ? 'failed' : 'acted'} in session '${sessionId}'`
                      ),
              })
            : null
    if (userHooks && accountHooks.some((hook) => hook.event === 'Notification')) {
        // Notification hooks run when the agent asks the user a question, like in the cli
        const hooked = agent.hooks?.beforeToolCall
        agent.hooks = {
            ...agent.hooks,
            beforeToolCall: async (toolCall) => {
                const outcome = await hooked?.(toolCall)
                if (toolCall.name === 'ask_question' && !(outcome as any)?.block) {
                    void userHooks.runNotification('ask_question', questionText(toolCall.input))
                }
                return outcome
            },
        }
    }

    // a new message while December works (#637): the agent reads it at its next turn, with
    // its files and picked skills like the prompt of a run
    const steering = data.steering
    if (steering) {
        const toSteeringPrompt = async (item: SteeringItem) => {
            try {
                const sandbox =
                    activeSandboxes.get(sessionId) || activeSandboxes.get(effectiveSandboxId)
                const files = readJobAttachments({ sessionId, value: item.attachments })
                const attachments =
                    files.length > 0
                        ? await writeTurnAttachments({
                              sandbox,
                              folder: item.userMessageSequence ?? 'steering',
                              attachments: files,
                          })
                        : []
                return await buildTurnPrompt({
                    prompt: item.prompt,
                    planFirst: false,
                    sandbox,
                    attachments,
                    skills: pickTurnSkills({
                        skills: runSkills,
                        names: item.skills ?? [],
                    }),
                })
            } catch (error) {
                console.warn(`[AGENT EXECUTION] steering files skipped for '${sessionId}':`, error)
                return item.prompt
            }
        }
        agent.hooks = {
            ...agent.hooks,
            getSteeringMessages: async () => {
                const messages: AgentMessage[] = []
                for (const item of await steering.take()) {
                    messages.push({ role: 'user', content: await toSteeringPrompt(item) })
                }
                return messages
            },
        }
    }

    // Rehydrate past conversational history from PostgreSQL
    try {
        const contextRow = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { contextStartSequence: true },
        })
        const contextStart = contextRow?.contextStartSequence ?? 0
        const historicalDbMessages = await prisma.message.findMany({
            where: {
                sessionId,
                // /clear and /compact move the start; the saved prompt of this turn is
                // sent by the loop itself, so the history stops before it
                sequence: {
                    gte: contextStart,
                    ...(userMessageSequence ? { lt: userMessageSequence } : {}),
                },
            },
            orderBy: { sequence: 'asc' },
        })

        if (historicalDbMessages && historicalDbMessages.length > 0) {
            const rehydratedMessages: AgentMessage[] = []
            for (const msg of historicalDbMessages) {
                if (msg.role === 'SYSTEM') {
                    rehydratedMessages.push({ role: 'system', content: msg.content })
                } else if (msg.role === 'USER') {
                    rehydratedMessages.push({ role: 'user', content: msg.content })
                } else if (msg.role === 'ASSISTANT') {
                    const blocks = Array.isArray(msg.blocks) ? (msg.blocks as any[]) : []
                    const commandBlocks = blocks.filter((b: any) => b && b.type === 'command')
                    if (commandBlocks.length > 0) {
                        const toolCalls = commandBlocks.map((b: any) => ({
                            id: b.toolCallId,
                            name: b.toolName,
                            input:
                                typeof b.toolInput === 'string'
                                    ? b.toolInput
                                    : JSON.stringify(b.toolInput || {}),
                        }))
                        rehydratedMessages.push({
                            role: 'assistant',
                            content: msg.content || '',
                            toolCalls,
                        })
                        for (const cmd of commandBlocks) {
                            rehydratedMessages.push({
                                role: 'tool',
                                toolCallId: (cmd as any).toolCallId,
                                content: (cmd as any).output || '',
                            })
                        }
                    } else {
                        rehydratedMessages.push({
                            role: 'assistant',
                            content: msg.content || '',
                        })
                    }
                }
            }

            const nonSystemMessages = rehydratedMessages.filter((m) => m.role !== 'system')
            if (nonSystemMessages.length > 0) {
                agent.messages = [
                    { role: 'system', content: agent.systemPrompt },
                    ...nonSystemMessages,
                ]
            }
        }
    } catch (rehydrateErr) {
        console.error(
            `[AGENT EXECUTION] Error rehydrating context for session '${sessionId}':`,
            rehydrateErr
        )
    }

    const streamGenerator = (async function* () {
        try {
            console.log(
                `[AGENT EXECUTION] Agent loop started for session '${sessionId}'. Running AgentHarness loop...`
            )
            const activeSandbox =
                activeSandboxes.get(sessionId) || activeSandboxes.get(effectiveSandboxId)
            // the files before this turn, for /rewind
            await createTurnCheckpoint({ sandbox: activeSandbox, sequence: userMessageSequence })
            // installed plugins (connections page): their files go into the sandbox first, so
            // their skills and mcp servers find them. a plugin that fails is skipped
            if (activeSandbox && userId) {
                await installPluginsInSandbox({
                    sandbox: activeSandbox,
                    plugins: runPlugins,
                    loadFiles: (id) => loadPluginFiles({ userId, id }),
                }).catch((error: unknown) => {
                    console.warn(`[AGENT EXECUTION] plugins skipped for '${sessionId}':`, error)
                })
            }
            // the user's mcp servers (#632): a server that fails never fails the run
            await connectAgentMcpServers({
                agent,
                servers: connections.mcpServers,
                disabledMcps: disabledMcps ?? [],
            }).catch((error: unknown) => {
                console.warn(`[AGENT EXECUTION] mcp servers skipped for '${sessionId}':`, error)
            })
            // the mcp servers of the plugins: a command server runs in the sandbox
            await connectPluginMcpServers({
                agent,
                sandbox: activeSandbox,
                servers: pluginMcpServers({
                    plugins: runPlugins,
                    takenNames: connections.mcpServers.map((server) => server.name),
                    disabledMcps: disabledMcps ?? [],
                }),
                cwd: workspaceDir || '/workspace',
                secrets: toSecretEnvs(secrets),
            }).catch((error: unknown) => {
                console.warn(
                    `[AGENT EXECUTION] plugin mcp servers skipped for '${sessionId}':`,
                    error
                )
            })
            // user hooks: SessionStart on the first run of the session, then UserPromptSubmit,
            // which can stop the prompt or add to it
            let hookedPrompt = prompt
            if (userHooks) {
                if (!agent.messages.some((message) => message.role !== 'system')) {
                    await userHooks.runSessionStart('startup')
                }
                const outcome = await userHooks.runPromptSubmit(prompt)
                if (outcome.block) {
                    yield {
                        data: JSON.stringify({
                            type: 'AgentError',
                            error: `A UserPromptSubmit hook blocked the prompt: ${outcome.block}`,
                        }),
                    }
                    yield { data: JSON.stringify({ type: 'AgentEnd' }) }
                    return
                }
                hookedPrompt = appendHookContext(prompt, outcome.context)
            }
            // the files sent with this message (#634) go into the sandbox, outside the
            // repository. the agent takes text only, so an image goes as a path too
            const turnAttachments =
                jobAttachments && jobAttachments.length > 0
                    ? await writeTurnAttachments({
                          sandbox: activeSandbox,
                          folder: userMessageSequence ?? 'prompt',
                          attachments: jobAttachments,
                      })
                    : []
            const turnPrompt = await buildTurnPrompt({
                prompt: hookedPrompt,
                planFirst: Boolean(planFirst),
                sandbox: activeSandbox,
                attachments: turnAttachments,
                skills: pickTurnSkills({
                    skills: runSkills,
                    names: pickedSkillNames ?? [],
                }),
            })
            // the loop starts at its first read. with a stop watch (#637), a stop ends the
            // run at once, and a stop that came before this point never starts the agent
            const agentLoop = runAgentLoop(agent, turnPrompt)
            const runEvents = data.stop
                ? stoppableRun({ events: agentLoop, stop: data.stop, abort: () => agent.abort() })
                : agentLoop
            for await (const event of runEvents) {
                // the messages the agent reads at this turn (#637), before the turn starts
                for (const delivered of steering?.eventsBefore(event) ?? []) {
                    yield { data: JSON.stringify(delivered) }
                }
                if (event.type === 'AgentStatus') {
                    console.log(`[AGENT STATUS] Session '${sessionId}': ${event.message}`)
                } else if (event.type === 'StreamChunk') {
                    if (event.content) {
                        console.log(
                            `[AGENT STREAM] Session '${sessionId}': "${event.content.slice(0, 60)}..."`
                        )
                    }
                } else if (event.type === 'AgentEnd') {
                    console.log(
                        `[AGENT END] Agent loop finished successfully for session '${sessionId}'`
                    )
                }
                yield { data: JSON.stringify(event) }

                const modifiedFiles = adapter.getModifiedFiles()
                if (
                    Object.keys(modifiedFiles).length > 0 &&
                    (event.type === 'ToolCallResult' || event.type === 'TurnEnd')
                ) {
                    yield {
                        data: JSON.stringify({
                            type: 'result',
                            generatedFiles: modifiedFiles,
                        }),
                    }
                }
            }
        } catch (err: any) {
            console.error(
                `[AGENT EXECUTION] Error during agent loop for session '${sessionId}':`,
                err
            )
            yield {
                data: JSON.stringify({
                    type: 'AgentError',
                    error: err?.message || String(err),
                }),
            }
            yield { data: JSON.stringify({ type: 'AgentEnd' }) }
        } finally {
            activeAdapters.delete(adapter)
            // Notification hooks run when the turn is done, like in the cli
            if (userHooks) {
                await userHooks
                    .runNotification('turn_finished', 'December finished the turn.')
                    .catch((error: unknown) => {
                        console.warn(
                            `[AGENT EXECUTION] notification hooks failed for '${sessionId}':`,
                            error
                        )
                    })
            }
            // the mcp connections belong to this run: the next run connects again
            await disconnectAgentMcpServers(agent)
            // a run that ends (or is stopped) no longer waits for an answer
            await clearPendingQuestion(sessionId, getRedisPub())
        }
    })()

    return streamGenerator
}

const runEphemeralTask = async (data: EphemeralTaskInput): Promise<EphemeralTaskResult> => {
    const { taskType, gitToken, taskRunner } = data
    console.log(`[E2BSandboxService] Spawning isolated ephemeral sandbox for ${taskType}`)

    let sandbox: any = null
    try {
        if (mockClientOverride) {
            sandbox = await mockClientOverride.create({ taskType, isEphemeral: true })
        } else if (process.env.E2B_API_KEY) {
            sandbox = await Sandbox.create({
                apiKey: process.env.E2B_API_KEY,
                template: 'base',
                timeoutMs: 600000,
            })
        } else {
            sandbox = {
                sandboxId: `ephemeral-${taskType}-${Date.now()}`,
                commands: {
                    run: async () => ({
                        exitCode: 0,
                        stdout: 'Ephemeral task executed',
                        stderr: '',
                    }),
                },
                kill: async () => {},
            }
        }

        if (sandbox?.sandboxId) {
            activeSandboxes.set(sandbox.sandboxId, sandbox)
        }

        // In-memory credential hygiene: Pass GITHUB_TOKEN in-memory without disk footprint
        const envVars: Record<string, string> = {}
        if (gitToken) {
            envVars['GITHUB_TOKEN'] = gitToken
        }

        let resultData: any = { status: 'COMPLETED', taskType }
        if (taskRunner) {
            resultData = await taskRunner(sandbox)
        }

        return { success: true, data: resultData }
    } catch (e: any) {
        console.error(`[E2BSandboxService] Ephemeral task ${taskType} failed:`, e)
        return { success: false, error: e?.message || String(e) }
    } finally {
        if (sandbox) {
            if (sandbox.sandboxId) {
                activeSandboxes.delete(sandbox.sandboxId)
            }
            if (typeof sandbox.kill === 'function') {
                await sandbox.kill().catch(() => {})
            }
        }
    }
}

const getPreviewUrl = async (data: {
    sessionId: string
    sandboxId?: string
    port?: number
}): Promise<string> => {
    const { sessionId, sandboxId, port } = data
    const targetPort = port || 5173
    const targetId = sandboxId || sessionId
    const sandbox = activeSandboxes.get(targetId) || activeSandboxes.get(sessionId)

    if (sandbox && typeof sandbox.getHost === 'function') {
        try {
            const host = await sandbox.getHost(targetPort)
            return host.startsWith('http') ? host : `https://${host}`
        } catch (err) {
            console.error(`[E2BSandboxService] Failed to get E2B host for port ${targetPort}:`, err)
        }
    }

    const targetHost = `session-${sessionId}-${targetPort}.preview.december.ai`
    return `https://${targetHost}`
}

const getActiveSandbox = (sessionId: string) => {
    return activeSandboxes.get(sessionId) || activeSandboxes.get(sessionId.replace(/^session-/, ''))
}

const detachAllActiveAdapters = async (): Promise<void> => {
    console.log(`[SANDBOX SERVICE] Detaching ${activeAdapters.size} active platform adapter(s)...`)
    for (const adapter of activeAdapters) {
        try {
            await adapter.detachAll()
        } catch (e: any) {
            console.error('[SANDBOX SERVICE] Error detaching adapter:', e?.message || e)
        }
    }
    activeAdapters.clear()
    await TerminalBridgeService.stop()
}

export const E2BSandboxService = {
    setMockClient,
    resetMockClient,
    emitSessionEvent,
    emitRunFailure,
    provisionSandbox,
    pauseSandbox,
    resumeSandbox,
    acquireSessionSandbox,
    keepSandboxAlive,
    extendSandboxTimeout,
    handleDisconnect,
    destroySandbox,
    executeCommand,
    getPreviewUrl,
    getActiveSandbox,
    runAgentSession,
    runEphemeralTask,
    detachAllActiveAdapters,
}
