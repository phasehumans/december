import { supportsModelThinking } from '@december/providers'

import type {
    ModelFamily,
    ModelFamilyPromptOptions,
    ModelFamilyPromptResult,
    ModelTier,
} from './types'

export function isReasoningModel(model?: string, thinkingLevel?: string): boolean {
    if (thinkingLevel === 'off') {
        return false
    }
    if (!model) {
        return thinkingLevel !== undefined && thinkingLevel !== 'off'
    }
    return supportsModelThinking(model)
}

export function isCompactModel(model?: string): boolean {
    if (!model) return false
    const lower = model.toLowerCase()

    // Compact or lightweight model identifiers
    const compactKeywords = [
        'haiku',
        'flash-lite',
        'mini',
        'nano',
        '7b',
        '8b',
        '14b',
        'small',
        'fast',
        'flash-8b',
        'inkling-small',
        'ministral-3-14b',
        'gemma-4-26b',
    ]

    return compactKeywords.some((k) => lower.includes(k))
}

export function getModelTier(model?: string, thinkingLevel?: string): ModelTier {
    if (isReasoningModel(model, thinkingLevel)) {
        return 'reasoning'
    }
    if (isCompactModel(model)) {
        return 'compact'
    }
    return 'frontier'
}

export function getModelFamily(model?: string): ModelFamily {
    if (!model) return 'generic'
    const lower = model.toLowerCase()
    if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic'
    if (lower.includes('gemini') || lower.includes('google') || lower.includes('gemma')) {
        return 'google'
    }
    if (
        lower.includes('openai') ||
        lower.startsWith('gpt') ||
        lower.startsWith('o1') ||
        lower.startsWith('o3') ||
        lower.startsWith('o4')
    ) {
        return 'openai'
    }
    if (lower.includes('deepseek')) return 'deepseek'
    return 'generic'
}

export function getModelFamilyPrompt(options: ModelFamilyPromptOptions): ModelFamilyPromptResult {
    const { model, thinkingLevel } = options
    const reasoning = isReasoningModel(model, thinkingLevel)
    const compact = isCompactModel(model)
    const family = getModelFamily(model)

    const sections: string[] = []

    // 1. Tier-specific specialization
    if (reasoning) {
        sections.push(`### Model Specialization (Autonomous Reasoning & Verification)
- Persistent Problem Solving: Keep going until the user's task or bug is completely resolved and empirically verified before ending your turn.
- Comprehensive Verification: Failing to test your code sufficiently rigorously is the primary failure mode. NEVER end your turn without having truly and completely solved the problem, run test/build commands, and verified edge cases.
- Independent Execution: Solve blockers and diagnose root causes autonomously rather than stopping to ask premature questions.
- Diff-First Protocol ("Diff Model"): When editing existing files, plan surgical patches in your thinking trace and execute them exclusively via 'edit_file' or 'edit_diff'. Never rewrite whole files. Preserve all untouched code and surrounding formatting.
- Concise Chat Output: In visible chat messages, output only concise execution updates, diff summaries, and verification commands. Do not repeat internal thinking traces in user chat text.`)
    } else if (compact) {
        sections.push(`### Model Specialization (Compact Model Execution & Grounding)
- Step-by-Step Cadence: Always execute in a strict sequential workflow: 1) Locate: verify file path with 'grep_search' or 'find_files' before editing. Never guess or fabricate paths. 2) Read: inspect exact lines with 'read_file'. 3) Edit: apply targeted edits with 'edit_file' matching exact characters. 4) Verify: run tests or build with 'bash' to confirm the fix before ending your turn.
- Strict Schema Adherence: Provide exact parameter names matching tool definitions and strictly valid JSON. Never output markdown code fences inside tool arguments.
- Direct Grounding: Base every action strictly on empirical file contents and terminal output. Never hallucinate non-existent files, functions, or parameters.`)
    }

    // 2. Provider Family specialization
    if (family === 'anthropic') {
        sections.push(`### Model Specialization (Anthropic / Claude)
- Objectivity & Discipline: Maintain strict professional objectivity. Do not use emojis, unnecessary pleasantries, or verbose conversational filler.
- Proactive Task Breakdown: Break down complex requests into orderly stages, verify each stage empirically, and maintain single-step transitions.`)
    } else if (family === 'google') {
        sections.push(`### Model Specialization (Gemini)
- Structured Execution: Follow clear operational phases: 1) Explore and gather context (inspect repo layout in monorepos before deep-diving), 2) Formulate targeted edits, 3) Verify thoroughly.
- Efficient Verification: Run verification tests only after modifying files, not during early exploratory discovery. Once targeted tests pass and git diff is verified clean, complete your response immediately without repeating status, diff, or test commands.
- Absolute File Paths: STRICTLY specify absolute file paths when referencing, viewing, or editing files. NEVER output ambiguous relative paths.`)
    }

    const reasoningProtocol = `### Communication Protocol
- Conciseness & Chat Focus: Be direct and concise. In chat messages, provide ONLY high-level status updates, architectural decisions, and tool confirmations. Do not repeat file contents in chat.
- Execution Summary: At the end of your work, provide a concise summary (max 4-5 lines, single cohesive paragraph) highlighting key actions, modified files, and test verification results.`

    return {
        roleGuidelines: sections.join('\n\n'),
        reasoningProtocol,
        suppressThoughtTags: true,
    }
}
