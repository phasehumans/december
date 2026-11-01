import { THEME } from '../../theme'
import { parseTuiError } from '../../utils/error-parser'
import { drawText } from '../ui'

import { formatMarkdownToLines, type FormattedLine } from './markdown'

import type { ScreenBuffer } from '../buffer'

export interface MessageToolCall {
    id: string
    name: string
    command?: string
    status: 'running' | 'success' | 'error'
    output?: string
}

export interface MessageItem {
    id?: string
    role: 'user' | 'assistant' | 'error' | 'header' | 'tool' | 'thinking' | string
    type?: string
    timestamp?: number
    content?: string
    text?: string
    toolCall?: MessageToolCall
    isStreaming?: boolean
    usage?: {
        promptTokens?: number
        completionTokens?: number
        cacheReadInputTokens?: number
        cacheReadTokens?: number
    }
}

export interface MessageListViewProps {
    x?: number
    y?: number
    width: number
    height: number
    messages: MessageItem[]
    scrollOffset?: number
}

export const MessageListView = {
    render(
        buffer: ScreenBuffer,
        props: MessageListViewProps
    ): { totalLines: number; maxScroll: number } {
        const x = props.x ?? 0
        const y = props.y ?? 0
        const width = props.width
        const height = props.height
        const messages = props.messages

        // 1. Build all formatted lines for the message history
        const allLines: FormattedLine[] = []

        for (const msg of messages) {
            if (msg.role === 'user') {
                const text = msg.content || msg.text || ''
                allLines.push([
                    { text: '❭ ', style: { fg: THEME.colors.brand, bold: true } },
                    { text, style: { fg: THEME.colors.text, bold: true } },
                ])
                allLines.push([{ text: '', style: {} }]) // spacing
            } else if (msg.role === 'tool' || msg.toolCall) {
                const tc = msg.toolCall || {
                    id: '',
                    name: 'tool',
                    command: msg.content,
                    status: 'success' as const,
                }
                const isRunning = tc.status === 'running'
                const glyph = isRunning ? '⠋ ' : '● '
                const glyphColor =
                    tc.status === 'error'
                        ? THEME.colors.error
                        : isRunning
                          ? THEME.colors.warning
                          : THEME.colors.warning
                const cmdStr = tc.command || `${tc.name}()`

                allLines.push([
                    { text: glyph, style: { fg: glyphColor } },
                    { text: cmdStr, style: { fg: THEME.colors.warning, bold: true } },
                ])

                if ((tc.status === 'error' || (tc as any).status === 'failed') && tc.output) {
                    const toolErrLines = tc.output.trim().split('\n')
                    allLines.push([
                        { text: '    Error: ', style: { fg: THEME.colors.error, bold: true } },
                        {
                            text: toolErrLines[0] || 'Tool execution failed',
                            style: { fg: THEME.colors.error },
                        },
                    ])
                    for (let l = 1; l < Math.min(toolErrLines.length, 5); l++) {
                        allLines.push([
                            {
                                text: `           ${toolErrLines[l]}`,
                                style: { fg: THEME.colors.muted },
                            },
                        ])
                    }
                    if (toolErrLines.length > 5) {
                        allLines.push([
                            {
                                text: `           ... (${toolErrLines.length - 5} more lines)`,
                                style: { fg: THEME.colors.dim },
                            },
                        ])
                    }
                }
                allLines.push([{ text: '', style: {} }])
            } else if (msg.role === 'thinking') {
                if (msg.isStreaming && msg.content) {
                    allLines.push([
                        { text: '⠋ ', style: { fg: THEME.colors.muted } },
                        {
                            text: `Thinking... ${msg.content.trim()}`,
                            style: { fg: THEME.colors.muted },
                        },
                    ])
                    allLines.push([{ text: '', style: {} }])
                }
            } else if (msg.role === 'assistant') {
                const text = msg.content || msg.text || ''
                const formatted = formatMarkdownToLines(text, width - 2)
                allLines.push(...formatted)
                allLines.push([{ text: '', style: {} }]) // spacing
            } else if (msg.role === 'error') {
                const rawText = msg.content || msg.text || ''
                const parsed = parseTuiError(rawText, (msg as any).cause, (msg as any).hint)

                // 1. Headline Error message in bold red
                const errorFormatted = formatMarkdownToLines(
                    `**Error:** ${parsed.message}`,
                    width - 2
                )
                for (const line of errorFormatted) {
                    for (const seg of line) {
                        seg.style = { ...seg.style, fg: THEME.colors.error, bold: true }
                    }
                }
                allLines.push(...errorFormatted)

                // 2. Cause (if any)
                if (parsed.cause) {
                    const causeFormatted = formatMarkdownToLines(
                        `Cause: ${parsed.cause}`,
                        width - 4
                    )
                    for (const line of causeFormatted) {
                        line.unshift({ text: '  ', style: {} })
                        for (const seg of line) {
                            if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                        }
                    }
                    allLines.push(...causeFormatted)
                }

                // 3. Hint (with highlighted brand URLs)
                if (parsed.hint) {
                    const hintFormatted = formatMarkdownToLines(parsed.hint, width - 4)
                    for (const line of hintFormatted) {
                        line.unshift({ text: '  ', style: {} })
                        for (const seg of line) {
                            if (!seg.style?.fg) seg.style = { fg: THEME.colors.muted }
                        }
                    }
                    allLines.push(...hintFormatted)
                }

                allLines.push([{ text: '', style: {} }])
            }
        }

        const totalLines = allLines.length
        const maxScroll = Math.max(0, totalLines - height)
        const scroll =
            props.scrollOffset !== undefined ? Math.min(props.scrollOffset, maxScroll) : maxScroll
        const isReadingMode = scroll < maxScroll

        // 2. Slice lines for current visible viewport
        const visibleLines = allLines.slice(scroll, scroll + height)

        let currY = y
        if (isReadingMode && visibleLines.length > 0) {
            // Draw reading mode indicator on top line
            drawText(buffer, '▲ Reading mode (Press Esc to return)', {
                x: x + 2,
                y: currY,
                style: { fg: THEME.colors.warning, bold: true },
            })
            currY += 1
        }

        for (let i = 0; i < visibleLines.length && currY < y + height; i++) {
            const line = visibleLines[i]
            let currX = x + 1
            for (const seg of line) {
                if (currX >= x + width) break
                const available = Math.max(0, x + width - currX)
                const textToWrite =
                    seg.text.length > available ? seg.text.slice(0, available) : seg.text
                if (textToWrite) {
                    buffer.write(currX, currY, textToWrite, seg.style)
                    currX += textToWrite.length
                }
            }
            currY += 1
        }

        return { totalLines, maxScroll }
    },
}
