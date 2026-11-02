import { THEME } from '../../theme'
import { parseTuiError } from '../../utils/error-parser'
import { toRelativePath } from '../../utils/terminal-link'
import { extractThoughtTopic } from '../../utils/thought'

import { formatMarkdownToLines, type FormattedLine } from './markdown'

import type { MessageItem } from './message-list-view'

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
    private lastAggregateResult: FormattedLine[] | null = null

    /**
     * Clears all cached lines.
     */
    clear(): void {
        this.messageCache = new WeakMap<MessageItem, CacheEntry>()
        this.lastAggregateMessages = null
        this.lastAggregateLength = 0
        this.lastAggregateLastKey = ''
        this.lastAggregateResult = null
    }

    private computeContentKey(msg: MessageItem, expandTools = false): string {
        const text = msg.content || msg.text || ''
        const toolStatus = msg.toolCall?.status || ''
        const toolOutput = msg.toolCall?.output || ''
        const toolCommand = msg.toolCall?.command || ''
        const toolInput =
            typeof msg.toolCall?.input === 'string'
                ? msg.toolCall?.input
                : JSON.stringify(msg.toolCall?.input || '')
        const isStreaming = Boolean(msg.isStreaming)
        const isExpanded = Boolean(expandTools)
        return `${msg.role}|${text}|${toolStatus}|${toolCommand}|${toolInput.slice(0, 50)}|${toolOutput.slice(-100)}|${isStreaming}|${isExpanded}`
    }

    /**
     * Formats and caches lines for a single message.
     */
    getMessageLines(
        msg: MessageItem,
        width: number,
        spinnerGlyph = '⠋ ',
        expandTools = false
    ): FormattedLine[] {
        const contentKey = this.computeContentKey(msg, expandTools)
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

            let parsedInput: any = tc.input
            if (typeof parsedInput === 'string') {
                try {
                    parsedInput = JSON.parse(parsedInput)
                } catch {
                    parsedInput = {}
                }
            } else if (!parsedInput) {
                parsedInput = {}
            }

            const isEditTool =
                toolNameLower === 'edit_file' ||
                toolNameLower === 'replace_file_content' ||
                toolNameLower === 'edit_diff' ||
                toolNameLower === 'multi_replace_file_content'
            const isWriteTool = toolNameLower === 'write_file' || toolNameLower === 'write_to_file'

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
                ])
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
                ])
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
            } else if (tc.output) {
                const isNoOutputTool =
                    toolNameLower === 'read_file' ||
                    toolNameLower === 'view_file' ||
                    toolNameLower === 'list_dir' ||
                    toolNameLower === 'ls' ||
                    toolNameLower === 'ask_permission' ||
                    toolNameLower === 'list_permissions' ||
                    isEditTool ||
                    isWriteTool ||
                    tc.command?.startsWith('Read(') ||
                    tc.command?.startsWith('ListDir(') ||
                    tc.command?.startsWith('Create(') ||
                    tc.command?.startsWith('Edit(')

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
            lines.push([{ text: '', style: {} }])
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
     * If the message list and terminal width haven't changed, returns cached lines in O(1).
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
            this.lastAggregateWidth === width
        ) {
            return this.lastAggregateResult
        }

        const allLines: FormattedLine[] = []
        for (const msg of messages) {
            allLines.push(...this.getMessageLines(msg, width, spinner, expandTools))
        }

        if (!hasLiveActivity) {
            this.lastAggregateMessages = messages
            this.lastAggregateLength = messages.length
            this.lastAggregateLastKey = lastKey
            this.lastAggregateWidth = width
            this.lastAggregateSpinner = spinner
            this.lastAggregateResult = allLines
        } else {
            this.lastAggregateResult = null
        }

        return allLines
    }
}
