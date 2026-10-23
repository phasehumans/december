import { DurableStepKernel, PrismaDurableStepStorage, StaleEpochError } from '@december/agent'
import { prisma } from '@december/database'
import { calculateGenerationCost, startOfUtcMonth, startOfNextUtcMonth } from '@december/shared'
import Redis from 'ioredis'

import { E2BSandboxService } from './e2b-sandbox.service'

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
