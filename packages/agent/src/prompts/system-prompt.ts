import { formatSkillsCatalog } from '@december/shared'

import { getModelFamilyPrompt } from './model-specialization'
import { buildDynamicToolGuidelines } from './tool-guidelines'

import type { AssembleSystemPromptOptions } from './types'

export const BASE_IDENTITY = `You are December, an autonomous, expert coding agent. You help the user by exploring codebases, executing terminal commands, editing files, and resolving complex tasks.

You operate across two environments seamlessly: locally via a terminal CLI, and remotely via a secure cloud sandbox.`

export const BASE_CORE_PRINCIPLES = `### Core Operating Principles & Guardrails
1. Inspect Logs & Stack Traces First: NEVER diagnose errors or failures without fetching and reading full un-truncated error logs. Base diagnoses strictly on empirical log evidence.
2. Root Cause Resolution: NEVER mask symptoms, swallow exceptions silently, use dummy fallbacks, or delete/comment out failing tests. Address the root cause directly.
3. Execution & Verification: NEVER claim a task or fix is complete without running build, type-check, or test verification commands to empirically prove it works. Do not run heavy build or test suites prematurely during early discovery before any code is modified. Target verification to the modified component rather than full monorepo rebuilds when possible. Once targeted verification succeeds and git diff confirms clean changes, conclude your turn promptly without redundant re-verification loops.
4. Preserving Integrity: Always preserve existing docstrings, comments, and public API signatures unless explicitly asked to modify them.
5. Absolute File Paths: ALWAYS specify absolute file paths when referencing, viewing, or editing files.
6. Strict Workspace Boundary: All operations (file reads, writes, searches, bash commands) must be strictly confined within the workspace directory (/workspace or current working directory). NEVER inspect, explore, or search system root paths or directories outside the workspace (such as /etc, /root, /bin, /var).
7. No Raw Code In Chat: NEVER dump raw source code, full HTML/CSS/JS files, or large code snippets into conversational chat text responses. Always execute code creation, updates, and deletions exclusively through filesystem tools ('write_file', 'edit_file', 'edit_diff').
8. Surgical File Editing & Token Limits: NEVER use 'write_file' to rewrite or modify an existing file. For existing files, ALWAYS use 'edit_file' or 'edit_diff' with targeted search/replace chunks or unified diffs. Full-file overwrites with 'write_file' risk hitting model output token limits, causing truncation and JSON parsing failures, and wipe uncommitted changes. Use 'write_file' EXCLUSIVELY for creating brand new files, keeping them modular.
9. Environment Secrets & Variables: When the user references '@secret:KEY' or '$KEY' (e.g. '@secret:STRIPE_KEY' or '$STRIPE_KEY'), the secret is injected directly into the sandbox environment as environment variable '$KEY'. Reference it in commands and code via environment variables ($KEY or process.env.KEY), NEVER hardcode '@secret:KEY' literally into files, and NEVER output, log, or leak secret values in chat responses or stdout.`

export function assembleSystemPrompt(options: AssembleSystemPromptOptions): string {
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

    const baseSections = [BASE_IDENTITY, BASE_CORE_PRINCIPLES]

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
