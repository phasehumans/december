import { execFile } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'

import { interpolateSkillPrompt, parseSkillFile } from '@december/shared'
import {
    createWorktree,
    getWorktreeChanges,
    cleanupWorktree,
    mergeWorktree,
    type WorktreeInfo,
} from '@december/tools'

import { Agent } from '../agent'
import { runAgentLoop } from '../agent-loop'

import type { DiscoveredSkill, Tool, AgentEvent } from '@december/shared'

const execFileAsync = promisify(execFile)

export interface SkillSubagentOptions {
    skill: DiscoveredSkill & { content?: string }
    args?: string[]
    task?: string
    parentAgent: Agent
    signal?: AbortSignal
    onEvent?: (event: AgentEvent) => void
    isolation?: 'inherit' | 'worktree'
    worktreeLifecycle?: 'cleanup' | 'keep' | 'merge'
}

export interface SkillSubagentResult {
    success: boolean
    summary: string
    subagentSessionId: string
    totalTurns: number
    error?: string
    worktreeBranch?: string
    worktreePath?: string
    modifiedFiles?: string[]
    diff?: string
}

export async function executeSkillInSubagent(
    options: SkillSubagentOptions
): Promise<SkillSubagentResult> {
    const { skill, args = [], task, parentAgent, signal, onEvent, isolation = 'inherit' } = options

    let rawBody = skill.content || ''
    if (!rawBody && skill.entryFilePath && fs.existsSync(skill.entryFilePath)) {
        try {
            const parsed = parseSkillFile(skill.entryFilePath)
            rawBody = parsed.body
        } catch {
            // Intentionally swallowed: fallback to reading raw file if parser fails
            try {
                rawBody = fs.readFileSync(skill.entryFilePath, 'utf8')
            } catch (err: any) {
                return {
                    success: false,
                    summary: `Failed to read skill instructions: ${err.message}`,
                    subagentSessionId: `failed-${Date.now()}`,
                    totalTurns: 0,
                    error: err.message,
                }
            }
        }
    }

    const interpolatedBody = interpolateSkillPrompt(skill.name, rawBody, args, skill.directoryPath)
    const subagentSessionId = `subagent-${skill.name}-${Date.now()}`

    let worktreeInfo: WorktreeInfo | null = null
    const baseDir = parentAgent.workspaceDir || process.cwd()

    if (isolation === 'worktree') {
        const slug = `skill-${skill.name.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now().toString(36)}`
        worktreeInfo = await createWorktree(baseDir, slug)
    }

    const effectiveWorkspaceDir = worktreeInfo?.worktreePath || parentAgent.workspaceDir

    const childSystemPrompt = [
        `You are a specialized subagent executing the skill '${skill.name}'.`,
        `Your mission is to execute the procedural instructions thoroughly and autonomously, verifying all operations empirically.`,
        '',
        '### Skill Instructions',
        interpolatedBody,
        '',
        '### Protocol',
        '1. Use your available tools to perform all required inspection, edits, and verification.',
        '2. Conclude your turn with a concise, high-signal summary of what you did and the verification results.',
        effectiveWorkspaceDir
            ? `3. Working directory: ${effectiveWorkspaceDir}${worktreeInfo ? ` (isolated git worktree branch: ${worktreeInfo.branchName})` : ''}`
            : '',
    ]
        .filter(Boolean)
        .join('\n')

    // Filter tools based on skill.metadata.allowedTools if declared
    let scopedTools: Tool[] = []
    if (skill.metadata?.allowedTools && skill.metadata.allowedTools.length > 0) {
        const allowedSet = new Set(skill.metadata.allowedTools)
        scopedTools = Array.from(parentAgent.tools.values()).filter((t) => allowedSet.has(t.name))
    } else {
        scopedTools = Array.from(parentAgent.tools.values())
    }

    const childAgent = new Agent({
        sessionId: subagentSessionId,
        systemPrompt: childSystemPrompt,
        tools: scopedTools,
        deferredRegistry: parentAgent.deferredRegistry,
        llm: parentAgent.llm,
        operations: parentAgent.operations,
        workspaceDir: effectiveWorkspaceDir,
        modelOptions: parentAgent.modelOptions,
        thinkingLevel: parentAgent.thinkingLevel,
        disableLogging: parentAgent.disableLogging,
    })

    const promptText =
        task ||
        (args.length > 0
            ? `Execute skill '${skill.name}' with arguments: ${args.join(' ')}`
            : `Execute skill '${skill.name}'.`)

    let totalTurns = 0
    let success = false
    let summary = ''
    let error: string | undefined

    try {
        if (signal) {
            signal.addEventListener(
                'abort',
                () => {
                    childAgent.abort()
                },
                { once: true }
            )
        }

        for await (const event of runAgentLoop(childAgent, promptText)) {
            onEvent?.(event)
            if (event.type === 'TurnEnd') {
                totalTurns++
            }
        }

        const assistantMsgs = childAgent.messages.filter(
            (m) => m.role === 'assistant' && typeof m.content === 'string' && m.content.trim()
        )
        const lastAssistant = assistantMsgs[assistantMsgs.length - 1]
        summary = lastAssistant?.content || `Skill '${skill.name}' completed successfully.`
        success = true
    } catch (err: any) {
        success = false
        summary = `Error during subagent execution of '${skill.name}': ${err.message}`
        error = err.message
    }

    let modifiedFiles: string[] = []
    let diff = ''
    if (worktreeInfo) {
        const changes = await getWorktreeChanges(worktreeInfo.worktreePath)
        modifiedFiles = changes.modifiedFiles
        diff = changes.diff

        const lifecycle = options.worktreeLifecycle
        if (lifecycle === 'cleanup' || (!success && !lifecycle)) {
            await cleanupWorktree(baseDir, worktreeInfo.worktreePath, {
                deleteBranch: true,
                branchName: worktreeInfo.branchName,
            })
        } else if (lifecycle === 'merge' && success) {
            if (modifiedFiles.length > 0) {
                try {
                    await execFileAsync('git', ['add', '-A'], { cwd: worktreeInfo.worktreePath })
                    await execFileAsync(
                        'git',
                        ['commit', '-m', `changes from skill ${skill.name}`],
                        {
                            cwd: worktreeInfo.worktreePath,
                        }
                    )
                } catch {
                    // Intentionally swallowed: commit fallback
                }
            }
            await mergeWorktree(baseDir, worktreeInfo.branchName)
            await cleanupWorktree(baseDir, worktreeInfo.worktreePath, {
                deleteBranch: true,
                branchName: worktreeInfo.branchName,
            })
        } else if (lifecycle === 'keep') {
            await cleanupWorktree(baseDir, worktreeInfo.worktreePath, {
                deleteBranch: false,
            })
        }
    }

    return {
        success,
        summary,
        subagentSessionId,
        totalTurns,
        error,
        worktreeBranch: worktreeInfo?.branchName,
        worktreePath: worktreeInfo?.worktreePath,
        modifiedFiles,
        diff,
    }
}
