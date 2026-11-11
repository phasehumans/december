import { THEME } from '../../theme'
import { parseTuiError } from '../../utils/error-parser'
import { toRelativePath } from '../../utils/terminal-link'
import { extractThoughtTopic } from '../../utils/thought'

import {
    createStreamingMarkdownCache,
    formatMarkdownToLines,
    type FormattedLine,
    type StreamingMarkdownCache,
} from './markdown'

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

/**
 * Formats a single git diff line with unified gutter and theme background styling,
 * matching the visual design language of the `/diff` command view.
 */
export function formatDiffRow(
    type: 'add' | 'delete' | 'context' | 'hunk',
    content: string,
    width: number
): FormattedLine {
    const sign =
        type === 'add' ? '  + ' : type === 'delete' ? '  - ' : type === 'hunk' ? '  ~ ' : '    '
    const signColor =
        type === 'add'
            ? THEME.colors.success
            : type === 'delete'
              ? THEME.colors.error
              : type === 'hunk'
                ? THEME.colors.brand
                : THEME.colors.dim
    const textColor =
        type === 'add'
            ? THEME.colors.success
            : type === 'delete'
              ? THEME.colors.error
              : type === 'hunk'
                ? THEME.colors.dim
                : THEME.colors.muted
    const bgColor =
        type === 'add'
            ? THEME.colors.diffAddBg
            : type === 'delete'
              ? THEME.colors.diffDeleteBg
              : undefined

    const maxContentLen = Math.max(0, width - 5)
    const displayContent =
        content.length > maxContentLen ? content.slice(0, maxContentLen) : content
    const usedLen = sign.length + displayContent.length
    const padLen = bgColor ? Math.max(0, width - 1 - usedLen) : 0

    const tokens: FormattedLine = [
        {
            text: sign,
            style: {
                fg: signColor,
                bg: bgColor,
                bold: type === 'add' || type === 'delete',
            },
        },
        {
            text: displayContent,
            style: {
                fg: textColor,
                bg: bgColor,
            },
        },
    ]

    if (padLen > 0) {
        tokens.push({
            text: ' '.repeat(padLen),
            style: { bg: bgColor },
        })
    }

    return tokens
}

export function getToolActionVerb(name: string, isRunning: boolean): string {
    const lower = name.toLowerCase()
    if (isRunning) {
        if (lower === 'read_file' || lower === 'view_file' || lower === 'read') return 'Reading'
        if (lower === 'write_file' || lower === 'write_to_file' || lower === 'create_file') {
            return 'Writing'
        }
        if (
            lower === 'edit_file' ||
            lower === 'replace_file_content' ||
            lower === 'edit_diff' ||
            lower === 'multi_replace_file_content'
        ) {
            return 'Editing'
        }
        if (
            lower === 'run_command' ||
            lower === 'bash' ||
            lower === 'execute_command' ||
            lower === 'terminal'
        ) {
            return 'Executing'
        }
        if (lower === 'search_web' || lower === 'web_search') return 'Searching web'
        if (
            lower === 'search' ||
            lower === 'grep' ||
            lower === 'code_search' ||
            lower === 'find_by_name' ||
            lower === 'grep_search' ||
            lower === 'find_files'
        ) {
            return 'Searching'
        }
        if (lower === 'list_dir' || lower === 'ls') return 'Listing'
        return 'Running'
    } else {
        if (lower === 'read_file' || lower === 'view_file' || lower === 'read') return 'Read'
        if (lower === 'write_file' || lower === 'write_to_file' || lower === 'create_file') {
            return 'Created'
        }
        if (
            lower === 'edit_file' ||
            lower === 'replace_file_content' ||
            lower === 'edit_diff' ||
            lower === 'multi_replace_file_content'
        ) {
            return 'Edited'
        }
        if (
            lower === 'run_command' ||
            lower === 'bash' ||
            lower === 'execute_command' ||
            lower === 'terminal'
        ) {
            return 'Executed'
        }
        if (lower === 'search_web' || lower === 'web_search') return 'Searched web'
        if (
            lower === 'search' ||
            lower === 'grep' ||
            lower === 'code_search' ||
            lower === 'find_by_name' ||
            lower === 'grep_search' ||
            lower === 'find_files'
        ) {
            return 'Searched'
        }
        if (lower === 'list_dir' || lower === 'ls') return 'Listed'
        return name
    }
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
    private streamMarkdownCaches = new WeakMap<MessageItem, StreamingMarkdownCache>()
    private lastAggregateMessages: MessageItem[] | null = null
    private lastAggregateLength = 0
    private lastAggregateLastKey = ''
    private lastAggregateWidth = 0
    private lastAggregateSpinner = ''
    private lastAggregateExpandTools = false
    private lastAggregateResult: FormattedLine[] | null = null
    private lastPriorMessages: MessageItem[] | null = null
    private lastPriorLength = 0
    private lastPriorWidth = 0
    private lastPriorExpandTools = false
    private lastPriorResult: FormattedLine[] | null = null

    /**
     * Clears all cached lines.
     */
    clear(): void {
        this.messageCache = new WeakMap<MessageItem, CacheEntry>()
        this.streamMarkdownCaches = new WeakMap<MessageItem, StreamingMarkdownCache>()
        this.lastAggregateMessages = null
        this.lastAggregateLength = 0
        this.lastAggregateLastKey = ''
        this.lastAggregateExpandTools = false
        this.lastAggregateResult = null
        this.lastPriorMessages = null
        this.lastPriorLength = 0
        this.lastPriorWidth = 0
        this.lastPriorExpandTools = false
        this.lastPriorResult = null
    }

    private computeContentKey(
        msg: MessageItem,
        expandTools = false,
        trailingSpacing = true,
        tip?: string | null
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
        const tipStr = isStreaming && tip ? tip : ''
        return `${msg.role}|${text}|${toolStatus}|${toolCommand}|${toolDuration}|${toolInput.slice(0, 50)}|${toolOutput.slice(-100)}|${isStreaming}|${isExpanded}|${trailingSpacing}|${tipStr}`
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

        let label = isRunning ? 'Reading' : 'Read'
        let unit = 'files'
        if (kind === 'list_dir') {
            label = isRunning ? 'Listing' : 'ListDir'
            unit = 'directories'
        } else if (kind === 'search') {
            label = isRunning ? 'Searching' : 'Search'
            unit = 'queries'
        } else if (kind === 'web_search') {
            label = isRunning ? 'Searching web' : 'WebSearch'
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

        if (isError) {
            for (const item of group) {
                const itemError =
                    item.toolCall?.status === 'error' || (item.toolCall as any)?.status === 'failed'
                if (itemError && item.toolCall?.output) {
                    const itemTarget = getDiscoveryTarget(kind, item.toolCall || {})
                    const outLines = item.toolCall.output.trim().split(/\r?\n/)
                    const firstLine = outLines[0] || 'Execution failed'
                    lines.push([
                        { text: '  │ ', style: { fg: THEME.colors.error } },
                        {
                            text: itemTarget ? `${itemTarget}: ${firstLine}` : firstLine,
                            style: { fg: THEME.colors.error },
                        },
                    ])
                }
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
        trailingSpacing = true,
        tip?: string | null
    ): FormattedLine[] {
        const contentKey = this.computeContentKey(msg, expandTools, trailingSpacing, tip)
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

                const editVerb = isRunning ? 'Editing ' : isError ? 'Failed editing ' : 'Edited '
                lines.push([
                    { text: glyph, style: { fg: glyphColor } },
                    { text: editVerb, style: { fg: THEME.colors.warning, bold: true } },
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
                            lines.push(formatDiffRow('delete', tLine, width))
                            displayed++
                        }
                        for (const rLine of replacementLines) {
                            if (displayed >= maxDiff) break
                            lines.push(formatDiffRow('add', rLine, width))
                            displayed++
                        }
                        const totalDiffLines = targetLines.length + replacementLines.length
                        if (totalDiffLines > maxDiff) {
                            lines.push([
                                { text: '    ', style: { fg: THEME.colors.dim } },
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
                                lines.push(formatDiffRow('add', line.slice(1), width))
                            } else if (line.startsWith('-') && !line.startsWith('---')) {
                                lines.push(formatDiffRow('delete', line.slice(1), width))
                            } else if (line.startsWith('@@')) {
                                lines.push(formatDiffRow('hunk', line, width))
                            } else {
                                const cleanContext = line.startsWith(' ') ? line.slice(1) : line
                                lines.push(formatDiffRow('context', cleanContext, width))
                            }
                        }
                        if (outLines.length > maxDiff) {
                            lines.push([
                                { text: '    ', style: { fg: THEME.colors.dim } },
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

                const writeVerb = isRunning
                    ? 'Creating '
                    : isError
                      ? 'Failed creating '
                      : 'Created '
                lines.push([
                    { text: glyph, style: { fg: glyphColor } },
                    { text: writeVerb, style: { fg: THEME.colors.warning, bold: true } },
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
                        lines.push(formatDiffRow('add', contentLines[l] || '', width))
                    }
                    if (contentLines.length > maxLines) {
                        lines.push([
                            { text: '    ', style: { fg: THEME.colors.dim } },
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
                    const fnName = match[1]!
                    const args = match[2]
                    const displayLabel = isRunning ? getToolActionVerb(fnName, true) : fnName
                    lines.push([
                        { text: glyph, style: { fg: glyphColor } },
                        { text: displayLabel, style: { fg: THEME.colors.warning, bold: true } },
                        { text: `(${args})`, style: { fg: THEME.colors.muted } },
                        ...(durStr
                            ? [{ text: ` (${durStr})`, style: { fg: THEME.colors.muted } }]
                            : []),
                    ])
                } else {
                    const displayLabel = isRunning
                        ? getToolActionVerb(tc.name || cmdStr, true)
                        : cmdStr
                    lines.push([
                        { text: glyph, style: { fg: glyphColor } },
                        { text: displayLabel, style: { fg: THEME.colors.warning, bold: true } },
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
                if (expandTools) {
                    lines.push([
                        { text: spinnerGlyph, style: { fg: THEME.colors.brand } },
                        { text: label, style: { fg: THEME.colors.brand, bold: true } },
                        { text: ' (ctrl+o to collapse)', style: { fg: THEME.colors.dim } },
                    ])
                    let streamCache: StreamingMarkdownCache | undefined
                    if (msg.isStreaming) {
                        streamCache = this.streamMarkdownCaches.get(msg)
                        if (!streamCache) {
                            streamCache = createStreamingMarkdownCache({ stabilizeInline: true })
                            this.streamMarkdownCaches.set(msg, streamCache)
                        }
                    }
                    const formatted = formatMarkdownToLines(msg.content, width - 4, streamCache)
                    for (const l of formatted) {
                        l.unshift({ text: '  ', style: {} })
                        for (const seg of l) {
                            if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                        }
                    }
                    lines.push(...formatted)
                    lines.push([{ text: '', style: {} }])
                } else {
                    lines.push([
                        { text: spinnerGlyph, style: { fg: THEME.colors.muted } },
                        {
                            text: label,
                            style: { fg: THEME.colors.muted },
                        },
                        ...(tip
                            ? [
                                  { text: '  · ', style: { fg: THEME.colors.dim } },
                                  { text: 'tip: ', style: { fg: THEME.colors.dim } },
                                  { text: tip, style: { fg: THEME.colors.muted } },
                              ]
                            : []),
                    ])
                    lines.push([{ text: '', style: {} }])
                }
            } else if (msg.content) {
                const durationMs = msg.durationMs
                const durationStr = durationMs
                    ? durationMs >= 1000
                        ? `${(durationMs / 1000).toFixed(1)}s`
                        : `${durationMs}ms`
                    : null
                const topic = extractThoughtTopic(msg.content)
                const thoughtTitle = durationStr ? `Thought for ${durationStr}` : 'Thought'
                const bannerLabel = topic ? `${thoughtTitle} · ${topic}` : thoughtTitle

                if (expandTools) {
                    lines.push([
                        { text: '❭ ', style: { fg: THEME.colors.brand } },
                        { text: bannerLabel, style: { fg: THEME.colors.brand, bold: true } },
                        { text: ' (ctrl+o to collapse)', style: { fg: THEME.colors.dim } },
                    ])
                    let streamCache: StreamingMarkdownCache | undefined
                    if (msg.isStreaming) {
                        streamCache = this.streamMarkdownCaches.get(msg)
                        if (!streamCache) {
                            streamCache = createStreamingMarkdownCache({ stabilizeInline: true })
                            this.streamMarkdownCaches.set(msg, streamCache)
                        }
                    }
                    const formatted = formatMarkdownToLines(msg.content, width - 4, streamCache)
                    for (const l of formatted) {
                        l.unshift({ text: '  ', style: {} })
                        for (const seg of l) {
                            if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                        }
                    }
                    lines.push(...formatted)
                    lines.push([{ text: '', style: {} }])
                } else {
                    lines.push([
                        { text: '❭ ', style: { fg: THEME.colors.muted } },
                        { text: bannerLabel, style: { fg: THEME.colors.muted } },
                        { text: ' (ctrl+o to expand)', style: { fg: THEME.colors.dim } },
                    ])
                    lines.push([{ text: '', style: {} }])
                }
            }
        } else if (msg.role === 'assistant') {
            const text = msg.content || msg.text || ''
            const interruptMarker = 'Interrupted · What should December do instead?'
            if (text.includes(interruptMarker)) {
                const parts = text.split(interruptMarker)
                const preText = parts[0]?.trimEnd() || ''
                if (preText) {
                    const formatted = formatMarkdownToLines(preText, width - 2)
                    lines.push(...formatted)
                }
                lines.push([
                    {
                        text: interruptMarker,
                        style: { fg: THEME.colors.muted, italic: true },
                    },
                ])
                lines.push([{ text: '', style: {} }])
            } else {
                let streamCache: StreamingMarkdownCache | undefined
                if (msg.isStreaming) {
                    streamCache = this.streamMarkdownCaches.get(msg)
                    if (!streamCache) {
                        streamCache = createStreamingMarkdownCache({ stabilizeInline: true })
                        this.streamMarkdownCaches.set(msg, streamCache)
                    }
                }
                const formatted = formatMarkdownToLines(text, width - 2, streamCache)
                lines.push(...formatted)
                lines.push([{ text: '', style: {} }])
            }
        } else if (msg.role === 'compaction' || (msg as any).type === 'compaction') {
            const rawSummary = msg.content || (msg as any).summary || ''
            const cleanSummary = rawSummary.replace(/^\[COMPACTED HISTORY SUMMARY\]\n?/i, '').trim()
            lines.push([
                { text: '⟳ ', style: { fg: THEME.colors.warning } },
                {
                    text: 'Context Compacted',
                    style: { fg: THEME.colors.warning, italic: true, bold: true },
                },
            ])
            if (cleanSummary) {
                const summaryFormatted = formatMarkdownToLines(cleanSummary, width - 4)
                for (const l of summaryFormatted) {
                    l.unshift({ text: '  │ ', style: { fg: THEME.colors.border } })
                    for (const seg of l) {
                        if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                    }
                }
                lines.push(...summaryFormatted)
            }
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

            if (parsed.hint) {
                const hintFormatted = formatMarkdownToLines(`**Action:** ${parsed.hint}`, width - 2)
                for (const line of hintFormatted) {
                    for (const seg of line) {
                        if (seg.text.startsWith('Action:') || seg.text.startsWith('**Action:**')) {
                            seg.style = { ...seg.style, fg: THEME.colors.warning, bold: true }
                        } else {
                            seg.style = { ...seg.style, fg: THEME.colors.text, bold: false }
                        }
                    }
                }
                lines.push(...hintFormatted)
            }

            if (parsed.cause) {
                const causeFormatted = formatMarkdownToLines(`Details: ${parsed.cause}`, width - 4)
                for (const line of causeFormatted) {
                    line.unshift({ text: '  ', style: {} })
                    for (const seg of line) {
                        if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                    }
                }
                lines.push(...causeFormatted)
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
     * Formats a sequence of messages, grouping consecutive discovery tool calls.
     */
    private formatMessageSequence(
        msgs: MessageItem[],
        width: number,
        spinner: string,
        expandTools: boolean,
        tip?: string | null
    ): FormattedLine[] {
        const lines: FormattedLine[] = []
        let i = 0

        while (i < msgs.length) {
            const msg = msgs[i]
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
                while (j < msgs.length) {
                    const nextMsg = msgs[j]
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
                        j < msgs.length && Boolean(msgs[j]?.role === 'tool' || msgs[j]?.toolCall)
                    const groupLines = this.formatDiscoveryGroup(
                        kind,
                        msgs.slice(i, j),
                        width,
                        spinner,
                        expandTools,
                        !nextAfterGroupIsTool
                    )
                    lines.push(...groupLines)
                    i = j
                    continue
                }
            }

            // Single message (tool or non-tool)
            if (isTool) {
                const nextIsTool =
                    i + 1 < msgs.length &&
                    Boolean(msgs[i + 1]?.role === 'tool' || msgs[i + 1]?.toolCall)
                lines.push(
                    ...this.getMessageLines(msg, width, spinner, expandTools, !nextIsTool, tip)
                )
            } else {
                lines.push(...this.getMessageLines(msg, width, spinner, expandTools, true, tip))
            }

            i++
        }

        return lines
    }

    /**
     * Returns the aggregated formatted lines for all messages.
     * Consolidates consecutive discovery blocks (Read, ListDir, Search, WebSearch),
     * stacks adjacent tool calls with compact vertical spacing, and rolls up
     * long autonomous turns (> 25 steps) when collapsed.
     */
    getLines(
        messages: MessageItem[],
        width: number,
        options?: { spinnerGlyph?: string; expandTools?: boolean; tip?: string | null }
    ): FormattedLine[] {
        const spinner = options?.spinnerGlyph || '⠋ '
        const expandTools = Boolean(options?.expandTools)
        const tip = options?.tip

        // Check if any message is actively streaming or running
        const hasLiveActivity = messages.some(
            (m) => m.isStreaming || m.toolCall?.status === 'running'
        )

        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null
        const lastKey = lastMsg ? this.computeContentKey(lastMsg, expandTools, true, tip) : ''

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

        // Streaming performance fast-path: if only the latest trailing message is actively streaming
        // or running, reuse the cached prior lines without re-partitioning or re-traversing history
        const lastIdx = messages.length - 1
        const onlyLastIsActive =
            hasLiveActivity &&
            messages.length > 1 &&
            Boolean(lastMsg && (lastMsg.isStreaming || lastMsg.toolCall?.status === 'running')) &&
            !messages
                .slice(0, lastIdx)
                .some((m) => m.isStreaming || m.toolCall?.status === 'running')

        if (onlyLastIsActive && lastMsg) {
            if (
                this.lastPriorResult &&
                this.lastPriorMessages === messages &&
                this.lastPriorLength === lastIdx &&
                this.lastPriorWidth === width &&
                this.lastPriorExpandTools === expandTools
            ) {
                const lastLines = this.getMessageLines(
                    lastMsg,
                    width,
                    spinner,
                    expandTools,
                    true,
                    tip
                )
                return [...this.lastPriorResult, ...lastLines]
            }

            const priorMsgs = messages.slice(0, lastIdx)
            const priorLines = this.getLines(priorMsgs, width, {
                spinnerGlyph: spinner,
                expandTools,
                tip,
            })
            this.lastPriorResult = priorLines
            this.lastPriorMessages = messages
            this.lastPriorLength = lastIdx
            this.lastPriorWidth = width
            this.lastPriorExpandTools = expandTools
            const lastLines = this.getMessageLines(lastMsg, width, spinner, expandTools, true, tip)
            return [...priorLines, ...lastLines]
        }

        let allLines: FormattedLine[] = []

        if (expandTools) {
            allLines = this.formatMessageSequence(messages, width, spinner, expandTools, tip)
        } else {
            // Partition messages into conversational turns
            interface Turn {
                userMsg?: MessageItem
                botMsgs: MessageItem[]
            }
            const turns: Turn[] = []
            let currentTurn: Turn = { botMsgs: [] }

            for (const msg of messages) {
                if (msg.role === 'user') {
                    if (currentTurn.userMsg || currentTurn.botMsgs.length > 0) {
                        turns.push(currentTurn)
                    }
                    currentTurn = { userMsg: msg, botMsgs: [] }
                } else {
                    currentTurn.botMsgs.push(msg)
                }
            }
            if (currentTurn.userMsg || currentTurn.botMsgs.length > 0) {
                turns.push(currentTurn)
            }

            const MAX_VISIBLE_STEPS = 25
            for (const turn of turns) {
                if (turn.userMsg) {
                    allLines.push(
                        ...this.getMessageLines(
                            turn.userMsg,
                            width,
                            spinner,
                            expandTools,
                            true,
                            tip
                        )
                    )
                }

                if (turn.botMsgs.length > MAX_VISIBLE_STEPS) {
                    const hiddenCount = turn.botMsgs.length - MAX_VISIBLE_STEPS
                    const hasLeadingText =
                        turn.botMsgs[0]?.role === 'assistant' && Boolean(turn.botMsgs[0]?.content)

                    if (hasLeadingText) {
                        allLines.push(
                            ...this.getMessageLines(
                                turn.botMsgs[0]!,
                                width,
                                spinner,
                                expandTools,
                                true,
                                tip
                            )
                        )
                        allLines.push([
                            {
                                text: `[+${hiddenCount} earlier steps hidden · press Ctrl+O to expand]`,
                                style: { fg: THEME.colors.dim },
                            },
                        ])
                        allLines.push([{ text: '', style: {} }])
                        const tail = turn.botMsgs.slice(
                            turn.botMsgs.length - (MAX_VISIBLE_STEPS - 1)
                        )
                        allLines.push(
                            ...this.formatMessageSequence(tail, width, spinner, expandTools, tip)
                        )
                    } else {
                        allLines.push([
                            {
                                text: `[+${hiddenCount} earlier steps hidden · press Ctrl+O to expand]`,
                                style: { fg: THEME.colors.dim },
                            },
                        ])
                        allLines.push([{ text: '', style: {} }])
                        const tail = turn.botMsgs.slice(hiddenCount)
                        allLines.push(
                            ...this.formatMessageSequence(tail, width, spinner, expandTools, tip)
                        )
                    }
                } else {
                    allLines.push(
                        ...this.formatMessageSequence(
                            turn.botMsgs,
                            width,
                            spinner,
                            expandTools,
                            tip
                        )
                    )
                }
            }
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
