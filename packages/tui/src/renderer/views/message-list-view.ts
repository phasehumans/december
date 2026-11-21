import { THEME } from '../../theme'

import { HeaderView, type HeaderViewProps } from './header-view'
import { type FormattedLine } from './markdown'
import { MessageLineCache } from './message-line-cache'

import type { ScreenBuffer } from '../buffer'

export interface MessageToolCall {
    id: string
    name: string
    command?: string
    input?: any
    status: 'running' | 'success' | 'error'
    output?: string
    durationMs?: number
    startTime?: number
}

export interface MessageItem {
    id?: string
    role: 'user' | 'assistant' | 'error' | 'header' | 'tool' | 'thinking' | string
    type?: string
    timestamp?: number
    content?: string
    text?: string
    cause?: string
    hint?: string
    toolCall?: MessageToolCall
    durationMs?: number
    isStreaming?: boolean
    /** colour of the status dot for `task_notice` messages */
    tone?: 'success' | 'error' | 'muted'
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
    isStreaming?: boolean
    spinnerFrame?: number
    statusMessage?: string
    /** Status of background work (like /update) that shows even when no turn is streaming */
    backgroundStatus?: string
    headerProps?: HeaderViewProps
    lineCache?: MessageLineCache
    expandTools?: boolean
    tip?: string | null
    /**
     * Total line count when the user scrolled away from the bottom.
     * Lines past this count are shown as new in the scroll pill.
     */
    newLinesAnchor?: number
}

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const defaultLineCache = new MessageLineCache()

/** Returns lines [start, end) of the segments joined, without joining them. */
function sliceSegments(segments: FormattedLine[][], start: number, end: number): FormattedLine[] {
    const result: FormattedLine[] = []
    let offset = 0
    for (const segment of segments) {
        if (offset >= end) break
        const segEnd = offset + segment.length
        if (segEnd > start) {
            const from = Math.max(0, start - offset)
            const to = Math.min(segment.length, end - offset)
            for (let i = from; i < to; i++) result.push(segment[i]!)
        }
        offset = segEnd
    }
    return result
}

export const MessageListView = {
    render(
        buffer: ScreenBuffer,
        props: MessageListViewProps
    ): { totalLines: number; maxScroll: number } {
        const x = props.x ?? 0
        const y = props.y ?? 0
        const width = props.width
        // Chat lines start at the same left edge as the prompt box and status bar.
        // Layout width is reduced by the same amount, so wrapped text ends where the
        // prompt separator ends.
        const contentX = x + THEME.padding.paddingLeft
        const layoutWidth = Math.max(10, width - THEME.padding.paddingLeft)
        const height = props.height
        const messages = props.messages
        const spinnerGlyph = SPINNER_FRAMES[(props.spinnerFrame ?? 0) % SPINNER_FRAMES.length] + ' '

        // 1. Collect the history as ordered segments. Settled history comes back as a shared
        // cached array, so a frame never copies every line of a long session.
        const segments: FormattedLine[][] = []

        // 0. Prepend non-sticky scrollable header lines if provided
        if (props.headerProps) {
            segments.push(HeaderView.toLines(props.headerProps, layoutWidth))
        }

        const cache = props.lineCache ?? defaultLineCache
        segments.push(
            ...cache.getLineSegments(messages, layoutWidth, {
                spinnerGlyph,
                expandTools: props.expandTools,
                tip: props.tip,
            })
        )

        // Status and loader rows that follow the history
        const allLines: FormattedLine[] = []
        segments.push(allLines)

        // 1a. Background work (like /update) keeps a status row even between turns
        if (props.backgroundStatus) {
            allLines.push([
                { text: '⟳ ', style: { fg: THEME.colors.warning } },
                { text: props.backgroundStatus, style: { fg: THEME.colors.muted } },
            ])
            allLines.push([{ text: '', style: {} }])
        }

        // 1b. If streaming is active, render active status message or waiting loader
        if (props.isStreaming) {
            if (props.statusMessage) {
                allLines.push([
                    { text: spinnerGlyph, style: { fg: THEME.colors.warning } },
                    { text: props.statusMessage, style: { fg: THEME.colors.muted } },
                    ...(props.tip
                        ? [
                              { text: '  · ', style: { fg: THEME.colors.dim } },
                              { text: 'tip: ', style: { fg: THEME.colors.dim } },
                              { text: props.tip, style: { fg: THEME.colors.muted } },
                          ]
                        : []),
                ])
                allLines.push([{ text: '', style: {} }])
            } else {
                const lastMsg = messages[messages.length - 1]
                const isWaitingForResponse =
                    !lastMsg ||
                    lastMsg.role === 'user' ||
                    (lastMsg.role === 'assistant' && !lastMsg.content)
                if (isWaitingForResponse) {
                    allLines.push([
                        { text: spinnerGlyph, style: { fg: THEME.colors.warning } },
                        { text: 'Thinking...', style: { fg: THEME.colors.warning, bold: true } },
                        ...(props.tip
                            ? [
                                  { text: '  · ', style: { fg: THEME.colors.dim } },
                                  { text: 'tip: ', style: { fg: THEME.colors.dim } },
                                  { text: props.tip, style: { fg: THEME.colors.muted } },
                              ]
                            : []),
                    ])
                    allLines.push([{ text: '', style: {} }])
                }
            }
        }

        let totalLines = 0
        for (const segment of segments) totalLines += segment.length
        const maxScroll = Math.max(0, totalLines - height)
        const scroll =
            props.scrollOffset !== undefined ? Math.min(props.scrollOffset, maxScroll) : maxScroll

        // 2. Slice lines for current visible viewport
        const visibleLines = sliceSegments(segments, scroll, scroll + height)

        let currY = y
        for (let i = 0; i < visibleLines.length && currY < y + height; i++) {
            const line = visibleLines[i]
            let currX = contentX
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

        // 3. Scroll pill when the user is scrolled up: new output, or plain history below
        const linesBelow = maxScroll - scroll
        if (linesBelow > 0 && props.scrollOffset !== undefined && height > 2) {
            const newLines =
                props.newLinesAnchor !== undefined
                    ? Math.min(linesBelow, Math.max(0, totalLines - props.newLinesAnchor))
                    : 0
            const plural = (n: number) => (n === 1 ? '' : 's')
            const countText =
                newLines > 0
                    ? `↓ ${newLines} new line${plural(newLines)}`
                    : `↓ ${linesBelow} line${plural(linesBelow)} below`
            const bg = THEME.colors.border
            const parts = [
                {
                    text: ` ${countText}`,
                    style: {
                        fg: newLines > 0 ? THEME.colors.text : THEME.colors.muted,
                        bg,
                        bold: newLines > 0,
                    },
                },
                { text: ' · ', style: { fg: THEME.colors.subtle, bg } },
                { text: 'esc', style: { fg: THEME.colors.brand, bg, bold: true } },
                { text: ' jump to bottom ', style: { fg: THEME.colors.muted, bg } },
            ]
            const pillWidth = parts.reduce((sum, part) => sum + part.text.length, 0)
            let pillX = Math.max(x + 2, x + width - pillWidth - 3)
            const pillY = y + height - 1
            for (const part of parts) {
                buffer.write(pillX, pillY, part.text, part.style)
                pillX += part.text.length
            }
        }

        return { totalLines, maxScroll }
    },
}
