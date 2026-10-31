import { THEME } from '../../theme'
import { drawText } from '../ui'

import { formatMarkdownToLines, type FormattedLine } from './markdown'

import type { ScreenBuffer } from '../buffer'

export interface MessageItem {
    id?: string
    role: 'user' | 'assistant' | 'error' | 'header' | string
    content?: string
    text?: string
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
            } else if (msg.role === 'assistant') {
                const text = msg.content || msg.text || ''
                const formatted = formatMarkdownToLines(text, width - 2)
                allLines.push(...formatted)
                allLines.push([{ text: '', style: {} }]) // spacing
            } else if (msg.role === 'error') {
                const text = msg.content || msg.text || ''
                allLines.push([
                    { text: 'Error: ', style: { fg: THEME.colors.error, bold: true } },
                    { text, style: { fg: THEME.colors.error } },
                ])
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
                buffer.write(currX, currY, seg.text, seg.style)
                currX += seg.text.length
            }
            currY += 1
        }

        return { totalLines, maxScroll }
    },
}
