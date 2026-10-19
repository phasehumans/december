import { Agent } from '../agent'
import { runAgentLoop } from '../agent-loop'

import { createGitWorktree, getWorktreeChanges, type WorktreeInfo } from './workspace-worktree'

import type { SpawnSubagentOptions, SubagentRollupSummary, SubagentStatus } from './subagent-types'
import type { Tool } from '@december/shared'

const READ_ONLY_TOOLS = new Set([
    'read_file',
    'ls',
    'grep',
    'find_files',
    'code_intelligence',
    'search_tools',
    'web_search',
    'browser',
    'diff_preview',
])

const TEST_TOOLS = new Set(['bash', 'read_file', 'ls', 'grep', 'find_files', 'search_tools'])

const SUBAGENT_RECURSIVE_TOOLS = new Set(['invoke_subagent', 'spawn_subagent', 'run_skill'])

export function resolveScopedTools(
    allTools: Tool[],
    role: string,
    explicitTools?: string[],
    currentDepth: number = 1,
    maxDepth: number = 5
): Tool[] {
    const roleLower = role.toLowerCase()

    if (explicitTools && explicitTools.length > 0) {
        const allowedSet = new Set(explicitTools)
        return allTools.filter((t) => allowedSet.has(t.name))
    }

    let candidateTools = allTools

    if (
        roleLower.includes('research') ||
        roleLower.includes('review') ||
        roleLower.includes('audit') ||
        roleLower.includes('explore')
    ) {
        candidateTools = candidateTools.filter((t) => {
            if (READ_ONLY_TOOLS.has(t.name)) return true
            if (
                currentDepth < maxDepth &&
                (t.name === 'invoke_subagent' ||
                    t.name === 'spawn_subagent' ||
                    t.name === 'manage_subagent')
            )
                return true
            return false
        })
    } else if (roleLower.includes('test')) {
        candidateTools = candidateTools.filter((t) => {
            if (TEST_TOOLS.has(t.name)) return true
            if (
                currentDepth < maxDepth &&
                (t.name === 'invoke_subagent' ||
                    t.name === 'spawn_subagent' ||
                    t.name === 'manage_subagent')
            )
                return true
            return false
        })
    }

    // Exclude recursive spawning tools only when currentDepth reaches or exceeds maxDepth
    if (currentDepth >= maxDepth) {
        return candidateTools.filter((t) => !SUBAGENT_RECURSIVE_TOOLS.has(t.name))
    }

    return candidateTools
}

export function formatRollupReport(
    summary: Omit<SubagentRollupSummary, 'formattedReport'>
): string {
    const durationSeconds = (summary.durationMs / 1000).toFixed(1)
    const statusHeader =
        summary.status === 'completed'
            ? 'COMPLETED'
            : summary.status === 'killed'
              ? 'CANCELLED'
              : 'FAILED'

    const lines: string[] = [
        `### [Subagent: ${summary.role} (${summary.subagentId})] - ${statusHeader}`,
        `- **Task**: ${summary.task}`,
        `- **Depth**: ${summary.depth}`,
        `- **Status**: ${summary.status} (${summary.totalTurns} turns, ${summary.toolCallsCount} tool calls, ${durationSeconds}s)`,
    ]

    if (summary.model) {
        lines.push(`- **Model**: \`${summary.model}\``)
    }

    if (summary.worktreeBranch) {
        lines.push(`- **Workspace Branch**: \`${summary.worktreeBranch}\` (isolated worktree)`)
    }

    if (summary.modifiedFiles && summary.modifiedFiles.length > 0) {
        lines.push('- **Modified Files**:')
        for (const file of summary.modifiedFiles) {
            lines.push(`  - ${file}`)
        }
    }

    lines.push('')

    if (summary.error) {
        lines.push('#### Error:')
        lines.push(summary.error)
        lines.push('')
    }

    lines.push('#### Rollup Summary & Findings:')
    lines.push(summary.summary || 'Subagent execution finished without output.')

    return lines.join('\n')
}

export async function executeDynamicSubagent(
    options: SpawnSubagentOptions
): Promise<SubagentRollupSummary> {
    const {
        role,
        task,
        model,
        tools,
        workspace = 'inherit',
        maxTurns,
        timeoutMs,
        parentAgent,
        signal,
        onEvent,
        onStream,
        subagentId = `subagent-${role.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`,
    } = options

    const startTime = Date.now()
    const parentDepth = parentAgent.depth ?? 0
    const maxDepth = options.maxDepth ?? parentAgent.maxDepth ?? 5
    const childDepth = options.depth ?? parentDepth + 1
    const effectiveModel = model || (parentAgent.modelOptions as any)?.model

    // Recursion safety check: Reject spawning beyond maxDepth
    if (childDepth > maxDepth || parentDepth >= maxDepth) {
        const errMsg = `Maximum delegation depth (${maxDepth}) reached; must execute directly using available tools.`
        const failResult: Omit<SubagentRollupSummary, 'formattedReport'> = {
            subagentId,
            role,
            task,
            depth: childDepth,
            model: effectiveModel,
            status: 'failed',
            totalTurns: 0,
            toolCallsCount: 0,
            durationMs: 0,
            summary: errMsg,
            error: errMsg,
        }
        return {
            ...failResult,
            formattedReport: formatRollupReport(failResult),
        }
    }

    let worktreeInfo: WorktreeInfo | null = null
    let effectiveWorkspaceDir = parentAgent.workspaceDir

    if (workspace === 'worktree' || workspace === 'branch') {
        const baseDir = parentAgent.workspaceDir || process.cwd()
        worktreeInfo = await createGitWorktree(baseDir, subagentId)
        if (worktreeInfo) {
            effectiveWorkspaceDir = worktreeInfo.worktreePath
        }
    }

    const scopedTools = resolveScopedTools(
        Array.from(parentAgent.tools.values()),
        role,
        tools,
        childDepth,
        maxDepth
    )

    const childModelOptions = model
        ? { ...(parentAgent.modelOptions || {}), model }
        : parentAgent.modelOptions

    const childSystemPrompt = [
        `You are an autonomous, specialized subagent executing the role: '${role}'.`,
        `Delegation depth: ${childDepth} of ${maxDepth}.`,
        `Your primary objective is to execute the designated task with precision and rigor.`,
        '',
        '### Assigned Task',
        task,
        '',
        '### Operational Protocol',
        '1. Inspect, analyze, and verify all required operations empirically using your available tools.',
        '2. Keep your conversation focused strictly on the mission without extraneous conversational pleasantries.',
        '3. Conclude your final turn with a comprehensive, structured rollup summary of your findings, actions taken, and results.',
        childDepth < maxDepth
            ? '4. If a subtask requires deep exploratory isolation, you may delegate to a child subagent using invoke_subagent.'
            : '4. You are at maximum delegation depth. Execute all tasks directly with your available tools without spawning further subagents.',
        effectiveWorkspaceDir
            ? `5. Working directory: ${effectiveWorkspaceDir}${worktreeInfo ? ` (isolated git worktree branch: ${worktreeInfo.branchName})` : ''}`
            : '',
    ]
        .filter(Boolean)
        .join('\n')

    const childAgent = new Agent({
        sessionId: subagentId,
        systemPrompt: childSystemPrompt,
        tools: scopedTools,
        deferredRegistry: parentAgent.deferredRegistry,
        llm: parentAgent.llm,
        operations: parentAgent.operations,
        workspaceDir: effectiveWorkspaceDir,
        modelOptions: childModelOptions,
        thinkingLevel: parentAgent.thinkingLevel,
        disableLogging: parentAgent.disableLogging,
        depth: childDepth,
        maxDepth,
    })

    // Attach child agent reference so manager or steering can access it
    ;(options as any)._childAgent = childAgent

    let totalTurns = 0
    let toolCallsCount = 0
    let status: SubagentStatus = 'completed'
    let error: string | undefined
    let isTimeout = false

    const abortController = new AbortController()

    let timeoutTimer: NodeJS.Timeout | undefined
    if (timeoutMs && timeoutMs > 0) {
        timeoutTimer = setTimeout(() => {
            isTimeout = true
            abortController.abort()
            childAgent.abort()
        }, timeoutMs)
    }

    try {
        if (signal) {
            if (signal.aborted) {
                abortController.abort()
                childAgent.abort()
                status = 'killed'
            } else {
                signal.addEventListener(
                    'abort',
                    () => {
                        abortController.abort()
                        childAgent.abort()
                    },
                    { once: true }
                )
            }
        }

        abortController.signal.addEventListener('abort', () => childAgent.abort(), { once: true })

        onStream?.(`[Subagent: depth ${childDepth} - ${role}] Starting task: ${task}\n`)

        const effectiveMaxTurns = maxTurns && maxTurns > 0 ? maxTurns : undefined

        for await (const event of runAgentLoop(childAgent, task)) {
            onEvent?.(event)

            if (event.type === 'TurnEnd') {
                totalTurns++
                if (effectiveMaxTurns && totalTurns >= effectiveMaxTurns) {
                    childAgent.abort()
                    break
                }
            } else if (event.type === 'ToolCallStart') {
                toolCallsCount++
                onStream?.(
                    `[Subagent: depth ${childDepth} - ${role}] Tool: ${event.toolCall.name}\n`
                )
            } else if (event.type === 'ThinkingChunk') {
                onStream?.(
                    `[Subagent: depth ${childDepth} - ${role}] ${event.content.slice(0, 80)}...\n`
                )
            } else if (event.type === 'StreamChunk') {
                onStream?.(event.content)
            } else if (event.type === 'AgentStatus') {
                onStream?.(`[Subagent: depth ${childDepth} - ${role}] ${event.message}\n`)
            } else if (event.type === 'AgentInterrupt') {
                status = 'killed'
            } else if (event.type === 'AgentError') {
                status = 'failed'
                error = event.error
            }
        }

        if (signal?.aborted || isTimeout) {
            status = 'killed'
            if (isTimeout) {
                error = `Subagent execution timed out after ${timeoutMs}ms`
            }
        }
    } catch (err: any) {
        const isAbort =
            signal?.aborted ||
            isTimeout ||
            err.name === 'AbortError' ||
            err.message?.toLowerCase().includes('aborted')
        status = isAbort ? 'killed' : 'failed'
        error = isTimeout ? `Subagent execution timed out after ${timeoutMs}ms` : err.message
    } finally {
        if (timeoutTimer) {
            clearTimeout(timeoutTimer)
        }
    }

    let modifiedFiles: string[] = []
    let diff = ''
    if (worktreeInfo) {
        const changes = await getWorktreeChanges(worktreeInfo.worktreePath)
        modifiedFiles = changes.modifiedFiles
        diff = changes.diff
    }

    const assistantMsgs = childAgent.messages.filter(
        (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()
    )
    const lastAssistant = assistantMsgs[assistantMsgs.length - 1]
    const summary =
        lastAssistant?.content ||
        (status === 'completed'
            ? `Subagent '${role}' executed task successfully.`
            : `Subagent '${role}' ${status}.`)

    const rollup: Omit<SubagentRollupSummary, 'formattedReport'> = {
        subagentId,
        role,
        task,
        depth: childDepth,
        model: effectiveModel,
        status,
        totalTurns,
        toolCallsCount,
        durationMs: Date.now() - startTime,
        summary,
        workspaceDir: effectiveWorkspaceDir,
        worktreeBranch: worktreeInfo?.branchName,
        modifiedFiles,
        diff,
        error,
    }

    return {
        ...rollup,
        formattedReport: formatRollupReport(rollup),
    }
}
