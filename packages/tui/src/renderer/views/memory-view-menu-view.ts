import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type MemoryTab = 'rules' | 'memory'

export interface MemoryDocument {
    id: string
    title: string
    filePath: string
    content: string
    isMemory: boolean
}

export interface MemoryViewMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    activeTab: MemoryTab
    documents: MemoryDocument[]
    activeDocIndex: number
    cursorLineIndex: number
    scrollOffset: number
    isLoading?: boolean
}

export const MemoryViewMenuView = {
    getHeight(height = 14): number {
        return Math.max(10, height)
    },

    render(buffer: ScreenBuffer, props: MemoryViewMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )
        const totalHeight = props.height ?? 14

        // 1. Tab Bar Row
        const isRules = props.activeTab === 'rules'
        const isMem = props.activeTab === 'memory'

        const rulesTab = isRules ? '[ Project Rules ]' : '  Project Rules  '
        const memTab = isMem ? '[ Memory Docs ]' : '  Memory Docs  '

        drawText(buffer, rulesTab, {
            x,
            y,
            style: {
                fg: isRules ? THEME.colors.brand : THEME.colors.muted,
                bold: isRules,
                underline: isRules,
            },
        })

        drawText(buffer, memTab, {
            x: x + rulesTab.length + 2,
            y,
            style: {
                fg: isMem ? THEME.colors.brand : THEME.colors.muted,
                bold: isMem,
                underline: isMem,
            },
        })
        y += 1

        // 2. Active Document Title & Path
        const docs = props.documents.filter((d) => (isRules ? !d.isMemory : d.isMemory))
        const activeDoc = docs[props.activeDocIndex] || docs[0]

        if (activeDoc) {
            drawText(buffer, `${activeDoc.title} · `, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            const titleLen = activeDoc.title.length + 3
            drawText(buffer, activeDoc.filePath, {
                x: x + titleLen,
                y,
                maxWidth: Math.max(10, width - titleLen),
                style: { fg: THEME.colors.muted },
            })
        } else {
            drawText(buffer, isRules ? 'No project rules found.' : 'No memory records found.', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        }
        y += 1

        // 3. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 4. Content Area
        const viewportHeight = Math.max(3, totalHeight - 6) // tabs (1), doc (1), divider (1), divider (1), footer (1), status (1)

        if (props.isLoading) {
            drawText(buffer, 'Loading document...', {
                x: x + 2,
                y: y + 1,
                style: { fg: THEME.colors.muted },
            })
            y += viewportHeight
        } else if (!activeDoc || !activeDoc.content) {
            drawText(buffer, 'Empty document.', {
                x: x + 2,
                y: y + 1,
                style: { fg: THEME.colors.dim },
            })
            y += viewportHeight
        } else {
            const lines = activeDoc.content.split('\n')
            const totalLines = lines.length
            const scrollOffset = Math.max(
                0,
                Math.min(props.scrollOffset, Math.max(0, totalLines - viewportHeight))
            )
            const visibleLines = lines.slice(scrollOffset, scrollOffset + viewportHeight)

            const lineNumWidth = Math.max(3, String(totalLines).length + 1)

            for (let i = 0; i < visibleLines.length; i++) {
                const lineIndex = scrollOffset + i
                const lineText = visibleLines[i]
                const rowY = y + i
                const isCursor = lineIndex === props.cursorLineIndex

                // Line number
                const numStr = String(lineIndex + 1).padStart(lineNumWidth)
                drawText(buffer, `${numStr} │ `, {
                    x,
                    y: rowY,
                    style: { fg: isCursor ? THEME.colors.brand : THEME.colors.dim },
                })

                // Line content
                const contentX = x + lineNumWidth + 3
                drawText(buffer, lineText, {
                    x: contentX,
                    y: rowY,
                    maxWidth: Math.max(10, width - (contentX - x)),
                    style: {
                        fg: isCursor ? THEME.colors.brand : THEME.colors.text,
                        bold: isCursor,
                    },
                })
            }
            y += visibleLines.length

            // Fill empty rows if less than viewportHeight
            for (let i = visibleLines.length; i < viewportHeight; i++) {
                drawText(buffer, '~', {
                    x,
                    y: y + (i - visibleLines.length),
                    style: { fg: THEME.colors.dim },
                })
            }
            y = props.y + 3 + viewportHeight

            // Line status bar
            const statusText = `Line ${props.cursorLineIndex + 1}/${totalLines}`
            drawText(buffer, statusText, {
                x: x + 2,
                y,
                style: { fg: THEME.colors.subtle },
            })
            y += 1
        }

        // 5. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 6. Navigation Footer
        MenuFooterView.render(buffer, {
            x,
            y,
            width,
            items: [
                { key: 'tab', label: 'switch tab' },
                { key: '↑/↓', label: 'scroll' },
                { key: 'e', label: 'open in editor' },
                { key: 'r', label: 'reload' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
