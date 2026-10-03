import path from 'node:path'

import { Tool, ToolExecuteContext } from '@december/shared'
import { Type, Static } from '@sinclair/typebox'

const manageMemorySchema = Type.Object({
    action: Type.Union([Type.Literal('record'), Type.Literal('read'), Type.Literal('forget')], {
        description:
            'The action to perform: "record" to store an entry, "read" to inspect entries, or "forget" to prune an entry.',
    }),
    entry: Type.Optional(
        Type.String({
            description: 'The memory or rule entry text to record or forget.',
        })
    ),
    category: Type.Optional(
        Type.Union(
            [
                Type.Literal('build_and_test'),
                Type.Literal('conventions'),
                Type.Literal('architecture'),
                Type.Literal('quirks'),
                Type.Literal('rules'),
                Type.Literal('general'),
            ],
            {
                description:
                    'Category header: build_and_test, conventions, architecture, quirks, rules, or general.',
            }
        )
    ),
    target: Type.Optional(
        Type.Union(
            [
                Type.Literal('memory'),
                Type.Literal('rules'),
                Type.Literal('MEMORY.md'),
                Type.Literal('RULES.md'),
            ],
            {
                description:
                    'Target file: "memory" (.december/memory.md or MEMORY.md) or "rules" (RULES.md or .december/rules.md). Defaults to memory for general/memory entries, or rules if category is "rules".',
            }
        )
    ),
    query: Type.Optional(
        Type.String({
            description: 'Optional query keyword to filter entries when reading.',
        })
    ),
})

export type ManageMemoryInput = Static<typeof manageMemorySchema>

function resolveWriteTarget(
    cwd: string,
    target?: string,
    category?: string
): { relativePath: string; isRules: boolean } {
    const isRules = target === 'rules' || target === 'RULES.md' || (!target && category === 'rules')

    if (isRules) {
        if (target === 'RULES.md') {
            return { relativePath: 'RULES.md', isRules: true }
        }
        return { relativePath: 'RULES.md', isRules: true }
    }

    if (target === 'MEMORY.md') {
        return { relativePath: 'MEMORY.md', isRules: false }
    }

    return { relativePath: path.join('.december', 'memory.md'), isRules: false }
}

function resolveReadCandidates(target?: string): string[] {
    if (target === 'rules' || target === 'RULES.md') {
        return ['RULES.md', path.join('.december', 'rules.md'), path.join('.december', 'RULES.md')]
    }
    if (target === 'memory' || target === 'MEMORY.md') {
        return [
            path.join('.december', 'memory.md'),
            'MEMORY.md',
            path.join('.december', 'MEMORY.md'),
        ]
    }
    return [
        path.join('.december', 'memory.md'),
        'MEMORY.md',
        'RULES.md',
        path.join('.december', 'rules.md'),
    ]
}

function normalizeEntry(text: string): string {
    return text.replace(/^[-*•]\s+/, '').trim()
}

export const ManageMemoryTool: Tool<ManageMemoryInput> = {
    name: 'manage_memory',
    description:
        'Use this tool to record, read, or forget persistent notes, conventions, build/test commands, quirks, and rules across sessions in workspace memory (.december/memory.md, MEMORY.md, RULES.md).',
    inputSchema: manageMemorySchema,
    execute: async (
        { action, entry, category, target, query },
        context: ToolExecuteContext
    ): Promise<string> => {
        const cwd = context.operations.env.cwd()

        switch (action) {
            case 'record': {
                if (!entry || !entry.trim()) {
                    return 'Error: "entry" parameter is required for action "record".'
                }

                const cleanEntry = normalizeEntry(entry)
                if (!cleanEntry) {
                    return 'Error: "entry" parameter cannot be empty.'
                }

                const { relativePath, isRules } = resolveWriteTarget(cwd, target, category)
                const fullPath = path.isAbsolute(relativePath)
                    ? relativePath
                    : path.join(cwd, relativePath)
                const cat = category || (isRules ? 'rules' : 'conventions')

                let existingContent = ''
                try {
                    existingContent = await context.operations.fs.readFile(fullPath)
                } catch {
                    // Intentionally swallowed: target memory file does not exist yet
                }

                // Check for duplicate entries
                const lines = existingContent.split('\n')
                for (const line of lines) {
                    const lineContent = normalizeEntry(line)
                    if (lineContent && lineContent.toLowerCase() === cleanEntry.toLowerCase()) {
                        return `Entry already exists in ${relativePath} under "${cat}". Skipped duplicate.`
                    }
                }

                // Append under existing category header or add new header
                const headerRegex = new RegExp(`^##\\s+${cat}\\b`, 'im')
                const headerMatch = existingContent.match(headerRegex)

                let updatedContent = ''
                if (headerMatch && headerMatch.index !== undefined) {
                    const headerIndex = headerMatch.index
                    const rest = existingContent.slice(headerIndex)
                    const nextHeaderMatch = rest.slice(headerMatch[0].length).match(/\n##\s+/i)

                    if (nextHeaderMatch && nextHeaderMatch.index !== undefined) {
                        const insertPos =
                            headerIndex + headerMatch[0].length + nextHeaderMatch.index
                        updatedContent = `${existingContent.slice(0, insertPos)}\n- ${cleanEntry}${existingContent.slice(insertPos)}`
                    } else {
                        updatedContent = `${existingContent.trimEnd()}\n- ${cleanEntry}\n`
                    }
                } else {
                    const prefix = existingContent.trim() ? `${existingContent.trimEnd()}\n\n` : ''
                    updatedContent = `${prefix}## ${cat}\n- ${cleanEntry}\n`
                }

                try {
                    await context.operations.fs.writeFile(fullPath, updatedContent)
                    return `Recorded entry under "${cat}" in ${relativePath}.`
                } catch (err: any) {
                    return `Failed to write memory file: ${err.message}`
                }
            }

            case 'read': {
                const candidates = resolveReadCandidates(target)
                const contents: { file: string; text: string }[] = []

                for (const candidate of candidates) {
                    const fullPath = path.isAbsolute(candidate)
                        ? candidate
                        : path.join(cwd, candidate)
                    try {
                        const text = await context.operations.fs.readFile(fullPath)
                        if (text && text.trim()) {
                            contents.push({ file: candidate, text: text.trim() })
                        }
                    } catch {
                        // Intentionally swallowed: missing candidate file handled gracefully
                    }
                }

                if (contents.length === 0) {
                    return 'No memory or rules entries found.'
                }

                // If filtering by category
                if (category) {
                    const matchedSections: string[] = []
                    const catLower = category.toLowerCase()

                    for (const item of contents) {
                        const lines = item.text.split('\n')
                        let inCategory = false
                        const sectionLines: string[] = []

                        for (const line of lines) {
                            if (line.startsWith('## ')) {
                                const headerName = line.slice(3).trim().toLowerCase()
                                if (headerName === catLower) {
                                    inCategory = true
                                    sectionLines.push(line)
                                } else {
                                    inCategory = false
                                }
                            } else if (inCategory) {
                                sectionLines.push(line)
                            }
                        }

                        if (sectionLines.length > 0) {
                            matchedSections.push(
                                `### Source: ${item.file}\n${sectionLines.join('\n').trim()}`
                            )
                        }
                    }

                    if (matchedSections.length === 0) {
                        return `No entries found under category "${category}".`
                    }
                    return matchedSections.join('\n\n')
                }

                // If filtering by query keyword
                if (query) {
                    const queryLower = query.toLowerCase()
                    const matchedLines: string[] = []

                    for (const item of contents) {
                        const lines = item.text.split('\n')
                        let currentHeader = ''
                        const fileMatches: string[] = []

                        for (const line of lines) {
                            if (line.startsWith('## ')) {
                                currentHeader = line
                            } else if (line.toLowerCase().includes(queryLower)) {
                                if (currentHeader && !fileMatches.includes(currentHeader)) {
                                    fileMatches.push(currentHeader)
                                }
                                fileMatches.push(line)
                            }
                        }

                        if (fileMatches.length > 0) {
                            matchedLines.push(`### Source: ${item.file}\n${fileMatches.join('\n')}`)
                        }
                    }

                    if (matchedLines.length === 0) {
                        return `No memory entries found matching "${query}".`
                    }
                    return matchedLines.join('\n\n')
                }

                return contents.map((c) => `### Source: ${c.file}\n${c.text}`).join('\n\n')
            }

            case 'forget': {
                if (!entry || !entry.trim()) {
                    return 'Error: "entry" parameter is required for action "forget".'
                }

                const targetClean = normalizeEntry(entry).toLowerCase()
                const candidates = resolveReadCandidates(target)
                let removed = false

                for (const candidate of candidates) {
                    const fullPath = path.isAbsolute(candidate)
                        ? candidate
                        : path.join(cwd, candidate)
                    try {
                        const text = await context.operations.fs.readFile(fullPath)
                        const lines = text.split('\n')
                        const newLines: string[] = []
                        let fileModified = false

                        for (const line of lines) {
                            const lineClean = normalizeEntry(line).toLowerCase()
                            if (
                                lineClean &&
                                (lineClean === targetClean || lineClean.includes(targetClean))
                            ) {
                                fileModified = true
                                removed = true
                                continue
                            }
                            newLines.push(line)
                        }

                        if (fileModified) {
                            await context.operations.fs.writeFile(
                                fullPath,
                                newLines.join('\n').trimEnd() + '\n'
                            )
                        }
                    } catch {
                        // Intentionally swallowed: missing candidate file handled gracefully
                    }
                }

                if (removed) {
                    return 'Removed entry from memory.'
                }
                return 'Entry not found in memory.'
            }

            default: {
                return 'Invalid action. Supported actions: record, read, forget.'
            }
        }
    },
}
