import { prisma } from '../../config/db'

import type { UpsertStyleGuidelines, LoadMemoryPromptInstructions } from './memory.types'

export function extractStyleGuidelines(prompt: string): Record<string, string> {
    const guidelines: Record<string, string> = {}
    const regex =
        /\b(theme|color|palette|font|style|layout|spacing|border|radius|shadow|background)\s*:\s*([^;\n,.]+)/gi
    let match
    while ((match = regex.exec(prompt)) !== null) {
        const key = match[1]?.toLowerCase().trim()
        const value = match[2]?.trim()
        if (key && value && !value.startsWith('//') && !value.startsWith('http')) {
            guidelines[key] = value
        }
    }
    return guidelines
}

export async function upsertStyleGuidelines(data: UpsertStyleGuidelines): Promise<void> {
    const { projectId, guidelines } = data
    const entries = Object.entries(guidelines)
    if (entries.length === 0) return

    await Promise.all(
        entries.map(async ([key, value]) => {
            await prisma.projectMemory.upsert({
                where: {
                    projectId_key: {
                        projectId,
                        key,
                    },
                },
                update: {
                    value,
                },
                create: {
                    projectId,
                    key,
                    value,
                },
            })
        })
    )
}

export async function loadMemoryPromptInstructions(
    data: LoadMemoryPromptInstructions
): Promise<string> {
    const { projectId, userId } = data
    let instructions = ''

    // 1. Load general design preference (design.md)
    if (userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { design: true },
        })
        if (user?.design?.trim()) {
            instructions += `\n### General Design Preferences (design.md):\n${user.design.trim()}\n`
        }
    }

    // 2. Load project-specific guidelines
    const memories = await prisma.projectMemory.findMany({
        where: { projectId },
        select: { key: true, value: true },
        orderBy: { key: 'asc' },
    })

    if (memories.length > 0) {
        instructions += `\n### Project-Specific Style Guidelines:\n`
        for (const memory of memories) {
            instructions += `- ${memory.key}: ${memory.value}\n`
        }
    }

    if (instructions) {
        return `\n=== CUSTOM DESIGN SYSTEM AND STYLE INSTRUCTIONS ===\nYou must adhere strictly to these design instructions and style preferences during code planning and generation:\n${instructions}===================================================\n`
    }

    return ''
}

export function getErrorSignature(errors: string): string {
    // Normalize absolute file paths (Windows and Unix formats)
    let normalized = errors.replace(/[a-zA-Z]:[\\\/][^:\s]+/g, '[path]')
    normalized = normalized.replace(/\/[^:\s]+/g, '[path]')
    // Normalize line and column numbers
    normalized = normalized.replace(/:\d+:\d+/g, ':[line]:[col]')
    normalized = normalized.replace(/\(\d+,\d+\)/g, '([line],[col])')
    // Remove specific dynamic stack traces/memory locations
    normalized = normalized.replace(/0x[0-9a-fA-F]+/g, '0x[hex]')
    return normalized.trim()
}
