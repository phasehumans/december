import { formatSkillsCatalog } from '@december/shared'

import type { AssembleSystemPromptOptions } from './types'

export const DEFAULT_PI_IDENTITY = `You are an expert coding assistant operating inside the workspace. You help users by reading files, executing commands, editing code, and writing new files.`

export const DEFAULT_PI_RULES = `<rules>
- Use bash for file operations like ls, rg, find
- Be concise in your responses
- Show file paths clearly when working with files
</rules>`

export const BASE_IDENTITY = DEFAULT_PI_IDENTITY
export const LEAN_IDENTITY = DEFAULT_PI_IDENTITY

export function assembleSystemPrompt(options: AssembleSystemPromptOptions): string {
    const {
        baseSystemPrompt,
        workspaceDir,
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

        finalPrompt += `\n\n<cwd>\n${workspaceDir}\n</cwd>\nCurrent date: ${new Date().toISOString().split('T')[0]}`
        return finalPrompt
    }

    // Default Pi-style static-prefix system prompt
    const sections: string[] = [DEFAULT_PI_IDENTITY, DEFAULT_PI_RULES]

    if (skills.length > 0) {
        sections.push(formatSkillsCatalog(skills))
    }

    if (effectiveRules.length > 0) {
        let contextSection = `<project_context>\nThe user has provided the following project-specific instructions and guidelines from their .december workspace:\n`
        for (const rule of effectiveRules) {
            contextSection += `<project_instructions path="${rule.path}">\n${rule.content}\n</project_instructions>\n`
        }
        contextSection += `</project_context>`
        sections.push(contextSection)
    }

    if (availableSecrets.length > 0) {
        sections.push(
            `<injected_secrets>\nThe following user secrets are currently injected as environment variables in the sandbox:\n${availableSecrets.map((s) => `- $${s} (referenced in prompts as @secret:${s} or $${s})`).join('\n')}\n</injected_secrets>`
        )
    }

    // Dynamic environment context placed strictly at the very end to keep static prefix identical for prompt caching
    sections.push(
        `<cwd>\n${workspaceDir}\n</cwd>\nCurrent date: ${new Date().toISOString().split('T')[0]}`
    )

    return sections.join('\n\n')
}
