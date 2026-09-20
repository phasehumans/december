import fs from 'node:fs'

import { interpolateSkillPrompt, parseSkillFile } from '@december/shared'

import { Agent } from '../agent'
import { runAgentLoop } from '../agent-loop'

import type { DiscoveredSkill, Tool, AgentEvent } from '@december/shared'

export interface SkillSubagentOptions {
    skill: DiscoveredSkill & { content?: string }
    args?: string[]
    task?: string
    parentAgent: Agent
    signal?: AbortSignal
    onEvent?: (event: AgentEvent) => void
}

export interface SkillSubagentResult {
    success: boolean
    summary: string
    subagentSessionId: string
    totalTurns: number
    error?: string
}

export async function executeSkillInSubagent(
    options: SkillSubagentOptions
): Promise<SkillSubagentResult> {
    const { skill, args = [], task, parentAgent, signal, onEvent } = options

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
    ].join('\n')

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
        workspaceDir: parentAgent.workspaceDir,
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
        const summary = lastAssistant?.content || `Skill '${skill.name}' completed successfully.`

        return {
            success: true,
            summary,
            subagentSessionId,
            totalTurns,
        }
    } catch (err: any) {
        return {
            success: false,
            summary: `Error during subagent execution of '${skill.name}': ${err.message}`,
            subagentSessionId,
            totalTurns,
            error: err.message,
        }
    }
}
