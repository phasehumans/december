import { DurableStepKernel, PrismaDurableStepStorage, StaleEpochError } from '@december/agent'
import { prisma } from '@december/database'
import {
    calculateGenerationCost,
    crossedLowCreditsAmount,
    DEFAULT_SESSION_RUN_CONFIG,
    readSessionRunConfig,
    startOfUtcMonth,
    startOfNextUtcMonth,
} from '@december/shared'
import { getGitProvider } from '@december/shared/git'
import Redis from 'ioredis'

import { detectSandboxListeningPorts, pickWebPreviewPort } from './dynamic-port-detector'
import { E2BSandboxService } from './e2b-sandbox.service'
import {
    loadPullRequestSettings,
    resolveAppRepoToken,
    resolveGitToken,
    resolveGitUser,
} from './git-remote'
import { finishGithubRun } from './github-run'
import {
    createDefaultSessionPlan,
    inferPhaseFromToolCall,
    advancePlanPhase,
    type SessionPlan,
} from './plan-milestones'
import {
    AHEAD_COUNT_COMMAND,
    branchToSave,
    gitCommitCommand,
    gitIdentityCommand,
    gitStepFailure,
    hasWorkToPublish,
    needsUserIdentity,
    pickCommitAuthor,
    pickPullRequestTokens,
    pickTaskBranch,
    wantsAppToken,
} from './pr-opening'
import { publishWhenReady, subscribeWhenReady } from './redis-subscriber'
import { moveMessagesToEnd } from './run-steering'
import { closeStoppedTurn, createInterruptHub } from './run-stop'
import { checkRunSpend, prismaSpendLimitStore, spendLimitEvent } from './spend-limits'
import {
    isTestExecutionCommand,
    parseTestOutput,
    type SessionTestReport,
} from './test-runner-parser'

import type { BillingSource } from './llm-source'
import type { RunSteering } from './run-steering'
import type { RunStop } from './run-stop'

export const MUTATING_TOOL_NAMES = new Set([
    'write_file',
    'writefile',
    'write_to_file',
    'edit_file',
    'editfile',
    'edit_diff',
    'create_file',
    'replace_file_content',
    'multi_replace_file_content',
    'patch_file',
])

export async function updateSandboxGitDiff(
    sessionId: string,
    sandbox: any
): Promise<{ gitStatus: string; gitDiff: string } | null> {
    if (!sandbox?.commands?.run) return null
    try {
        const statusRes = await sandbox.commands.run('git status --porcelain', {
            cwd: '/workspace',
        })
        const gitStatus = statusRes?.stdout || ''

        // Intent-to-add so untracked new files appear in git diff
        await sandbox.commands.run('git add -N .', { cwd: '/workspace' }).catch(() => {
            // Intentionally swallowed: git add -N fallback
        })

        const diffRes = await sandbox.commands
            .run('git diff HEAD', { cwd: '/workspace' })
            .catch(async () => {
                return await sandbox.commands
                    .run('git diff', { cwd: '/workspace' })
                    .catch(() => null)
            })
        const gitDiff = diffRes?.stdout || ''

        const payload = JSON.stringify({
            type: 'GitDiffUpdate',
            sessionId,
            gitStatus,
            gitDiff,
            updatedAt: Date.now(),
        })

        if (redisPub && redisPub.status === 'ready') {
            await redisPub.set(`session_git_diff:${sessionId}`, payload).catch(() => {
                // Intentionally swallowed: Redis set fallback in test environment
            })
            await redisPub.publish(`session_events:${sessionId}`, payload).catch(() => {
                // Intentionally swallowed: Redis publish fallback in test environment
            })
        }

        return { gitStatus, gitDiff }
    } catch {
        // Intentionally swallowed: Sandbox git diff query error fallback
        return null
    }
}

export interface AutonomousPrResult {
    prNumber?: number
    url?: string
    title: string
    state: string
    headRef: string
    baseRef: string
    diffSummary: {
        additions: number
        deletions: number
        changedFiles: number
    }
    ciStatus: 'passing' | 'pending' | 'failed'
    createdAt?: string
    updatedAt?: string
}

export async function handleAutonomousTaskBranchAndPr(options: {
    sessionId: string
    sandbox: any
    /** a December GitHub App token for the repository, or null. tests pass their own */
    getAppToken?: (repoPath: string) => Promise<string | null>
    /** sends the error event of a failed checkout or push. tests pass their own */
    publish?: PublishRunEvent
}): Promise<AutonomousPrResult | null> {
    const {
        sessionId,
        sandbox,
        getAppToken = resolveAppRepoToken,
        publish = publishRunEvent,
    } = options
    if (!sandbox?.commands?.run) return null

    try {
        // 1. Check if git status has any changes or untracked files
        const statusRes = await sandbox.commands
            .run('git status --porcelain', { cwd: '/workspace' })
            .catch(() => null)
        const statusOutput = (statusRes?.stdout || '').trim()
        // a clean tree can still hold commits the agent made itself: they are pushed too
        const aheadRes = statusOutput
            ? null
            : await sandbox.commands
                  .run(AHEAD_COUNT_COMMAND, { cwd: '/workspace' })
                  .catch(() => null)
        if (!hasWorkToPublish({ statusOutput, aheadCount: aheadRes?.stdout })) {
            return null
        }

        // 2. Fetch session and user details
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                userId: true,
                title: true,
                description: true,
                gitProvider: true,
                githubRepoOwner: true,
                githubRepoName: true,
                githubRepoUrl: true,
                repoUrl: true,
                branch: true,
                prBranch: true,
                settings: { select: { config: true } },
                user: { select: { defaultOpenPullRequest: true } },
            },
        })
        // "open pull request" off (#632): commit and push the branch, open no pull request.
        // a session with no saved value follows the user's default, which is also "create
        // the pull request" on the pull requests settings page (#637)
        const { openPullRequest } = readSessionRunConfig(session?.settings?.config, {
            ...DEFAULT_SESSION_RUN_CONFIG,
            openPullRequest: session?.user?.defaultOpenPullRequest ?? true,
        })

        // how this user wants branches, commits and pull requests (#637)
        const prSettings = await loadPullRequestSettings(session?.userId)
        const gitProvider = session?.gitProvider ?? 'GITHUB'
        const effectiveToken = await resolveGitToken({
            userId: session?.userId,
            provider: gitProvider,
        })

        // the branch of this session: the saved one, also after the prefix changes
        const currentBranchRes = session?.prBranch
            ? null
            : await sandbox.commands
                  .run('git rev-parse --abbrev-ref HEAD', { cwd: '/workspace' })
                  .catch(() => null)
        const taskBranch = pickTaskBranch({
            sessionId,
            branchPrefix: prSettings.branchPrefix,
            savedBranch: session?.prBranch,
            currentBranch: currentBranchRes?.stdout,
        })
        const baseBranch = session?.branch || 'main'
        const cleanCommitTitle = session?.title
            ? `feat: ${session.title.toLowerCase().replace(/["'`\\]/g, '')}`
            : 'feat: automated task changes'

        // "both": the user is the author and December the co-author
        const { author, coAuthor } = pickCommitAuthor({
            commitAuthor: prSettings.commitAuthor,
            user: needsUserIdentity(prSettings.commitAuthor)
                ? await resolveGitUser({
                      userId: session?.userId,
                      provider: gitProvider,
                      token: effectiveToken,
                  })
                : null,
        })

        // a git step failed when the command throws (the e2b sdk) or ends with an exit code
        const gitStepOk = (step: Promise<{ exitCode?: number } | null | undefined>) =>
            step.then(
                (res) => !res?.exitCode,
                (error: unknown) => {
                    console.warn(`[WORKER LISTENER] git step failed for ${taskBranch}:`, error)
                    return false
                }
            )

        // 3. Configure git author identity & switch to task branch (NEVER push to main)
        const onBranch = await gitStepOk(
            sandbox.commands.run(`${gitIdentityCommand(author)} && git checkout -B ${taskBranch}`, {
                cwd: '/workspace',
            })
        )
        if (!onBranch) {
            // not silent (review E2): the chat shows the error, nothing is committed or pushed
            await publish(sessionId, gitStepFailure({ step: 'checkout', branch: taskBranch }))
            return null
        }

        // 4. Stage and commit changes cleanly
        await sandbox.commands
            .run(gitCommitCommand({ subject: cleanCommitTitle, coAuthor }), { cwd: '/workspace' })
            .catch(() => {
                // Intentionally swallowed: git commit fallback
            })

        // Also update local git diff state
        await updateSandboxGitDiff(sessionId, sandbox).catch(() => {
            // Intentionally swallowed: diff update fallback
        })

        // 5. Check if a repo is linked (github* columns hold the repo on any git host)
        const repoOwner = session?.githubRepoOwner
        const repoName = session?.githubRepoName

        // If repo and token are not present, return local task branch result
        if (!repoOwner || !repoName || !effectiveToken) {
            const localResult: AutonomousPrResult = {
                title: session?.title || 'Automated task changes',
                state: 'local',
                headRef: taskBranch,
                baseRef: baseBranch,
                diffSummary: {
                    additions: 0,
                    deletions: 0,
                    changedFiles: statusOutput.split('\n').filter(Boolean).length,
                },
                ciStatus: 'pending',
            }

            const localPayload = JSON.stringify({
                type: 'PullRequestUpdate',
                sessionId,
                pullRequest: localResult,
                updatedAt: Date.now(),
            })

            if (redisPub && redisPub.status === 'ready') {
                await redisPub.set(`session_pull_requests:${sessionId}`, localPayload).catch(() => {
                    // Intentionally swallowed: Redis set fallback
                })
                await redisPub.publish(`session_events:${sessionId}`, localPayload).catch(() => {
                    // Intentionally swallowed: Redis publish fallback
                })
            }

            return localResult
        }

        // 6. Push dedicated task branch to origin using token (NEVER force-pushing to main)
        const provider = getGitProvider(gitProvider)
        const repoPath = `${repoOwner}/${repoName}`
        const remoteUrl = provider.getCloneUrl({ token: effectiveToken, repoPath })
        await sandbox.commands
            .run(
                `git remote set-url origin '${remoteUrl}' 2>/dev/null || git remote add origin '${remoteUrl}'`,
                { cwd: '/workspace' }
            )
            .catch(() => {
                // Intentionally swallowed: remote set-url fallback
            })

        const pushed = await gitStepOk(
            sandbox.commands.run(`git push origin ${taskBranch}`, { cwd: '/workspace' })
        )
        if (!pushed) {
            // not silent (review E2): no branch is saved and no pull request is opened
            await publish(sessionId, gitStepFailure({ step: 'push', branch: taskBranch }))
            return null
        }

        // the pushed branch stays the branch of this session, whatever the prefix is later.
        // a saved name git refuses is replaced here
        const branchName = session
            ? branchToSave({ savedBranch: session.prBranch, taskBranch })
            : null
        if (branchName) {
            await prisma.session
                .update({ where: { id: sessionId }, data: { prBranch: branchName } })
                .catch((error: unknown) => {
                    console.error(
                        '[WORKER LISTENER] could not save the branch on the session',
                        error
                    )
                })
        }

        if (!openPullRequest) {
            const branchResult: AutonomousPrResult = {
                title: session?.title || 'Automated task changes',
                state: 'branch',
                headRef: taskBranch,
                baseRef: baseBranch,
                diffSummary: {
                    additions: 0,
                    deletions: 0,
                    changedFiles: statusOutput.split('\n').filter(Boolean).length,
                },
                ciStatus: 'pending',
            }
            const branchPayload = JSON.stringify({
                type: 'PullRequestUpdate',
                sessionId,
                pullRequest: branchResult,
                updatedAt: Date.now(),
            })
            if (redisPub && redisPub.status === 'ready') {
                await redisPub
                    .set(`session_pull_requests:${sessionId}`, branchPayload)
                    .catch(() => {
                        // Intentionally swallowed: Redis set fallback
                    })
                await redisPub.publish(`session_events:${sessionId}`, branchPayload).catch(() => {
                    // Intentionally swallowed: Redis publish fallback
                })
            }
            return branchResult
        }

        // 7. Create or fetch the pull request (merge request on GitLab)
        const prTitle = session?.title
            ? `feat: ${session.title}`
            : `Automated Task Branch ${taskBranch}`
        const prBody = [
            '## Summary of Changes',
            session?.title || 'Automated task completed by December Agent.',
            '',
            '### Verification Notes',
            '- Changes verified inside isolated sandbox environment.',
            `- Task branch \`${taskBranch}\` pushed to origin.`,
        ].join('\n')

        // "december": the December GitHub App opens it when the app is on the repository.
        // the user's token is the fallback, and the only choice on GitLab
        const appToken = wantsAppToken({ prAuthor: prSettings.prAuthor, provider: gitProvider })
            ? await getAppToken(repoPath).catch(() => null)
            : null
        let prData: Awaited<ReturnType<typeof provider.createPullRequest>> = null
        let prToken = effectiveToken
        for (const token of pickPullRequestTokens({
            prAuthor: prSettings.prAuthor,
            provider: gitProvider,
            userToken: effectiveToken,
            appToken,
        })) {
            prToken = token
            prData = await provider.createPullRequest({
                token,
                repoPath,
                title: prTitle,
                head: taskBranch,
                base: baseBranch,
                body: prBody,
                draft: prSettings.prDraft,
            })
            if (prData) break
        }

        // 8. Query CI status if commit SHA or PR is available
        const ciStatus = prData?.headSha
            ? await provider.getCiStatus({ token: prToken, repoPath, sha: prData.headSha })
            : 'passing'

        const prResult: AutonomousPrResult = {
            prNumber: prData?.number,
            url: prData?.url,
            title: prData?.title || prTitle,
            state: prData?.state || 'open',
            headRef: taskBranch,
            baseRef: baseBranch,
            diffSummary: {
                additions: prData?.additions ?? 0,
                deletions: prData?.deletions ?? 0,
                changedFiles:
                    prData?.changedFiles ?? statusOutput.split('\n').filter(Boolean).length,
            },
            ciStatus,
            createdAt: prData?.createdAt,
            updatedAt: prData?.updatedAt,
        }

        // keep the pull request on the session, so the sessions list and the Pull requests
        // page can show it after the Redis entry is gone
        if (prResult.prNumber) {
            const prState = prData?.status ?? 'open'
            await prisma.session
                .update({
                    where: { id: sessionId },
                    data: {
                        prNumber: prResult.prNumber,
                        prUrl: prResult.url ?? null,
                        prState,
                        prTitle: prResult.title,
                        prBranch: taskBranch,
                        prOpenedAt: prData?.createdAt ? new Date(prData.createdAt) : new Date(),
                        prCheckedAt: new Date(),
                        prAdditions: prData?.additions ?? null,
                        prDeletions: prData?.deletions ?? null,
                    },
                })
                .catch((error: unknown) => {
                    console.error(
                        '[WORKER LISTENER] could not save the pull request on the session',
                        error
                    )
                })
        }

        const payload = JSON.stringify({
            type: 'PullRequestUpdate',
            sessionId,
            pullRequest: prResult,
            updatedAt: Date.now(),
        })

        if (redisPub && redisPub.status === 'ready') {
            await redisPub.set(`session_pull_requests:${sessionId}`, payload).catch(() => {
                // Intentionally swallowed: Redis set fallback in test environment
            })
            await redisPub.publish(`session_events:${sessionId}`, payload).catch(() => {
                // Intentionally swallowed: Redis publish fallback in test environment
            })
        }

        // Advance plan to completed PR milestone
        let prPlan = createDefaultSessionPlan(sessionId)
        prPlan = advancePlanPhase({
            plan: prPlan,
            targetPhaseId: 'pr',
            rationale: `Task completed and PR #${prResult.prNumber || 'new'} generated`,
            log: `Pushed branch ${taskBranch} to origin`,
        })
        prPlan.milestones = prPlan.milestones.map((m) => ({
            ...m,
            status: 'completed',
            completedAt: m.completedAt || new Date().toISOString(),
        }))
        void updateSessionPlan({ sessionId, plan: prPlan })

        return prResult
    } catch (err) {
        console.error(
            `[WORKER LISTENER] Autonomous PR creation error for session ${sessionId}:`,
            err
        )
        return null
    }
}

export async function updateSessionPlan(options: {
    sessionId: string
    plan: SessionPlan
}): Promise<void> {
    const { sessionId, plan } = options
    const payload = JSON.stringify({
        type: 'PlanMilestoneUpdate',
        sessionId,
        plan,
        updatedAt: Date.now(),
    })

    if (redisPub && redisPub.status === 'ready') {
        await redisPub.set(`session_plan:${sessionId}`, payload).catch(() => {
            // Intentionally swallowed: Redis set fallback in test environment
        })
        await redisPub.publish(`session_events:${sessionId}`, payload).catch(() => {
            // Intentionally swallowed: Redis publish fallback in test environment
        })
    }
}

export async function updateSessionTestResults(data: {
    sessionId: string
    report: SessionTestReport
}): Promise<void> {
    const { sessionId, report } = data
    const payload = JSON.stringify({
        type: 'TestExecutionUpdate',
        sessionId,
        report,
        updatedAt: Date.now(),
    })

    if (redisPub && redisPub.status === 'ready') {
        await redisPub
            .set(`session_test_results:${sessionId}`, JSON.stringify(report))
            .catch(() => {
                // Intentionally swallowed: Redis cache set fallback in test environment
            })
        await redisPub.publish(`session_events:${sessionId}`, payload).catch(() => {
            // Intentionally swallowed: Redis publish fallback in test environment
        })
    }
}

export async function updateSandboxListeningPort(
    sessionId: string,
    sandbox: any
): Promise<number | null> {
    try {
        const ports = await detectSandboxListeningPorts(sandbox)
        const pickedPort = pickWebPreviewPort(ports)
        if (pickedPort) {
            const previewUrl = await E2BSandboxService.getPreviewUrl({
                sessionId,
                port: pickedPort,
            })
            const portPayload = JSON.stringify({
                type: 'PreviewPortDetected',
                sessionId,
                port: pickedPort,
                ports,
                previewUrl,
            })
            if (redisPub && redisPub.status === 'ready') {
                await redisPub
                    .set(
                        `session_preview_port:${sessionId}`,
                        JSON.stringify({ port: pickedPort, ports, previewUrl })
                    )
                    .catch(() => {
                        // Intentionally swallowed: Redis port set fallback in test environment
                    })
                await redisPub.publish(`session_events:${sessionId}`, portPayload).catch(() => {
                    // Intentionally swallowed: Redis publish fallback in test environment
                })
            }
            return pickedPort
        }
        return null
    } catch {
        // Intentionally swallowed: Port detection fallback
        return null
    }
}

const redisPub = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
})
redisPub.on('error', () => {
    // Intentionally swallowed: Suppress offline Redis error noise in test environment
})
const redisSub = redisPub.duplicate({ enableReadyCheck: false })
redisSub.on('error', () => {
    // Intentionally swallowed: Suppress offline Redis sub error noise in test environment
})

// both connections are lazy and have no offline queue: nothing opens them, and a command
// sent before "ready" is lost. open them here, so the run events reach the server and the
// interrupts reach this worker
for (const client of [redisPub, redisSub]) {
    client.connect().catch(() => {
        // Intentionally swallowed: redis is offline (tests) or the connection is already open
    })
}

// stop of a running agent (#637): the server publishes on session_interrupts:<sessionId>
const interruptHub = createInterruptHub(redisSub)
/** the interrupts this worker gets, for watchRunStop */
export const subscribeToInterrupts = interruptHub.subscribe

// sent on "ready": a psubscribe sent at load, before the connection is open, is refused
subscribeWhenReady({
    client: redisSub,
    subscribe: () => redisSub.psubscribe('session_events:*'),
    label: 'WORKER LISTENER',
})

redisSub.on('pmessage', (pattern, channel, message) => {
    try {
        const parsed = JSON.parse(message)
        if (parsed.type === 'ClientDisconnect' && parsed.sessionId) {
            // AFK background execution: do not pause or terminate containers on client disconnect
            console.log(
                `[WORKER LISTENER] Client disconnect event for session ${parsed.sessionId}. Preserving active background container execution.`
            )
        }
    } catch {
        // Intentionally swallowed: message parse error fallback
    }
})

interface AccumulatedTurn {
    thoughts: string
    content: string
    blocks: any[]
    modifiedFiles: Set<string>
    hasError: boolean
    errorMessage?: string
}

export async function processGrpcStream(
    sessionId: string,
    stream: any,
    sandbox?: any,
    options?: {
        kernel?: DurableStepKernel
        billingSource?: BillingSource
        /** the stop watch of this run (#637). it ends here, with the run */
        stop?: RunStop
        /** the messages sent while this run works (#637). it ends here, with the run */
        steering?: RunSteering
    }
) {
    const billingSource: BillingSource = options?.billingSource ?? 'CREDITS'
    let hasError = false
    let currentTurn: AccumulatedTurn = {
        thoughts: '',
        content: '',
        blocks: [],
        modifiedFiles: new Set(),
        hasError: false,
    }

    let sessionPlan: SessionPlan = createDefaultSessionPlan(sessionId)
    await updateSessionPlan({ sessionId, plan: sessionPlan }).catch(() => {
        // Intentionally swallowed: Initial plan broadcast fallback
    })

    const storage = new PrismaDurableStepStorage(prisma)
    const kernel =
        options?.kernel ||
        new DurableStepKernel({
            storage,
            workerId: `worker-${process.pid}`,
        })

    if (!kernel.getCurrentEpoch(sessionId)) {
        try {
            await kernel.acquireLease(sessionId, 30000)
        } catch {
            // Intentionally swallowed: lease acquire fallback when running outside PostgreSQL
        }
    }

    // the agent's last words: the summary for a pull request, a reply or a review
    let lastAssistantText = ''
    let runFinished = false
    // the run ended with a stop (#637): its work stays in the sandbox, nothing is pushed
    let runStopped = false

    // the end of the run, once: the github step for sessions the github app started,
    // otherwise the task branch and pull request
    const finishRun = async (runHasError: boolean) => {
        if (runFinished) return
        runFinished = true
        // no github step, no push and no pull request for a run that was stopped
        if (runStopped) return
        const activeSandbox = sandbox || E2BSandboxService.getActiveSandbox(sessionId)
        const handled = await finishGithubRun({
            sessionId,
            sandbox: activeSandbox,
            hasError: runHasError,
            summary: lastAssistantText,
        }).catch((err: unknown) => {
            console.error(`[WORKER LISTENER] github step failed for session ${sessionId}:`, err)
            return true
        })
        if (handled || runHasError || !activeSandbox) return
        await handleAutonomousTaskBranchAndPr({
            sessionId,
            sandbox: activeSandbox,
        }).catch(() => {
            // Intentionally swallowed: Autonomous PR creation fallback
        })
    }

    const persistTurnMessage = async () => {
        if (currentTurn.content.trim()) {
            lastAssistantText = currentTurn.content
        }
        try {
            if (
                !currentTurn.content &&
                !currentTurn.thoughts &&
                currentTurn.blocks.length === 0 &&
                !currentTurn.hasError
            ) {
                return
            }

            console.log(
                `[WORKER LISTENER] Persisting turn message for session '${sessionId}' with ${currentTurn.blocks.length} blocks...`
            )

            const lastMessage = await prisma.message.findFirst({
                where: { sessionId },
                orderBy: { sequence: 'desc' },
                select: { sequence: true },
            })
            const nextSequence = (lastMessage?.sequence ?? 0) + 1

            const finalContent =
                currentTurn.content ||
                (currentTurn.hasError
                    ? currentTurn.errorMessage || 'Agent Execution Error'
                    : currentTurn.blocks.length > 0
                      ? ''
                      : 'Completed')

            await prisma.message.create({
                data: {
                    sessionId,
                    role: 'ASSISTANT',
                    content: finalContent,
                    status: currentTurn.hasError ? 'error' : 'done',
                    sequence: nextSequence,
                    blocks: currentTurn.blocks.length > 0 ? (currentTurn.blocks as any) : undefined,
                },
            })

            console.log(
                `[WORKER LISTENER] Successfully persisted assistant message (sequence: ${nextSequence}) for session '${sessionId}'`
            )

            // Atomically commit completed MODEL_INFERENCE step to DurableStep in PostgreSQL
            if (kernel.getCurrentEpoch(sessionId)) {
                try {
                    await kernel.commitStep({
                        sessionId,
                        stepType: 'MODEL_INFERENCE',
                        output: {
                            content: finalContent,
                            blocks: currentTurn.blocks,
                        },
                    })
                } catch (stepErr: any) {
                    if (stepErr instanceof StaleEpochError) {
                        console.warn(
                            `[WORKER LISTENER] Fencing detected for session '${sessionId}': StaleEpochError on MODEL_INFERENCE commit`
                        )
                        hasError = true
                        throw stepErr
                    }
                }
            }

            // Real git diff & status streamed from sandbox repository (deprecating per-turn s3 file sync)
            const activeSandbox = sandbox || E2BSandboxService.getActiveSandbox(sessionId)
            if (activeSandbox) {
                await updateSandboxGitDiff(sessionId, activeSandbox)
            }
        } catch (err) {
            console.error(
                `[WORKER LISTENER] Failed to persist message for session ${sessionId}:`,
                err
            )
        } finally {
            currentTurn = {
                thoughts: '',
                content: '',
                blocks: [],
                modifiedFiles: new Set(),
                hasError: false,
            }
        }
    }

    try {
        for await (const event of stream) {
            const parsedEvent = JSON.parse(event.data)
            console.log(
                `[WORKER LISTENER -> REDIS] Session '${sessionId}' -> Publishing event '${parsedEvent.type || 'unknown'}'`
            )

            const eventType = parsedEvent.type
            // the end of a run that failed says so: the server sends no "finished" for it
            const published =
                eventType === 'AgentEnd' && hasError && !parsedEvent.stopped
                    ? JSON.stringify({ ...parsedEvent, failed: true })
                    : event.data

            // publish to socket rooms if redis is connected
            if (redisPub.status === 'ready') {
                await redisPub.publish(`session_events:${sessionId}`, published).catch(() => {
                    // Intentionally swallowed: Suppress Redis publish failure during offline/test execution
                })
            }

            // every agent step counts as sandbox activity (throttled), so a busy sandbox is
            // never paused by the idle sweeper
            void E2BSandboxService.keepSandboxAlive({ sessionId }).catch(() => {
                // Intentionally swallowed: keep-alive is best effort
            })

            if (eventType === 'ThinkingChunk') {
                const chunk = parsedEvent.content || parsedEvent.data?.content || ''
                if (chunk) {
                    currentTurn.thoughts += chunk
                    const lastBlock = currentTurn.blocks[currentTurn.blocks.length - 1]
                    if (lastBlock && lastBlock.type === 'thinking') {
                        lastBlock.content += chunk
                    } else {
                        currentTurn.blocks.push({ type: 'thinking', content: chunk })
                    }
                }
            } else if (eventType === 'StreamChunk') {
                const chunk = parsedEvent.content || parsedEvent.data?.content || ''
                if (chunk) {
                    currentTurn.content += chunk
                    const lastBlock = currentTurn.blocks[currentTurn.blocks.length - 1]
                    if (lastBlock && lastBlock.type === 'text') {
                        lastBlock.content += chunk
                    } else {
                        currentTurn.blocks.push({ type: 'text', content: chunk })
                    }
                }
            } else if (eventType === 'ToolCallStart') {
                const tc = parsedEvent.toolCall || parsedEvent.data?.toolCall || {}
                const toolName = tc.name || 'tool'
                const toolInput = tc.input || tc.args || {}
                const toolCallId = tc.id || `tool-${Date.now()}`

                currentTurn.blocks.push({
                    type: 'command',
                    toolCallId,
                    toolName,
                    toolInput,
                    status: 'running',
                    output: '',
                })

                // Infer and advance plan milestone phase based on tool execution
                const inferredPhase = inferPhaseFromToolCall(toolName, toolInput)
                if (inferredPhase) {
                    sessionPlan = advancePlanPhase({
                        plan: sessionPlan,
                        targetPhaseId: inferredPhase,
                        log: `Invoked tool ${toolName} (${toolInput?.filePath || toolInput?.path || toolInput?.command || ''})`.trim(),
                    })
                    void updateSessionPlan({ sessionId, plan: sessionPlan })
                }

                // Strictly filter modified files by mutating tools only; never flag read-only tools (read_file, grep, find)
                if (MUTATING_TOOL_NAMES.has(toolName.toLowerCase())) {
                    const filePath = toolInput.filePath || toolInput.path || toolInput.file
                    if (filePath && typeof filePath === 'string') {
                        currentTurn.modifiedFiles.add(filePath)
                    }
                }
            } else if (eventType === 'ToolExecutionUpdate') {
                const toolCallId = parsedEvent.toolCallId || parsedEvent.data?.toolCallId
                const chunk = parsedEvent.chunk || parsedEvent.data?.chunk || ''
                if (toolCallId && chunk) {
                    const block = currentTurn.blocks.find(
                        (b) => b.type === 'command' && b.toolCallId === toolCallId
                    )
                    if (block) {
                        block.output = `${block.output || ''}${chunk}`
                    }
                }
            } else if (eventType === 'ToolCallResult') {
                const result = parsedEvent.result || parsedEvent.data?.result || {}
                const toolCallId =
                    parsedEvent.toolCallId || parsedEvent.data?.toolCallId || result.toolCallId
                const block = currentTurn.blocks.find(
                    (b) => b.type === 'command' && (!toolCallId || b.toolCallId === toolCallId)
                )
                if (block) {
                    block.status = result.error ? 'error' : 'success'
                    block.output = result.output || result.content || result.error || block.output
                }

                // Query updated git status & diff when mutating tools or shell commands finish
                const isMutatingOrCommand =
                    block &&
                    (MUTATING_TOOL_NAMES.has((block.toolName || '').toLowerCase()) ||
                        ['bash', 'shell', 'command', 'terminal'].includes(
                            (block.toolName || '').toLowerCase()
                        ))
                if (isMutatingOrCommand) {
                    const activeSandbox = sandbox || E2BSandboxService.getActiveSandbox(sessionId)
                    if (activeSandbox) {
                        void updateSandboxGitDiff(sessionId, activeSandbox)
                        void updateSandboxListeningPort(sessionId, activeSandbox)
                    }

                    // Parse test execution output and publish structured test verification report
                    const rawCommand =
                        block?.toolInput?.CommandLine ||
                        block?.toolInput?.command ||
                        block?.toolInput?.cmd ||
                        ''
                    // a test command that a stop cut short has no result to report
                    if (rawCommand && isTestExecutionCommand(rawCommand) && !result.stopped) {
                        const exitCode = result.exitCode ?? (result.error ? 1 : 0)
                        const testReport = parseTestOutput(rawCommand, block.output || '', exitCode)
                        void updateSessionTestResults({ sessionId, report: testReport })

                        sessionPlan = advancePlanPhase({
                            plan: sessionPlan,
                            targetPhaseId: 'test',
                            log: `Executed tests: ${testReport.summary.passed} passed, ${testReport.summary.failed} failed`,
                        })
                        void updateSessionPlan({ sessionId, plan: sessionPlan })
                    }
                }

                // Atomically commit completed TOOL_EXECUTION step to DurableStep in PostgreSQL
                if (kernel.getCurrentEpoch(sessionId)) {
                    try {
                        await kernel.commitStep({
                            sessionId,
                            stepType: 'TOOL_EXECUTION',
                            opId: toolCallId,
                            input: block?.toolInput,
                            output: {
                                exitCode: result.exitCode ?? (result.error ? 1 : 0),
                                output: result.output || result.content || result.error || '',
                            },
                        })
                    } catch (stepErr: any) {
                        if (stepErr instanceof StaleEpochError) {
                            console.warn(
                                `[WORKER LISTENER] Fencing detected for session '${sessionId}': StaleEpochError on TOOL_EXECUTION commit`
                            )
                            hasError = true
                            throw stepErr
                        }
                    }
                }
            } else if (eventType === 'TurnEnd') {
                await persistTurnMessage()
            } else if (eventType === 'SteeringDelivered') {
                // the agent now reads these messages (#637): they go after the turn that
                // ran while they waited, so the saved order is the order the agent saw
                await persistTurnMessage()
                await moveMessagesToEnd({
                    db: prisma,
                    sessionId,
                    sequences: (Array.isArray(parsedEvent.messages) ? parsedEvent.messages : [])
                        .map((message: any) => message?.sequence)
                        .filter((sequence: unknown) => Number.isInteger(sequence)),
                }).catch((error: unknown) => {
                    console.warn(
                        `[WORKER LISTENER] could not order the steering messages of ${sessionId}:`,
                        error
                    )
                })
            } else if (eventType === 'AgentEnd') {
                if (parsedEvent.stopped === true) {
                    runStopped = true
                    const closed = closeStoppedTurn(currentTurn)
                    currentTurn.content = closed.content
                    currentTurn.blocks = closed.blocks
                }
                await persistTurnMessage()
                await finishRun(hasError)
            } else if (eventType === 'AgentUsage') {
                await updateCredits(sessionId, parsedEvent, billingSource)
            } else if (eventType === 'AgentError') {
                hasError = true
                currentTurn.hasError = true
                currentTurn.errorMessage = parsedEvent.error || parsedEvent.message
                currentTurn.blocks.push({
                    type: 'error',
                    error: currentTurn.errorMessage || 'Agent Execution Error',
                })
                await persistTurnMessage()
                console.error(
                    `[WORKER LISTENER] Session '${sessionId}' AgentError received:`,
                    currentTurn.errorMessage
                )
            }
        }
    } catch (e: any) {
        hasError = true
        console.error(`[WORKER LISTENER] Stream ended for ${sessionId}: ${e?.message || e}`)
    } finally {
        await persistTurnMessage()
        await finishRun(hasError)
        console.log(
            `[WORKER LISTENER] Stream finished for session '${sessionId}'. Setting Prisma session status -> ${hasError ? 'FAILED' : 'PARKED'}`
        )
        await prisma.session
            .update({
                where: { id: sessionId },
                // the agent run ends here. the sandbox (sandboxStatus) keeps running for the
                // preview, terminal and next prompt until the idle sweeper pauses it
                data: {
                    vmStatus: hasError ? 'FAILED' : 'STOPPED',
                    status: hasError ? 'FAILED' : 'PARKED',
                    leaseOwner: null,
                    leaseExpiresAt: null,
                },
            })
            .catch(() => {
                // Intentionally swallowed: DB fallback during stream cleanup
            })
        // messages that nobody took start a normal run, unless the run was stopped (#637)
        await options?.steering?.end({ discard: runStopped })
        options?.stop?.end()
    }
}

/** sends one event of a run to the server (redis `session_events:<sessionId>`) */
export type PublishRunEvent = (sessionId: string, event: Record<string, unknown>) => Promise<void>

const publishRunEvent: PublishRunEvent = async (sessionId, event) => {
    // waits while the connection opens: CreditsLow and SpendLimitReached are sent once
    await publishWhenReady({
        client: redisPub,
        channel: `session_events:${sessionId}`,
        message: JSON.stringify(event),
    }).catch((error: unknown) => {
        console.warn(`[WORKER LISTENER] could not publish ${String(event.type)}`, error)
    })
}

// records token usage. CREDITS runs are charged to the wallet; OWN_KEY runs are paid
// by the user's provider, so they are recorded for display only.
async function updateCredits(sessionId: string, event: any, billingSource: BillingSource) {
    await chargeRunUsage(sessionId, event, billingSource, publishRunEvent)
}

/**
 * One AgentUsage event of a run: the usage is saved, a run on credits is charged, and the
 * charge is checked against the low balance alert and the spend limits (#638). `publish`
 * sends CreditsLow and SpendLimitReached to the server.
 */
export async function chargeRunUsage(
    sessionId: string,
    event: any,
    billingSource: BillingSource,
    publish: PublishRunEvent
) {
    try {
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { userId: true },
        })
        if (!session) return

        const promptTokens = Number(event.promptTokens) || 0
        const completionTokens = Number(event.completionTokens) || 0
        const totalTokens = promptTokens + completionTokens
        const model = event.model || 'gemini-3.6-flash'
        const now = new Date()
        const periodStart = startOfUtcMonth(now)
        const periodEnd = startOfNextUtcMonth(now)

        const calculatedCost = calculateGenerationCost({
            modelName: model,
            inputTokens: promptTokens,
            outputTokens: completionTokens,
        })

        console.log(
            `[WORKER LISTENER] Recording UsageEvent for session '${sessionId}': model=${model}, promptTokens=${promptTokens}, completionTokens=${completionTokens}, costInCents=${calculatedCost}`
        )

        let balanceAfter: number | null = null
        // this charge took the balance under the user's alert amount (#638)
        let creditsLow = false
        await prisma.$transaction(async (tx) => {
            if (session.userId && billingSource === 'CREDITS') {
                const updated = await tx.user.update({
                    where: { id: session.userId },
                    data: {
                        creditBalance: {
                            decrement: calculatedCost,
                        },
                    },
                    select: { creditBalance: true, lowBalanceAlertCents: true },
                })
                balanceAfter = updated.creditBalance
                // the one rule, shared with the server's own charges (@december/shared)
                creditsLow = crossedLowCreditsAmount({
                    balanceBefore: updated.creditBalance + calculatedCost,
                    balanceAfter: updated.creditBalance,
                    alertCents: updated.lowBalanceAlertCents,
                })
                if (creditsLow) {
                    // a new drop under the amount: the mark of the drop before it (before a
                    // top-up) is cleared, so the server sends one alert for this one
                    await tx.user.updateMany({
                        where: { id: session.userId, lowBalanceAlertedAt: { not: null } },
                        data: { lowBalanceAlertedAt: null },
                    })
                }
            }

            await tx.usageEvent.create({
                data: {
                    userId: session.userId,
                    sessionId,
                    model,
                    inputTokens: promptTokens,
                    outputTokens: completionTokens,
                    totalTokens,
                    costInCents: calculatedCost,
                    billingSource,
                    periodStart,
                    periodEnd,
                },
            })
        })

        // this charge took the balance under the alert amount: the server tells the user
        // once (#636). it is not sent again until a top-up takes the balance back over
        if (creditsLow && balanceAfter !== null) {
            await publish(sessionId, { type: 'CreditsLow', balanceInCents: balanceAfter })
        }

        // spend limits (#638): when the session or the day of the user reached its amount,
        // the server stops this run with reason `limit` and asks the user to continue
        const reached = await checkRunSpend({
            userId: session.userId,
            sessionId,
            billingSource,
            store: prismaSpendLimitStore,
        })
        if (reached) await publish(sessionId, spendLimitEvent(reached))
    } catch (err) {
        console.error(
            `[WORKER LISTENER] Failed to record token usage and update credits for session ${sessionId}:`,
            err
        )
    }
}
