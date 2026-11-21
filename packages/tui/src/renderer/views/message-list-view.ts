import { THEME } from '../../theme'
import { sliceToWidth } from '../cell'

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
    /** MCP server and original tool name, when the tool comes from an MCP server (F7) */
    mcpServer?: string
    mcpTool?: string
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
    /** End-of-turn line for `turn_summary` messages (L16) */
    summary?: TurnSummary
}

export interface TurnSummary {
    durationMs: number
    outputTokens?: number
    files: { path: string; added: number; removed: number }[]
}

export interface MessageListViewProps {
    x?: number
    y?: number
    width: number
    height: number
    messages: MessageItem[]
    scrollOffset?: number
    isStreaming?: boolean
    headerProps?: HeaderViewProps
    lineCache?: MessageLineCache
    /** Clock for the running step dot's blink; tests pass a fixed value */
    now?: number
    /** Files whose diff the permission prompt already showed this turn (S4.8) */
    previewedPaths?: ReadonlySet<string>
    /** An approval prompt is open for the newest running step (L10) */
    awaitingApproval?: boolean
    /**
     * Total line count when the user scrolled away from the bottom.
     * Lines past this count are shown as new in the scroll pill.
     */
    newLinesAnchor?: number
    /**
     * When following the bottom, lay out only the newest turns that fill the view and leave
     * older uncached turns for MessageLineCache.layoutPending(). The result reports
     * `complete: false` while any are left.
     */
    virtualize?: boolean
    /**
     * Lines drawn after the last line of the history, outside the line cache: the activity
     * line and the plan checklist of the live turn (L20). They scroll with the chat.
     */
    trailingLines?: FormattedLine[]
}

const defaultLineCache = new MessageLineCache()

/**
 * Returns lines [start, end) of the segments joined, without joining them. Walks from
 * whichever end is closer, since the view usually shows the newest lines.
 */
function sliceSegments(
    segments: FormattedLine[][],
    start: number,
    end: number,
    totalLines: number
): FormattedLine[] {
    const result: FormattedLine[] = []
    if (start >= end) return result
    if (totalLines - end < start) {
        let segEnd = totalLines
        for (let s = segments.length - 1; s >= 0 && segEnd > start; s--) {
            const segment = segments[s]!
            const offset = segEnd - segment.length
            if (offset < end) {
                const from = Math.max(0, start - offset)
                const to = Math.min(segment.length, end - offset)
                for (let i = to - 1; i >= from; i--) result.push(segment[i]!)
            }
            segEnd = offset
        }
        return result.reverse()
    }
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
    ): { totalLines: number; maxScroll: number; complete: boolean } {
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

        // 1. Collect the history as ordered segments, one per turn. Settled turns come back as
        // shared cached arrays, so a frame never copies every line of a long session.
        const cache = props.lineCache ?? defaultLineCache
        const segments = cache.getLineSegments(messages, layoutWidth, {
            liveTurn: Boolean(props.isStreaming),
            now: props.now ?? Date.now(),
            previewedPaths: props.previewedPaths,
            awaitingApproval: props.awaitingApproval,
            tailLines: props.virtualize && props.scrollOffset === undefined ? height : undefined,
        })
        const complete = cache.isComplete()

        // 0. Non-sticky scrollable header lines go above the oldest turn, so only once every
        // turn is laid out
        if (props.headerProps && complete) {
            segments.unshift(HeaderView.toLines(props.headerProps, layoutWidth))
        }

        // One blank row between the chat and the prompt box: drop blank lines at the very end
        // of the history. Segments are shared cache arrays, so trim copies, never the originals.
        const isBlankLine = (line: FormattedLine) => line.every((seg) => seg.text.trim() === '')
        while (segments.length > 0) {
            const last = segments[segments.length - 1]!
            let end = last.length
            while (end > 0 && isBlankLine(last[end - 1]!)) end--
            if (end === last.length) break
            if (end === 0) {
                segments.pop()
                continue
            }
            segments[segments.length - 1] = last.slice(0, end)
            break
        }

        // L20: the activity line is the last line of the live turn, one blank line under the
        // last row, so it moves down as steps arrive and scrolls away with the chat
        if (props.trailingLines && props.trailingLines.length > 0) {
            const hasHistory = segments.some((segment) => segment.length > 0)
            segments.push(
                hasHistory
                    ? [[{ text: '', style: {} }], ...props.trailingLines]
                    : props.trailingLines
            )
        }

        let totalLines = 0
        for (const segment of segments) totalLines += segment.length
        const maxScroll = Math.max(0, totalLines - height)
        const scroll =
            props.scrollOffset !== undefined ? Math.min(props.scrollOffset, maxScroll) : maxScroll

        // 2. Slice lines for current visible viewport
        const visibleLines = sliceSegments(segments, scroll, scroll + height, totalLines)

        let currY = y
        for (let i = 0; i < visibleLines.length && currY < y + height; i++) {
            const line = visibleLines[i]
            let currX = contentX
            for (const seg of line) {
                if (currX >= x + width) break
                const available = Math.max(0, x + width - currX)
                // Clip by terminal columns so wide characters never spill onto the next row
                const textToWrite = sliceToWidth(seg.text, available)
                if (textToWrite) {
                    currX = buffer.write(currX, currY, textToWrite, seg.style).x
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
            const bg = THEME.colors.surface
            const parts = [
                {
                    text: ` ${countText} · `,
                    style: { fg: newLines > 0 ? THEME.colors.text : THEME.colors.muted, bg },
                },
                { text: 'esc ', style: { fg: THEME.colors.brand, bg } },
            ]
            const pillWidth = parts.reduce((sum, part) => sum + part.text.length, 0)
            let pillX = Math.max(x + 2, x + width - pillWidth - 3)
            const pillY = y + height - 1
            for (const part of parts) {
                buffer.write(pillX, pillY, part.text, part.style)
                pillX += part.text.length
            }
        }

        return { totalLines, maxScroll, complete }
    },
}
