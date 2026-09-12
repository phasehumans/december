import fs from 'node:fs'
import path from 'node:path'

import { SkillDiscoveryEngine, formatSkillsCatalog } from '@december/shared'

import { Agent } from '../agent'

import type { AgentConfig } from '../agent'
import type { Tool, DiscoveredSkill } from '@december/shared'

export const DEFAULT_TOOL_PROMPTS: Record<string, { snippet: string; guidelines: string[] }> = {
    grep_search: {
        snippet: 'Exact regex/literal search across files',
        guidelines: [
            "Use 'grep_search' for exact matching of symbols, functions, types, and error strings across files rather than inspecting files one-by-one.",
        ],
    },
    find_files: {
        snippet: 'Find files matching glob patterns',
        guidelines: [
            'Use \'find_files\' with glob patterns (e.g. "**/*.ts") to locate target files efficiently within the workspace.',
        ],
    },
    edit_file: {
        snippet: 'Precise search-and-replace edits including multiple disjoint replacements',
        guidelines: [
            "ALWAYS use 'edit_file' or 'edit_diff' when changing existing files to preserve untouched code and avoid token limits.",
            "When changing multiple separate locations in one file, use one 'edit_file' call with multiple entries in edits[] instead of multiple sequential calls.",
        ],
    },
    edit_diff: {
        snippet: 'Apply unified diff patches',
        guidelines: [
            "Use 'edit_diff' when you have a complete unified diff patch with accurate context lines.",
        ],
    },
    write_file: {
        snippet: 'Create brand new files',
        guidelines: [
            "Use 'write_file' EXCLUSIVELY for creating brand new files. NEVER use 'write_file' to rewrite or modify an existing file.",
        ],
    },
    read_file: {
        snippet: 'Read file contents with line pagination',
        guidelines: [
            "Use 'read_file' to inspect source code and logs. Use startLine and endLine for large files.",
        ],
    },
    bash: {
        snippet: 'Execute shell commands in the terminal',
        guidelines: [
            "Use 'bash' to run builds, tests, linters, and verify changes. Commands will run in the workspace.",
        ],
    },
    manage_task: {
        snippet: 'Monitor and manage background tasks',
        guidelines: ["Use 'manage_task' to monitor, send input to, or stop background processes."],
    },
    web_search: {
        snippet: 'Search web for docs and APIs',
        guidelines: [
            "Use 'web_search' to fetch up-to-date framework docs, library APIs, or external stack traces.",
        ],
    },
    ask_question: {
        snippet: 'Prompt user for interactive decisions',
        guidelines: [
            "Use 'ask_question' when you need user clarification between distinct architectural alternatives.",
        ],
    },
    ls: {
        snippet: 'List directory contents',
        guidelines: ["Use 'ls' to inspect directory contents and structure."],
    },
}

export function isReasoningModel(model?: string, thinkingLevel?: string): boolean {
    if (!model) {
        return thinkingLevel !== undefined && thinkingLevel !== 'off'
    }
    const m = model.toLowerCase()
    if (
        m.includes('o1') ||
        m.includes('o3') ||
        m.includes('deepseek-reasoner') ||
        m.includes('deepseek-r1')
    ) {
        return true
    }
    if (m.includes('claude') && thinkingLevel && thinkingLevel !== 'off') {
        return true
    }
    return false
}

export function getModelFamilyPrompt(options: { model?: string; thinkingLevel?: string }): {
    roleGuidelines: string
    reasoningProtocol: string
    suppressThoughtTags: boolean
} {
    const model = options.model?.toLowerCase() || ''
    const reasoning = isReasoningModel(options.model, options.thinkingLevel)

    if (reasoning) {
        return {
            roleGuidelines: `### Model Specialization (Autonomous Reasoning & Verification)
- Persistent Problem Solving: Keep going until the user's task or bug is completely resolved and empirically verified before ending your turn.
- Comprehensive Verification: Failing to test your code sufficiently rigorously is the primary failure mode. NEVER end your turn without having truly and completely solved the problem, run test/build commands, and verified edge cases.
- Independent Execution: Solve blockers and diagnose root causes autonomously rather than stopping to ask premature questions.`,
            reasoningProtocol: `### Communication Protocol
- Conciseness & Chat Focus: Be direct and concise. In chat messages, provide ONLY high-level status updates, architectural decisions, and tool confirmations. Do not repeat file contents in chat.
- Execution Summary: At the end of your work, provide a concise summary (max 4-5 lines, single cohesive paragraph) highlighting key actions, modified files, and test verification results.`,
            suppressThoughtTags: true,
        }
    }

    if (model.includes('claude') || model.includes('anthropic')) {
        return {
            roleGuidelines: `### Model Specialization (Anthropic / Claude)
- Objectivity & Discipline: Maintain strict professional objectivity. Do not use emojis, unnecessary pleasantries, or verbose conversational filler.
- Proactive Task Breakdown: Break down complex requests into orderly stages, verify each stage empirically, and maintain single-step transitions.`,
            reasoningProtocol: `### Reasoning & Communication Protocol
- Thought Enclosure: Before calling any tool, you MUST enclose your step-by-step reasoning inside <thought>...</thought> tags. Write thoughts directly as natural, concise reasoning steps without outline scaffolding, markdown headers, or bullet lists (do NOT write labels like "* **Goal Understanding:**" or structured outlines).
- Conciseness & Chat Focus: Be direct and concise. In chat messages, provide ONLY high-level status updates, architectural decisions, and tool confirmations. Do not repeat file contents in chat.
- Execution Summary: At the end of your work, provide a concise summary (max 4-5 lines, single cohesive paragraph) highlighting key actions, modified files, and test verification results.`,
            suppressThoughtTags: false,
        }
    }

    if (model.includes('gemini')) {
        return {
            roleGuidelines: `### Model Specialization (Gemini)
- Structured Execution: Follow clear operational phases: 1) Explore and gather context, 2) Formulate targeted edits, 3) Verify thoroughly.
- Absolute File Paths: STRICTLY specify absolute file paths when referencing, viewing, or editing files. NEVER output ambiguous relative paths.`,
            reasoningProtocol: `### Reasoning & Communication Protocol
- Thought Enclosure: Before calling any tool, you MUST enclose your step-by-step reasoning inside <thought>...</thought> tags. Write thoughts directly as natural, concise reasoning steps without outline scaffolding, markdown headers, or bullet lists (do NOT write labels like "* **Goal Understanding:**" or structured outlines).
- Conciseness & Chat Focus: Be direct and concise. In chat messages, provide ONLY high-level status updates, architectural decisions, and tool confirmations. Do not repeat file contents in chat.
- Execution Summary: At the end of your work, provide a concise summary (max 4-5 lines, single cohesive paragraph) highlighting key actions, modified files, and test verification results.`,
            suppressThoughtTags: false,
        }
    }

    return {
        roleGuidelines: '',
        reasoningProtocol: `### Reasoning & Communication Protocol
- Thought Enclosure: Before calling any tool, you MUST enclose your step-by-step reasoning inside <thought>...</thought> tags. Write thoughts directly as natural, concise reasoning steps without outline scaffolding, markdown headers, or bullet lists (do NOT write labels like "* **Goal Understanding:**" or structured outlines).
- Conciseness & Chat Focus: Be direct and concise. In chat messages, provide ONLY high-level status updates, architectural decisions, and tool confirmations. Do not repeat file contents in chat.
- Execution Summary: At the end of your work, provide a concise summary (max 4-5 lines, single cohesive paragraph) highlighting key actions, modified files, and test verification results.`,
        suppressThoughtTags: false,
    }
}

export function buildDynamicToolGuidelines(
    activeTools: Array<Tool | { name: string; description?: string }>
): string {
    if (!activeTools || activeTools.length === 0) return ''

    const lines: string[] = []
    for (const tool of activeTools) {
        const contrib = DEFAULT_TOOL_PROMPTS[tool.name]
        if (contrib) {
            for (const g of contrib.guidelines) {
                if (!lines.includes(`- ${g}`)) {
                    lines.push(`- ${g}`)
                }
            }
        }
    }

    if (lines.length === 0) return ''
    return `### Tool Selection & Guidelines\n${lines.join('\n')}`
}

export function discoverProjectRules(
    startDir: string,
    rootBoundary?: string
): { path: string; content: string }[] {
    const candidateNames = [
        'AGENTS.override.md',
        'AGENTS.md',
        'CLAUDE.md',
        path.join('.december', 'rules.md'),
        path.join('.december', 'AGENTS.md'),
    ]
    const seen = new Set<string>()
    let current = path.resolve(startDir)
    const boundary = rootBoundary ? path.resolve(rootBoundary) : path.parse(current).root
    const collectedFiles: { path: string; content: string }[] = []

    while (true) {
        for (const name of candidateNames) {
            const candidatePath = path.join(current, name)
            if (fs.existsSync(candidatePath)) {
                try {
                    if (fs.statSync(candidatePath).isFile()) {
                        if (!seen.has(candidatePath)) {
                            seen.add(candidatePath)
                            const content = fs.readFileSync(candidatePath, 'utf8').trim()
                            if (content) {
                                collectedFiles.unshift({ path: candidatePath, content }) // Root-most rules first
                            }
                        }
                    }
                } catch {
                    // Intentionally swallowed: candidate file read error fallback
                }
            }
        }

        if (current === boundary) break
        const parent = path.dirname(current)
        if (parent === current) break
        current = parent
    }

    return collectedFiles
}

export function assembleSystemPrompt(options: {
    baseSystemPrompt?: string
    workspaceDir: string
    tools?: Tool[]
    modelOptions?: Record<string, any>
    thinkingLevel?: string
    skills?: DiscoveredSkill[]
    rules?: { path: string; content: string }[]
    userRules?: string
    availableSecrets?: string[]
}): string {
    const {
        baseSystemPrompt,
        workspaceDir,
        tools = [],
        modelOptions,
        thinkingLevel,
        skills = [],
        rules = [],
        userRules,
        availableSecrets = [],
    } = options

    const effectiveRules = [...rules]
    if (userRules && userRules.trim()) {
        const trimmedUserRules = userRules.trim()
        const alreadyIncluded = effectiveRules.some((r) => r.content.trim() === trimmedUserRules)
        if (!alreadyIncluded) {
            effectiveRules.unshift({
                path: 'User Custom Rules',
                content: trimmedUserRules,
            })
        }
    }

    if (baseSystemPrompt) {
        let finalPrompt = baseSystemPrompt

        if (skills.length > 0) {
            finalPrompt += `\n\n${formatSkillsCatalog(skills)}`
        }

        if (effectiveRules.length > 0) {
            finalPrompt += `\n\n<project_context>\nThe user has provided the following project-specific instructions and guidelines from their .december workspace:\n`
            for (const rule of effectiveRules) {
                finalPrompt += `<project_instructions path="${rule.path}">\n${rule.content}\n</project_instructions>\n`
            }
            finalPrompt += `</project_context>`
        }

        if (availableSecrets.length > 0) {
            finalPrompt += `\n\n<injected_secrets>\nThe following user secrets are currently injected as environment variables in the sandbox:\n${availableSecrets.map((s) => `- $${s} (referenced in prompts as @secret:${s} or $${s})`).join('\n')}\n</injected_secrets>`
        }

        finalPrompt += `\n\nCurrent date: ${new Date().toISOString().split('T')[0]}\nCurrent working directory: ${workspaceDir}`
        return finalPrompt
    }

    const modelPrompt = getModelFamilyPrompt({
        model: modelOptions?.model,
        thinkingLevel: thinkingLevel || modelOptions?.thinkingLevel,
    })

    const toolGuidelines = buildDynamicToolGuidelines(tools)

    const baseSections = [
        `You are December, an autonomous, expert coding agent. You help the user by exploring codebases, executing terminal commands, editing files, and resolving complex tasks.\n\nYou operate across two environments seamlessly: locally via a terminal CLI, and remotely via a secure cloud sandbox.`,
        `### Core Operating Principles & Guardrails\n1. Inspect Logs & Stack Traces First: NEVER diagnose errors or failures without fetching and reading full un-truncated error logs. Base diagnoses strictly on empirical log evidence.\n2. Root Cause Resolution: NEVER mask symptoms, swallow exceptions silently, use dummy fallbacks, or delete/comment out failing tests. Address the root cause directly.\n3. Execution & Verification: NEVER claim a task or fix is complete without running build, type-check, or test verification commands to empirically prove it works.\n4. Preserving Integrity: Always preserve existing docstrings, comments, and public API signatures unless explicitly asked to modify them.\n5. Absolute File Paths: ALWAYS specify absolute file paths when referencing, viewing, or editing files.\n6. Strict Workspace Boundary: All operations (file reads, writes, searches, bash commands) must be strictly confined within the workspace directory (/workspace or current working directory). NEVER inspect, explore, or search system root paths or directories outside the workspace (such as /etc, /root, /bin, /var).\n7. No Raw Code In Chat: NEVER dump raw source code, full HTML/CSS/JS files, or large code snippets into conversational chat text responses. Always execute code creation, updates, and deletions exclusively through filesystem tools ('write_file', 'edit_file', 'edit_diff').\n8. Surgical File Editing & Token Limits: NEVER use 'write_file' to rewrite or modify an existing file. For existing files, ALWAYS use 'edit_file' or 'edit_diff' with targeted search/replace chunks or unified diffs. Full-file overwrites with 'write_file' risk hitting model output token limits, causing truncation and JSON parsing failures, and wipe uncommitted changes. Use 'write_file' EXCLUSIVELY for creating brand new files, keeping them modular.\n9. Environment Secrets & Variables: When the user references '@secret:KEY' or '$KEY' (e.g. '@secret:STRIPE_KEY' or '$STRIPE_KEY'), the secret is injected directly into the sandbox environment as environment variable '$KEY'. Reference it in commands and code via environment variables ($KEY or process.env.KEY), NEVER hardcode '@secret:KEY' literally into files, and NEVER output, log, or leak secret values in chat responses or stdout.`,
    ]

    if (modelPrompt.roleGuidelines) {
        baseSections.push(modelPrompt.roleGuidelines)
    }

    if (toolGuidelines) {
        baseSections.push(toolGuidelines)
    }

    baseSections.push(modelPrompt.reasoningProtocol)

    let finalPrompt = baseSections.join('\n\n')

    if (skills.length > 0) {
        finalPrompt += `\n\n${formatSkillsCatalog(skills)}`
    }

    if (effectiveRules.length > 0) {
        finalPrompt += `\n\n<project_context>\nThe user has provided the following project-specific instructions and guidelines from their .december workspace:\n`
        for (const rule of effectiveRules) {
            finalPrompt += `<project_instructions path="${rule.path}">\n${rule.content}\n</project_instructions>\n`
        }
        finalPrompt += `</project_context>`
    }

    if (availableSecrets.length > 0) {
        finalPrompt += `\n\n<injected_secrets>\nThe following user secrets are currently injected as environment variables in the sandbox:\n${availableSecrets.map((s) => `- $${s} (referenced in prompts as @secret:${s} or $${s})`).join('\n')}\n</injected_secrets>`
    }

    // Dynamic environment context placed at the end to keep static prefix identical for prompt caching
    finalPrompt += `\n\nCurrent date: ${new Date().toISOString().split('T')[0]}\nCurrent working directory: ${workspaceDir}`

    return finalPrompt
}

export interface HarnessConfig extends Omit<AgentConfig, 'systemPrompt'> {
    baseSystemPrompt?: string
    workspaceDir: string
    homeDir?: string
    rootBoundary?: string
    userRules?: string
    availableSecrets?: string[]
}

export class AgentHarness {
    private agent: Agent
    private config: HarnessConfig
    private skills: DiscoveredSkill[]

    constructor(config: HarnessConfig) {
        this.config = config

        // 1. discover structured skills
        const skillEngine = new SkillDiscoveryEngine({
            workspaceDir: config.workspaceDir,
            homeDir: config.homeDir,
        })
        this.skills = skillEngine.discoverAllSkills()

        // 2. discover project rules climbing from workspace directory to root
        const rules = discoverProjectRules(config.workspaceDir, config.rootBoundary)

        // 3. assemble final system prompt with model-specific dispatch and dynamic tool guidelines
        const finalPrompt = assembleSystemPrompt({
            baseSystemPrompt: config.baseSystemPrompt,
            workspaceDir: config.workspaceDir,
            tools: config.tools,
            modelOptions: config.modelOptions,
            thinkingLevel: config.thinkingLevel,
            skills: this.skills,
            rules,
            userRules: config.userRules,
            availableSecrets: config.availableSecrets,
        })

        // 4. initialize core agent
        this.agent = new Agent({
            ...config,
            systemPrompt: finalPrompt,
        })
    }

    public static async create(config: HarnessConfig): Promise<AgentHarness> {
        return new AgentHarness(config)
    }

    public getDiscoveredSkills(): DiscoveredSkill[] {
        return this.skills
    }

    public getAgent(): Agent {
        return this.agent
    }
}
