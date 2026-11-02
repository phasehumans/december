import { THEME } from '../../theme'
import { parseTuiError } from '../../utils/error-parser'
import { toRelativePath } from '../../utils/terminal-link'
import { extractThoughtTopic } from '../../utils/thought'

import { formatMarkdownToLines, type FormattedLine } from './markdown'

import type { MessageItem } from './message-list-view'

export type DiscoveryKind = 'read' | 'list_dir' | 'search' | 'web_search'

export function getToolDiscoveryKind(toolName: string, command?: string): DiscoveryKind | null {
    const nameLower = (toolName || '').toLowerCase()
    if (nameLower === 'read_file' || nameLower === 'view_file' || command?.startsWith('Read(')) {
        return 'read'
    }
    if (nameLower === 'list_dir' || nameLower === 'ls' || command?.startsWith('ListDir(')) {
        return 'list_dir'
    }
    if (
        nameLower === 'grep_search' ||
        nameLower === 'find_files' ||
        nameLower === 'file_search' ||
        nameLower === 'code_intelligence' ||
        command?.startsWith('Search(') ||
        command?.startsWith('CodeIntel(')
    ) {
        return 'search'
    }
    if (
        nameLower === 'search_web' ||
        nameLower === 'web_search' ||
        command?.startsWith('WebSearch(')
    ) {
        return 'web_search'
    }
    return null
}

export function parseToolInput(input: any): any {
    if (typeof input === 'string') {
        try {
            return JSON.parse(input)
        } catch {
            // Intentionally swallowed: fallback to empty object on invalid JSON
            return {}
        }
    }
    return input && typeof input === 'object' ? input : {}
}

export function getDiscoveryTarget(
    kind: DiscoveryKind,
    tc: { name?: string; command?: string; input?: any }
): string {
    const input = parseToolInput(tc.input)
    switch (kind) {
        case 'read': {
            const rawPath =
                input.TargetFile ||
                input.AbsolutePath ||
                input.filePath ||
                input.filepath ||
                input.path ||
                input.file ||
                tc.command?.match(/^Read\(([^)]*)\)$/)?.[1] ||
                ''
            return toRelativePath(rawPath)
        }
        case 'list_dir': {
            const rawPath =
                input.DirectoryPath ||
                input.dirPath ||
                input.path ||
                tc.command?.match(/^ListDir\(([^)]*)\)$/)?.[1] ||
                ''
            return toRelativePath(rawPath) || '.'
        }
        case 'search': {
            const query =
                input.query ||
                input.pattern ||
                input.symbol ||
                tc.command?.match(/^(?:Search|CodeIntel)\(([^)]*)\)$/)?.[1] ||
                ''
            return query
        }
        case 'web_search': {
            const query =
                input.query ||
                input.Url ||
                input.url ||
                tc.command?.match(/^WebSearch\(([^)]*)\)$/)?.[1] ||
                ''
            return query
        }
    }
}

interface CacheEntry {
    contentKey: string
    width: number
    lines: FormattedLine[]
}

export class MessageLineCache {
    private messageCache = new WeakMap<MessageItem, CacheEntry>()
    private lastAggregateMessages: MessageItem[] | null = null
    private lastAggregateLength = 0
    private lastAggregateLastKey = ''
    private lastAggregateWidth = 0
    private lastAggregateSpinner = ''
    private lastAggregateExpandTools = false
    private lastAggregateResult: FormattedLine[] | null = null

    /**
     * Clears all cached lines.
     */
    clear(): void {
        this.messageCache = new WeakMap<MessageItem, CacheEntry>()
        this.lastAggregateMessages = null
        this.lastAggregateLength = 0
        this.lastAggregateLastKey = ''
        this.lastAggregateExpandTools = false
        this.lastAggregateResult = null
    }

    private computeContentKey(
        msg: MessageItem,
        expandTools = false,
        trailingSpacing = true
    ): string {
        const text = msg.content || msg.text || ''
        const toolStatus = msg.toolCall?.status || ''
        const toolOutput = msg.toolCall?.output || ''
        const toolCommand = msg.toolCall?.command || ''
        const toolDuration = msg.toolCall?.durationMs ?? (msg as any).durationMs ?? ''
        const toolInput =
            typeof msg.toolCall?.input === 'string'
                ? msg.toolCall?.input
                : JSON.stringify(msg.toolCall?.input || '')
        const isStreaming = Boolean(msg.isStreaming)
        const isExpanded = Boolean(expandTools)
        return `${msg.role}|${text}|${toolStatus}|${toolCommand}|${toolDuration}|${toolInput.slice(0, 50)}|${toolOutput.slice(-100)}|${isStreaming}|${isExpanded}|${trailingSpacing}`
    }

    /**
     * Formats a consolidated group of consecutive discovery tool calls.
     */
    formatDiscoveryGroup(
        kind: DiscoveryKind,
        group: MessageItem[],
        width: number,
        spinnerGlyph = '⠋ ',
        expandTools = false,
        trailingSpacing = true
    ): FormattedLine[] {
        const lines: FormattedLine[] = []
        const targets = group.map((m) => getDiscoveryTarget(kind, m.toolCall || {}))
        const count = targets.length
        const isRunning = group.some((m) => m.toolCall?.status === 'running')
        const isError = group.some(
            (m) => m.toolCall?.status === 'error' || (m.toolCall as any)?.status === 'failed'
        )
        const glyph = isRunning ? spinnerGlyph : '● '
        const glyphColor = isError ? THEME.colors.error : THEME.colors.warning

        const totalDurMs = group.reduce(
            (sum, m) => sum + (m.toolCall?.durationMs ?? (m as any).durationMs ?? 0),
            0
        )
        const durStr =
            totalDurMs > 0
                ? totalDurMs >= 1000
                    ? `${(totalDurMs / 1000).toFixed(1)}s`
                    : `${totalDurMs}ms`
                : ''

        let label = 'Read'
        let unit = 'files'
        if (kind === 'list_dir') {
            label = 'ListDir'
            unit = 'directories'
        } else if (kind === 'search') {
            label = 'Search'
            unit = 'queries'
        } else if (kind === 'web_search') {
            label = 'WebSearch'
            unit = 'queries'
        }

        if (!expandTools) {
            let inlineArgs = ''
            if (count === 2) {
                inlineArgs = `${targets[0]}, ${targets[1]}`
            } else if (count > 2) {
                inlineArgs = `${targets[0]}, ${targets[1]}, +${count - 2} more`
            } else {
                inlineArgs = targets[0] || ''
            }

            lines.push([
                { text: glyph, style: { fg: glyphColor } },
                { text: label, style: { fg: THEME.colors.warning, bold: true } },
                { text: `(${inlineArgs})`, style: { fg: THEME.colors.muted } },
                ...(durStr ? [{ text: ` (${durStr})`, style: { fg: THEME.colors.muted } }] : []),
            ])
        } else {
            lines.push([
                { text: glyph, style: { fg: glyphColor } },
                { text: label, style: { fg: THEME.colors.warning, bold: true } },
                { text: `(${count} ${unit})`, style: { fg: THEME.colors.muted } },
                { text: ' (ctrl+o to collapse)', style: { fg: THEME.colors.dim } },
            ])
            for (const item of group) {
                const itemTarget = getDiscoveryTarget(kind, item.toolCall || {})
                const itemDurMs = item.toolCall?.durationMs ?? (item as any).durationMs
                const itemDur =
                    itemDurMs !== undefined && itemDurMs > 0
                        ? itemDurMs >= 1000
                            ? `${(itemDurMs / 1000).toFixed(1)}s`
                            : `${itemDurMs}ms`
                        : ''
                const itemError =
                    item.toolCall?.status === 'error' || (item.toolCall as any)?.status === 'failed'
                const itemGlyphColor = itemError ? THEME.colors.error : THEME.colors.warning
                lines.push([
                    { text: '  ● ', style: { fg: itemGlyphColor } },
                    { text: itemTarget, style: { fg: THEME.colors.muted } },
                    ...(itemDur
                        ? [{ text: ` (${itemDur})`, style: { fg: THEME.colors.dim } }]
                        : []),
                ])
            }
        }

        if (trailingSpacing) {
            lines.push([{ text: '', style: {} }])
        }

        return lines
    }

    /**
     * Formats and caches lines for a single message.
     */
    getMessageLines(
        msg: MessageItem,
        width: number,
        spinnerGlyph = '⠋ ',
        expandTools = false,
        trailingSpacing = true
    ): FormattedLine[] {
        const contentKey = this.computeContentKey(msg, expandTools, trailingSpacing)
        const cached = this.messageCache.get(msg)

        // For non-streaming messages or stable tools, return from cache if key and width match
        if (
            cached &&
            cached.width === width &&
            cached.contentKey === contentKey &&
            !msg.isStreaming &&
            msg.toolCall?.status !== 'running'
        ) {
            return cached.lines
        }

        const lines: FormattedLine[] = []

        if (msg.role === 'user') {
            const text = msg.content || msg.text || ''
            lines.push([
                { text: '❭ ', style: { fg: THEME.colors.brand, bold: true } },
                { text, style: { fg: THEME.colors.brand, bold: true } },
            ])
            lines.push([{ text: '', style: {} }])
        } else if (msg.role === 'tool' || msg.toolCall) {
            const tc = msg.toolCall || {
                id: '',
                name: 'tool',
                command: msg.content,
                status: 'success' as const,
            }
            const isRunning = tc.status === 'running'
            const isError = tc.status === 'error' || (tc as any).status === 'failed'
            const glyph = isRunning ? spinnerGlyph : '● '
            const glyphColor = isError ? THEME.colors.error : THEME.colors.warning
            const toolNameLower = (tc.name || '').toLowerCase()

            const parsedInput = parseToolInput(tc.input)

            const isEditTool =
                toolNameLower === 'edit_file' ||
                toolNameLower === 'replace_file_content' ||
                toolNameLower === 'edit_diff' ||
                toolNameLower === 'multi_replace_file_content'
            const isWriteTool = toolNameLower === 'write_file' || toolNameLower === 'write_to_file'
            const isSubagentTool =
                toolNameLower === 'invoke_subagent' ||
                toolNameLower === 'spawn_subagent' ||
                tc.command?.startsWith('SubAgent(')

            const durationMs = tc.durationMs ?? (msg as any).durationMs
            const durStr =
                durationMs !== undefined && durationMs > 0
                    ? durationMs >= 1000
                        ? `${(durationMs / 1000).toFixed(1)}s`
                        : `${durationMs}ms`
                    : ''

            if (isEditTool || tc.command?.startsWith('Edit(')) {
                const rawPath =
                    parsedInput.TargetFile ||
                    parsedInput.AbsolutePath ||
                    parsedInput.filePath ||
                    parsedInput.filepath ||
                    parsedInput.path ||
                    parsedInput.file ||
                    tc.command?.match(/^Edit\(([^)]*)\)$/)?.[1] ||
                    ''
                const cleanPath = toRelativePath(rawPath)
                const target =
                    parsedInput.Target ??
                    parsedInput.target ??
                    parsedInput.TargetContent ??
                    parsedInput.targetContent ??
                    ''
                const replacement =
                    parsedInput.Replacement ??
                    parsedInput.replacement ??
                    parsedInput.ReplacementContent ??
                    parsedInput.replacementContent ??
                    ''

                let stats = ''
                if (target || replacement) {
                    const additions = replacement ? replacement.split(/\r?\n/).length : 0
                    const deletions = target ? target.split(/\r?\n/).length : 0
                    const parts: string[] = []
                    if (additions > 0) parts.push(`+${additions}`)
                    if (deletions > 0) parts.push(`-${deletions}`)
                    if (parts.length > 0) stats = ` (${parts.join(', ')})`
                }

                lines.push([
                    { text: glyph, style: { fg: glyphColor } },
                    { text: 'Edited ', style: { fg: THEME.colors.warning, bold: true } },
                    { text: cleanPath, style: { fg: THEME.colors.text } },
                    ...(stats ? [{ text: stats, style: { fg: THEME.colors.muted } }] : []),
                    ...(durStr
                        ? [{ text: ` (${durStr})`, style: { fg: THEME.colors.muted } }]
                        : []),
                    ...(expandTools
                        ? [{ text: ' (ctrl+o to collapse)', style: { fg: THEME.colors.dim } }]
                        : []),
                ])

                // Render actual unified git diff on expand
                if (expandTools) {
                    if (target || replacement) {
                        const targetLines = target ? target.split(/\r?\n/) : []
                        const replacementLines = replacement ? replacement.split(/\r?\n/) : []
                        const maxDiff = 30
                        let displayed = 0

                        for (const tLine of targetLines) {
                            if (displayed >= maxDiff) break
                            lines.push([
                                { text: '  - │ ', style: { fg: THEME.colors.error } },
                                { text: tLine, style: { fg: THEME.colors.error } },
                            ])
                            displayed++
                        }
                        for (const rLine of replacementLines) {
                            if (displayed >= maxDiff) break
                            lines.push([
                                { text: '  + │ ', style: { fg: THEME.colors.success } },
                                { text: rLine, style: { fg: THEME.colors.success } },
                            ])
                            displayed++
                        }
                        const totalDiffLines = targetLines.length + replacementLines.length
                        if (totalDiffLines > maxDiff) {
                            lines.push([
                                { text: '    │ ', style: { fg: THEME.colors.border } },
                                {
                                    text: `... (${totalDiffLines - maxDiff} more lines · Ctrl+O to collapse)`,
                                    style: { fg: THEME.colors.dim },
                                },
                            ])
                        }
                    } else if (
                        tc.output &&
                        (tc.output.includes('@@') ||
                            tc.output.includes('+') ||
                            tc.output.includes('-'))
                    ) {
                        const outLines = tc.output.trim().split(/\r?\n/)
                        const maxDiff = 30
                        for (let l = 0; l < Math.min(outLines.length, maxDiff); l++) {
                            const line = outLines[l] || ''
                            if (line.startsWith('+') && !line.startsWith('+++')) {
                                lines.push([
                                    { text: '  + │ ', style: { fg: THEME.colors.success } },
                                    { text: line.slice(1), style: { fg: THEME.colors.success } },
                                ])
                            } else if (line.startsWith('-') && !line.startsWith('---')) {
                                lines.push([
                                    { text: '  - │ ', style: { fg: THEME.colors.error } },
                                    { text: line.slice(1), style: { fg: THEME.colors.error } },
                                ])
                            } else if (line.startsWith('@@')) {
                                lines.push([
                                    { text: '  ~ │ ', style: { fg: THEME.colors.dim } },
                                    { text: line, style: { fg: THEME.colors.dim } },
                                ])
                            } else {
                                lines.push([
                                    { text: '    │ ', style: { fg: THEME.colors.border } },
                                    {
                                        text: line.startsWith(' ') ? line.slice(1) : line,
                                        style: { fg: THEME.colors.muted },
                                    },
                                ])
                            }
                        }
                        if (outLines.length > maxDiff) {
                            lines.push([
                                { text: '    │ ', style: { fg: THEME.colors.border } },
                                {
                                    text: `... (${outLines.length - maxDiff} more lines · Ctrl+O to collapse)`,
                                    style: { fg: THEME.colors.dim },
                                },
                            ])
                        }
                    }
                }
            } else if (isWriteTool || tc.command?.startsWith('Create(')) {
                const rawPath =
                    parsedInput.TargetFile ||
                    parsedInput.AbsolutePath ||
                    parsedInput.filePath ||
                    parsedInput.filepath ||
                    parsedInput.path ||
                    parsedInput.file ||
                    tc.command?.match(/^Create\(([^)]*)\)$/)?.[1] ||
                    ''
                const cleanPath = toRelativePath(rawPath)
                const content = parsedInput.Content ?? parsedInput.content ?? parsedInput.code ?? ''
                const lineCount = content ? content.split(/\r?\n/).length : 0
                const stats = lineCount > 0 ? ` (${lineCount} lines)` : ''

                lines.push([
                    { text: glyph, style: { fg: glyphColor } },
                    { text: 'Created ', style: { fg: THEME.colors.warning, bold: true } },
                    { text: cleanPath, style: { fg: THEME.colors.text } },
                    ...(stats ? [{ text: stats, style: { fg: THEME.colors.muted } }] : []),
                    ...(durStr
                        ? [{ text: ` (${durStr})`, style: { fg: THEME.colors.muted } }]
                        : []),
                    ...(expandTools
                        ? [{ text: ' (ctrl+o to collapse)', style: { fg: THEME.colors.dim } }]
                        : []),
                ])

                if (expandTools && content) {
                    const contentLines = content.split(/\r?\n/)
                    const maxLines = 30
                    for (let l = 0; l < Math.min(contentLines.length, maxLines); l++) {
                        lines.push([
                            { text: '  + │ ', style: { fg: THEME.colors.success } },
                            { text: contentLines[l] || '', style: { fg: THEME.colors.success } },
                        ])
                    }
                    if (contentLines.length > maxLines) {
                        lines.push([
                            { text: '    │ ', style: { fg: THEME.colors.border } },
                            {
                                text: `... (${contentLines.length - maxLines} more lines · Ctrl+O to collapse)`,
                                style: { fg: THEME.colors.dim },
                            },
                        ])
                    }
                }
            } else if (isSubagentTool) {
                const role =
                    parsedInput.role ||
                    parsedInput.Role ||
                    tc.command?.match(/^SubAgent\(([^)]*)\)$/)?.[1] ||
                    'subagent'

                if (isRunning) {
                    // Running subagent live ticker
                    const outText = tc.output || ''
                    const rawLines = outText.trim().split(/\r?\n/)
                    const lastRaw = rawLines[rawLines.length - 1] || ''
                    const cleanAction = lastRaw.replace(/^\[SubAgent:[^\]]+\]\s*/i, '').trim()

                    lines.push([
                        { text: glyph, style: { fg: glyphColor } },
                        { text: 'Subagent: ', style: { fg: THEME.colors.brand, bold: true } },
                        { text: role, style: { fg: THEME.colors.text, bold: true } },
                    ])
                    if (cleanAction) {
                        lines.push([
                            { text: '  ↳ ', style: { fg: THEME.colors.border } },
                            {
                                text: cleanAction.slice(0, Math.max(30, width - 8)),
                                style: { fg: THEME.colors.muted },
                            },
                        ])
                    }
                } else {
                    // Completed subagent with rollup report
                    const outText = tc.output || ''
                    const turnsMatch = outText.match(
                        /(?:Total Turns\*\*:\s*(\d+)|\((\d+)\s*turns)/i
                    )
                    const turns = turnsMatch ? turnsMatch[1] || turnsMatch[2] : ''
                    const toolsMatch = outText.match(
                        /(?:Tool Calls\*\*:\s*(\d+)|,\s*(\d+)\s*tool(?:s|\s*calls)?)/i
                    )
                    const tools = toolsMatch ? toolsMatch[1] || toolsMatch[2] : ''

                    let statsText = ''
                    if (turns && tools) {
                        statsText = ` (${turns} turns, ${tools} tools${durStr ? `, ${durStr}` : ''})`
                    } else if (turns) {
                        statsText = ` (${turns} turns${durStr ? `, ${durStr}` : ''})`
                    } else if (durStr) {
                        statsText = ` (${durStr})`
                    }

                    lines.push([
                        { text: glyph, style: { fg: glyphColor } },
                        { text: 'Subagent: ', style: { fg: THEME.colors.brand, bold: true } },
                        { text: role, style: { fg: THEME.colors.text, bold: true } },
                        ...(statsText
                            ? [{ text: statsText, style: { fg: THEME.colors.muted } }]
                            : []),
                        ...(expandTools
                            ? [{ text: ' (ctrl+o to collapse)', style: { fg: THEME.colors.dim } }]
                            : [{ text: ' (ctrl+o to expand)', style: { fg: THEME.colors.dim } }]),
                    ])

                    if (expandTools) {
                        const findingsMatch = outText.match(
                            /#### Rollup Summary & Findings:\s*([\s\S]*)$/i
                        )
                        const summaryText = findingsMatch ? findingsMatch[1].trim() : outText.trim()
                        if (summaryText) {
                            const summaryLines = summaryText.split(/\r?\n/)
                            const maxLines = 30
                            for (let l = 0; l < Math.min(summaryLines.length, maxLines); l++) {
                                lines.push([
                                    { text: '  │ ', style: { fg: THEME.colors.border } },
                                    {
                                        text: summaryLines[l] || '',
                                        style: { fg: THEME.colors.muted },
                                    },
                                ])
                            }
                            if (summaryLines.length > maxLines) {
                                lines.push([
                                    { text: '  │ ', style: { fg: THEME.colors.border } },
                                    {
                                        text: `... (${summaryLines.length - maxLines} more lines · Ctrl+O to collapse)`,
                                        style: { fg: THEME.colors.dim },
                                    },
                                ])
                            }
                        }
                    }
                }
            } else {
                const cmdStr = tc.command || `${tc.name}()`
                const match = cmdStr.match(/^([A-Za-z0-9_]+)\(([\s\S]*)\)$/)
                if (match) {
                    const fnName = match[1]
                    const args = match[2]
                    lines.push([
                        { text: glyph, style: { fg: glyphColor } },
                        { text: fnName, style: { fg: THEME.colors.warning, bold: true } },
                        { text: `(${args})`, style: { fg: THEME.colors.muted } },
                        ...(durStr
                            ? [{ text: ` (${durStr})`, style: { fg: THEME.colors.muted } }]
                            : []),
                    ])
                } else {
                    lines.push([
                        { text: glyph, style: { fg: glyphColor } },
                        { text: cmdStr, style: { fg: THEME.colors.warning, bold: true } },
                        ...(durStr
                            ? [{ text: ` (${durStr})`, style: { fg: THEME.colors.muted } }]
                            : []),
                    ])
                }
            }

            // Background task indicator check
            const bgMatch = tc.output
                ? tc.output.match(
                      /(?:\[Moved to background task:\s*|\[Auto-Backgrounded\]\s*Task ID:\s*)([A-Za-z0-9_-]+)/i
                  )
                : null

            if (bgMatch) {
                const bgTaskId = bgMatch[1]
                lines.push([
                    { text: '  ↳ ', style: { fg: THEME.colors.brand, bold: true } },
                    {
                        text: `Moved to background task: ${bgTaskId}`,
                        style: { fg: THEME.colors.brand },
                    },
                    { text: ' · Use /tasks to inspect', style: { fg: THEME.colors.muted } },
                ])
            }

            // Command / Tool Output Gutter
            if (isError && tc.output) {
                const toolErrLines = tc.output.trim().split(/\r?\n/)
                const maxLines = expandTools ? 30 : 5
                for (let l = 0; l < Math.min(toolErrLines.length, maxLines); l++) {
                    lines.push([
                        { text: '  │ ', style: { fg: THEME.colors.error } },
                        { text: toolErrLines[l] || '', style: { fg: THEME.colors.error } },
                    ])
                }
                if (toolErrLines.length > maxLines) {
                    lines.push([
                        { text: '  │ ', style: { fg: THEME.colors.error } },
                        {
                            text: `... (${toolErrLines.length - maxLines} more lines · Ctrl+O to expand)`,
                            style: { fg: THEME.colors.dim },
                        },
                    ])
                }
            } else if (tc.output && !bgMatch) {
                const isNoOutputTool =
                    toolNameLower === 'read_file' ||
                    toolNameLower === 'view_file' ||
                    toolNameLower === 'list_dir' ||
                    toolNameLower === 'ls' ||
                    toolNameLower === 'ask_permission' ||
                    toolNameLower === 'list_permissions' ||
                    isEditTool ||
                    isWriteTool ||
                    isSubagentTool ||
                    tc.command?.startsWith('Read(') ||
                    tc.command?.startsWith('ListDir(') ||
                    tc.command?.startsWith('Create(') ||
                    tc.command?.startsWith('Edit(') ||
                    tc.command?.startsWith('SubAgent(')

                if (!isNoOutputTool) {
                    const outLines = tc.output.trim().split(/\r?\n/)
                    if (outLines.length > 0 && outLines[0]) {
                        const maxLines = isRunning ? 3 : expandTools ? 35 : 5
                        const displayLines = isRunning
                            ? outLines.slice(-maxLines)
                            : outLines.slice(0, maxLines)
                        for (const line of displayLines) {
                            lines.push([
                                { text: '  │ ', style: { fg: THEME.colors.border } },
                                { text: line, style: { fg: THEME.colors.muted } },
                            ])
                        }
                        if (!isRunning && outLines.length > maxLines) {
                            lines.push([
                                { text: '  │ ', style: { fg: THEME.colors.border } },
                                {
                                    text: `... (${outLines.length - maxLines} more lines · Ctrl+O to toggle)`,
                                    style: { fg: THEME.colors.dim },
                                },
                            ])
                        }
                    }
                }
            }

            if (trailingSpacing) {
                lines.push([{ text: '', style: {} }])
            }
        } else if (msg.role === 'thinking') {
            if (msg.isStreaming && msg.content) {
                const topic = extractThoughtTopic(msg.content)
                const label = topic ? `Thinking... ${topic}` : 'Thinking...'
                lines.push([
                    { text: spinnerGlyph, style: { fg: THEME.colors.muted } },
                    {
                        text: label,
                        style: { fg: THEME.colors.muted },
                    },
                ])
                lines.push([{ text: '', style: {} }])
            }
        } else if (msg.role === 'assistant') {
            const text = msg.content || msg.text || ''
            const formatted = formatMarkdownToLines(text, width - 2)
            lines.push(...formatted)
            lines.push([{ text: '', style: {} }])
        } else if (msg.role === 'error') {
            const rawText = msg.content || msg.text || ''
            const parsed = parseTuiError(rawText, (msg as any).cause, (msg as any).hint)

            const errorFormatted = formatMarkdownToLines(`**Error:** ${parsed.message}`, width - 2)
            for (const line of errorFormatted) {
                for (const seg of line) {
                    seg.style = { ...seg.style, fg: THEME.colors.error, bold: true }
                }
            }
            lines.push(...errorFormatted)

            if (parsed.cause) {
                const causeFormatted = formatMarkdownToLines(`Cause: ${parsed.cause}`, width - 4)
                for (const line of causeFormatted) {
                    line.unshift({ text: '  ', style: {} })
                    for (const seg of line) {
                        if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                    }
                }
                lines.push(...causeFormatted)
            }

            if (parsed.hint) {
                const hintFormatted = formatMarkdownToLines(parsed.hint, width - 4)
                for (const line of hintFormatted) {
                    line.unshift({ text: '  ', style: {} })
                    for (const seg of line) {
                        if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                    }
                }
                lines.push(...hintFormatted)
            }

            lines.push([{ text: '', style: {} }])
        }

        this.messageCache.set(msg, {
            contentKey,
            width,
            lines,
        })

        return lines
    }

    /**
     * Returns the aggregated formatted lines for all messages.
     * Consolidates consecutive discovery blocks (Read, ListDir, Search, WebSearch)
     * and stacks adjacent tool calls with compact vertical spacing.
     */
    getLines(
        messages: MessageItem[],
        width: number,
        options?: { spinnerGlyph?: string; expandTools?: boolean }
    ): FormattedLine[] {
        const spinner = options?.spinnerGlyph || '⠋ '
        const expandTools = Boolean(options?.expandTools)

        // Check if any message is actively streaming or running
        const hasLiveActivity = messages.some(
            (m) => m.isStreaming || m.toolCall?.status === 'running'
        )

        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
        const lastKey = lastMsg ? this.computeContentKey(lastMsg, expandTools) : ''

        if (
            !hasLiveActivity &&
            this.lastAggregateResult &&
            this.lastAggregateMessages === messages &&
            this.lastAggregateLength === messages.length &&
            this.lastAggregateLastKey === lastKey &&
            this.lastAggregateWidth === width &&
            this.lastAggregateExpandTools === expandTools
        ) {
            return this.lastAggregateResult
        }

        const allLines: FormattedLine[] = []
        let i = 0

        while (i < messages.length) {
            const msg = messages[i]
            if (!msg) {
                i++
                continue
            }

            const isTool = msg.role === 'tool' || Boolean(msg.toolCall)
            const kind = isTool
                ? getToolDiscoveryKind(msg.toolCall?.name || '', msg.toolCall?.command)
                : null

            if (kind) {
                // Check for consecutive discovery tools of the same kind
                let j = i + 1
                while (j < messages.length) {
                    const nextMsg = messages[j]
                    const nextIsTool = Boolean(
                        nextMsg && (nextMsg.role === 'tool' || nextMsg.toolCall)
                    )
                    const nextKind = nextIsTool
                        ? getToolDiscoveryKind(
                              nextMsg?.toolCall?.name || '',
                              nextMsg?.toolCall?.command
                          )
                        : null
                    if (nextKind === kind) {
                        j++
                    } else {
                        break
                    }
                }

                if (j - i >= 2) {
                    // Group of 2 or more discovery calls
                    const nextAfterGroupIsTool =
                        j < messages.length &&
                        Boolean(messages[j]?.role === 'tool' || messages[j]?.toolCall)
                    const groupLines = this.formatDiscoveryGroup(
                        kind,
                        messages.slice(i, j),
                        width,
                        spinner,
                        expandTools,
                        !nextAfterGroupIsTool
                    )
                    allLines.push(...groupLines)
                    i = j
                    continue
                }
            }

            // Single message (tool or non-tool)
            if (isTool) {
                const nextIsTool =
                    i + 1 < messages.length &&
                    Boolean(messages[i + 1]?.role === 'tool' || messages[i + 1]?.toolCall)
                allLines.push(
                    ...this.getMessageLines(msg, width, spinner, expandTools, !nextIsTool)
                )
            } else {
                allLines.push(...this.getMessageLines(msg, width, spinner, expandTools, true))
            }

            i++
        }

        if (!hasLiveActivity) {
            this.lastAggregateMessages = messages
            this.lastAggregateLength = messages.length
            this.lastAggregateLastKey = lastKey
            this.lastAggregateWidth = width
            this.lastAggregateSpinner = spinner
            this.lastAggregateExpandTools = expandTools
            this.lastAggregateResult = allLines
        } else {
            this.lastAggregateResult = null
        }

        return allLines
    }
}
