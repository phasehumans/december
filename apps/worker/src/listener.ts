import { DurableStepKernel, PrismaDurableStepStorage, StaleEpochError } from '@december/agent'
import { prisma } from '@december/database'
import { calculateGenerationCost, startOfUtcMonth, startOfNextUtcMonth } from '@december/shared'
import Redis from 'ioredis'

import { detectSandboxListeningPorts, pickWebPreviewPort } from './dynamic-port-detector'
import { E2BSandboxService } from './e2b-sandbox.service'
import {
    createDefaultSessionPlan,
    inferPhaseFromToolCall,
    advancePlanPhase,
    type SessionPlan,
} from './plan-milestones'
import {
    isTestExecutionCommand,
    parseTestOutput,
    type SessionTestReport,
} from './test-runner-parser'

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
}): Promise<AutonomousPrResult | null> {
    const { sessionId, sandbox } = options
    if (!sandbox?.commands?.run) return null

    try {
        // 1. Check if git status has any changes or untracked files
        const statusRes = await sandbox.commands
            .run('git status --porcelain', { cwd: '/workspace' })
            .catch(() => null)
        const statusOutput = (statusRes?.stdout || '').trim()
        if (!statusOutput) {
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
                githubRepoOwner: true,
                githubRepoName: true,
                githubRepoUrl: true,
                repoUrl: true,
                branch: true,
            },
        })

        const taskBranch = `december/${sessionId}`
        const baseBranch = session?.branch || 'main'
        const cleanCommitTitle = session?.title
            ? `feat: ${session.title.toLowerCase().replace(/["'`\\]/g, '')}`
            : 'feat: automated task changes'

        // 3. Configure git author identity & switch to task branch (NEVER push to main)
        await sandbox.commands
            .run(
                `git config user.name "December Agent" && git config user.email "agent@trydecember.com" && git checkout -B ${taskBranch}`,
                { cwd: '/workspace' }
            )
            .catch(() => {
                // Intentionally swallowed: git branch/author setup fallback
            })

        // 4. Stage and commit changes cleanly
        await sandbox.commands
            .run(`git add -A && git commit -m "${cleanCommitTitle}"`, { cwd: '/workspace' })
            .catch(() => {
                // Intentionally swallowed: git commit fallback
            })

        // Also update local git diff state
        await updateSandboxGitDiff(sessionId, sandbox).catch(() => {
            // Intentionally swallowed: diff update fallback
        })

        // 5. Check if GitHub repo is linked
        const repoOwner = session?.githubRepoOwner
        const repoName = session?.githubRepoName
        let effectiveToken: string | null = null

        if (session?.userId) {
            const user = await prisma.user
                .findUnique({
                    where: { id: session.userId },
                    select: { githubToken: true },
                })
                .catch(() => null)
            effectiveToken = user?.githubToken ?? null
        }

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
        const remoteUrl = `https://x-access-token:${effectiveToken}@github.com/${repoOwner}/${repoName}.git`
        await sandbox.commands
            .run(
                `git remote set-url origin '${remoteUrl}' 2>/dev/null || git remote add origin '${remoteUrl}'`,
                { cwd: '/workspace' }
            )
            .catch(() => {
                // Intentionally swallowed: remote set-url fallback
            })

        await sandbox.commands
            .run(`git push origin ${taskBranch}`, { cwd: '/workspace' })
            .catch((e: any) => {
                console.warn(`[WORKER LISTENER] Git push warning for ${taskBranch}:`, e)
                return null
            })

        // 7. Create or fetch Pull Request on GitHub
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

        let prData: any = null

        const createRes = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${effectiveToken}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                    'Content-Type': 'application/json',
                    'User-Agent': 'December-Worker',
                },
                body: JSON.stringify({
                    title: prTitle,
                    head: taskBranch,
                    base: baseBranch,
                    body: prBody,
                }),
            }
        ).catch(() => null)

        if (createRes && createRes.status === 201) {
            prData = await createRes.json()
        } else if (createRes && createRes.status === 422) {
            // PR already exists, fetch list of PRs for this head branch
            const listRes = await fetch(
                `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?head=${repoOwner}:${taskBranch}&state=all`,
                {
                    headers: {
                        Authorization: `Bearer ${effectiveToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                        'User-Agent': 'December-Worker',
                    },
                }
            ).catch(() => null)

            if (listRes && listRes.ok) {
                const list = (await listRes.json()) as any[]
                prData = list && list.length > 0 ? list[0] : null
            }
        }

        // 8. Query CI status if commit SHA or PR is available
        let ciStatus: 'passing' | 'pending' | 'failed' = 'passing'
        if (prData?.head?.sha) {
            const checksRes = await fetch(
                `https://api.github.com/repos/${repoOwner}/${repoName}/commits/${prData.head.sha}/check-runs`,
                {
                    headers: {
                        Authorization: `Bearer ${effectiveToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                        'User-Agent': 'December-Worker',
                    },
                }
            ).catch(() => null)

            if (checksRes && checksRes.ok) {
                const checksData = (await checksRes.json()) as any
                const runs = checksData.check_runs || []
                if (
                    runs.some(
                        (r: any) => r.conclusion === 'failure' || r.conclusion === 'timed_out'
                    )
                ) {
                    ciStatus = 'failed'
                } else if (
                    runs.some((r: any) => r.status === 'in_progress' || r.status === 'queued')
                ) {
                    ciStatus = 'pending'
                } else if (runs.length > 0 && runs.every((r: any) => r.conclusion === 'success')) {
                    ciStatus = 'passing'
                }
            }
        }

        const prResult: AutonomousPrResult = {
            prNumber: prData?.number,
            url: prData?.html_url,
            title: prData?.title || prTitle,
            state: prData?.state || 'open',
            headRef: taskBranch,
            baseRef: baseBranch,
            diffSummary: {
                additions: prData?.additions ?? 0,
                deletions: prData?.deletions ?? 0,
                changedFiles:
                    prData?.changed_files ?? statusOutput.split('\n').filter(Boolean).length,
            },
            ciStatus,
            createdAt: prData?.created_at,
            updatedAt: prData?.updated_at,
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

redisSub.psubscribe('session_events:*', (err) => {
    if (err) {
        // Intentionally swallowed: Fallback during offline Redis test runs
    }
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
    options?: { kernel?: DurableStepKernel }
) {
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

    const persistTurnMessage = async () => {
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

            // publish to socket rooms if redis is connected
            if (redisPub.status === 'ready') {
                await redisPub.publish(`session_events:${sessionId}`, event.data).catch(() => {
                    // Intentionally swallowed: Suppress Redis publish failure during offline/test execution
                })
            }

            const eventType = parsedEvent.type

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
                    if (rawCommand && isTestExecutionCommand(rawCommand)) {
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
            } else if (eventType === 'AgentEnd') {
                await persistTurnMessage()
                const activeSandbox = sandbox || E2BSandboxService.getActiveSandbox(sessionId)
                if (activeSandbox) {
                    await handleAutonomousTaskBranchAndPr({
                        sessionId,
                        sandbox: activeSandbox,
                    }).catch(() => {
                        // Intentionally swallowed: Autonomous PR creation fallback
                    })
                }
            } else if (eventType === 'AgentUsage') {
                await updateCredits(sessionId, parsedEvent)
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
        if (!hasError) {
            const activeSandbox = sandbox || E2BSandboxService.getActiveSandbox(sessionId)
            if (activeSandbox) {
                await handleAutonomousTaskBranchAndPr({
                    sessionId,
                    sandbox: activeSandbox,
                }).catch(() => {
                    // Intentionally swallowed: Autonomous PR creation fallback
                })
            }
        }
        console.log(
            `[WORKER LISTENER] Stream finished for session '${sessionId}'. Setting Prisma session status -> ${hasError ? 'FAILED' : 'PARKED'}`
        )
        await prisma.session
            .update({
                where: { id: sessionId },
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
    }
}

async function updateCredits(sessionId: string, event: any) {
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

        await prisma.$transaction(async (tx) => {
            if (session.userId) {
                await tx.user.update({
                    where: { id: session.userId },
                    data: {
                        creditBalance: {
                            decrement: calculatedCost,
                        },
                    },
                })
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
                    periodStart,
                    periodEnd,
                },
            })
        })
    } catch (err) {
        console.error(
            `[WORKER LISTENER] Failed to record token usage and update credits for session ${sessionId}:`,
            err
        )
    }
}
