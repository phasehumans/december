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
    toolCall?: MessageToolCall
    durationMs?: number
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
    isStreaming?: boolean
    spinnerFrame?: number
    statusMessage?: string
    headerProps?: HeaderViewProps
    lineCache?: MessageLineCache
    expandTools?: boolean
    tip?: string | null
}

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const defaultLineCache = new MessageLineCache()

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
        const spinnerGlyph = SPINNER_FRAMES[(props.spinnerFrame ?? 0) % SPINNER_FRAMES.length] + ' '

        // 1. Build all formatted lines for the message history
        const allLines: FormattedLine[] = []

        // 0. Prepend non-sticky scrollable header lines if provided
        if (props.headerProps) {
            allLines.push(...HeaderView.toLines(props.headerProps, width))
        }

        const cache = props.lineCache ?? defaultLineCache
        allLines.push(
            ...cache.getLines(messages, width, {
                spinnerGlyph,
                expandTools: props.expandTools,
                tip: props.tip,
            })
        )

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
                        { text: spinnerGlyph, style: { fg: THEME.colors.brand } },
                        { text: 'Thinking...', style: { fg: THEME.colors.muted } },
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

        const totalLines = allLines.length
        const maxScroll = Math.max(0, totalLines - height)
        const scroll =
            props.scrollOffset !== undefined ? Math.min(props.scrollOffset, maxScroll) : maxScroll

        // 2. Slice lines for current visible viewport
        const visibleLines = allLines.slice(scroll, scroll + height)

        let currY = y
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
