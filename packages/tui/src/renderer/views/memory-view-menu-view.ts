import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type MemoryTab = 'memory' | 'rules'

export const MEMORY_CATEGORIES = [
    'conventions',
    'build_and_test',
    'architecture',
    'quirks',
    'rules',
    'general',
] as const

export interface MemoryEntryViewItem {
    category: string
    text: string
    sourceFile?: string
    line?: number
}

export interface MemoryDetailsProps {
    filePath?: string
    targetFile?: string
    totalBytes: number
    maxBytes: number
    budgetPercent?: number
    entries: MemoryEntryViewItem[]
}

export interface RuleFileViewItem {
    path: string
    content: string
}

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
    // Memory tab state
    memoryDetails?: MemoryDetailsProps | null
    selectedEntryIndex?: number
    scrollOffset?: number
    isAddingEntry?: boolean
    newEntryText?: string
    newEntryCategory?: string
    // Rules tab state
    ruleFiles?: RuleFileViewItem[]
    selectedRuleIndex?: number
    ruleScrollOffset?: number
    ruleCursorLineIndex?: number
    // Backward compatibility for document reader
    documents?: MemoryDocument[]
    activeDocIndex?: number
    cursorLineIndex?: number
    isLoading?: boolean
    canGoBack?: boolean
}

export const MemoryViewMenuView = {
    getHeight(height = 14): number {
        return Math.max(10, height)
    },

    render(buffer: ScreenBuffer, props: MemoryViewMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const totalHeight = props.height ?? 14
        const footerY = props.y + totalHeight - 1

        const isMem = props.activeTab === 'memory'
        const isRules = props.activeTab === 'rules'

        // 1. Tab Bar Row (Clean, no boxes, no divider lines)
        const tabs: MemoryTab[] = ['memory', 'rules']
        let tabX = x
        for (const t of tabs) {
            const isCurrent = t === props.activeTab
            drawText(buffer, t, {
                x: tabX,
                y,
                style: {
                    fg: isCurrent ? THEME.colors.brand : THEME.colors.muted,
                    bold: isCurrent,
                },
            })
            tabX += t.length + 4
        }
        y += 2

        // 2. Sub-Header & Metadata
        if (isMem) {
            const filePath =
                props.memoryDetails?.filePath ||
                props.memoryDetails?.targetFile ||
                '.december/memory.md'
            drawText(buffer, `Workspace Memory (${filePath})`, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })

            const titleLen = `Workspace Memory (${filePath})`.length
            const totalBytes = props.memoryDetails?.totalBytes ?? 0
            const maxBytes = props.memoryDetails?.maxBytes ?? 2048
            const pct =
                props.memoryDetails?.budgetPercent ??
                Math.min(100, Math.round((totalBytes / maxBytes) * 100))
            const entriesCount = props.memoryDetails?.entries?.length ?? 0

            const meta = ` · ${totalBytes}/${maxBytes} B (${pct}%) · ${entriesCount} item${entriesCount === 1 ? '' : 's'}`
            drawText(buffer, meta, {
                x: x + titleLen,
                y,
                style: { fg: THEME.colors.dim },
            })
            y += 2
        } else {
            // Rules tab metadata
            const ruleFiles = props.ruleFiles || []
            const activeRule = ruleFiles[props.selectedRuleIndex ?? props.activeDocIndex ?? 0]
            const legacyDoc = props.documents?.find((d) => !d.isMemory)
            const filePath = activeRule?.path || legacyDoc?.filePath || 'AGENTS.md'
            const content = activeRule?.content || legacyDoc?.content || ''
            const lines = content ? content.split('\n') : []

            drawText(buffer, filePath, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            let headX = x + filePath.length

            if (lines.length > 0) {
                const countLabel = ` · ${lines.length} line${lines.length === 1 ? '' : 's'}`
                drawText(buffer, countLabel, {
                    x: headX,
                    y,
                    style: { fg: THEME.colors.dim },
                })
                headX += countLabel.length
            }

            if (ruleFiles.length > 1) {
                const currentIdx = (props.selectedRuleIndex ?? 0) + 1
                const switchBadge = ` · (${currentIdx}/${ruleFiles.length}) [ / ] switch`
                drawText(buffer, switchBadge, {
                    x: headX,
                    y,
                    style: { fg: THEME.colors.muted },
                })
            }
            y += 2
        }

        // 3. Content Viewport
        const promptHeight = props.isAddingEntry ? 3 : 0
        const contentHeight = Math.max(1, footerY - y - promptHeight - 1)

        if (props.isLoading) {
            drawText(buffer, 'Loading...', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else if (isMem) {
            // Render Memory Entries
            const entries = props.memoryDetails?.entries || []
            if (entries.length === 0) {
                drawText(
                    buffer,
                    'No memory recorded yet. Press [a] to add a project convention or quirk.',
                    {
                        x,
                        y,
                        style: { fg: THEME.colors.dim },
                    }
                )
            } else {
                const scrollOffset = Math.max(
                    0,
                    Math.min(props.scrollOffset ?? 0, Math.max(0, entries.length - contentHeight))
                )
                const visibleEntries = entries.slice(scrollOffset, scrollOffset + contentHeight)

                for (let i = 0; i < visibleEntries.length; i++) {
                    const absIdx = scrollOffset + i
                    const isSelected = absIdx === (props.selectedEntryIndex ?? 0)
                    const item = visibleEntries[i]
                    const rowY = y + i
                    const rowBg = isSelected ? THEME.colors.codespanBg : undefined

                    // Active cursor highlight bar across the full row
                    if (isSelected) {
                        const rowWidth = Math.max(10, width - x - 2)
                        for (let c = 0; c < rowWidth; c++) {
                            buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                        }
                    }

                    // Selector indicator glyph
                    const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                    drawText(buffer, selector, {
                        x,
                        y: rowY,
                        style: {
                            fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                            bg: rowBg,
                            bold: isSelected,
                        },
                    })

                    // Category badge
                    const catLabel = `[${item.category}] `
                    drawText(buffer, catLabel, {
                        x: x + 2,
                        y: rowY,
                        style: {
                            fg: isSelected ? THEME.colors.brand : THEME.colors.dim,
                            bg: rowBg,
                        },
                    })

                    // Entry text
                    const textX = x + 2 + catLabel.length
                    const textMaxWidth = Math.max(10, width - textX - 4)
                    drawText(buffer, item.text, {
                        x: textX,
                        y: rowY,
                        maxWidth: textMaxWidth,
                        style: {
                            fg: isSelected ? THEME.colors.text : THEME.colors.subtle,
                            bg: rowBg,
                            bold: isSelected,
                        },
                    })
                }
            }
        } else {
            // Render Rules Document
            const ruleFiles = props.ruleFiles || []
            const activeRule = ruleFiles[props.selectedRuleIndex ?? props.activeDocIndex ?? 0]
            const legacyDoc = props.documents?.find((d) => !d.isMemory)
            const content = activeRule?.content || legacyDoc?.content || ''

            if (!content) {
                drawText(
                    buffer,
                    'No project rules found. Press [c] to scaffold a starter AGENTS.md.',
                    {
                        x,
                        y,
                        style: { fg: THEME.colors.dim },
                    }
                )
            } else {
                const lines = content.split('\n')
                const totalLines = lines.length
                const gutterWidth = Math.max(3, String(totalLines).length)
                const scrollOffset = Math.max(
                    0,
                    Math.min(
                        props.ruleScrollOffset ?? props.scrollOffset ?? 0,
                        Math.max(0, totalLines - contentHeight)
                    )
                )
                const cursorLine = props.ruleCursorLineIndex ?? props.cursorLineIndex ?? 0
                const visibleLines = lines.slice(scrollOffset, scrollOffset + contentHeight)

                for (let i = 0; i < visibleLines.length; i++) {
                    const lineIndex = scrollOffset + i
                    const lineText = visibleLines[i] || ''
                    const rowY = y + i
                    const isCursor = lineIndex === cursorLine
                    const rowBg = isCursor ? THEME.colors.codespanBg : undefined

                    // Active cursor line highlight bar across the full row (matching FileViewMenuView)
                    if (isCursor) {
                        const rowWidth = Math.max(10, width - x - 2)
                        for (let c = 0; c < rowWidth; c++) {
                            buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                        }
                    }

                    // Selector indicator glyph
                    const selector = isCursor ? `${THEME.glyphs.selector} ` : '  '
                    drawText(buffer, selector, {
                        x,
                        y: rowY,
                        style: {
                            fg: isCursor ? THEME.colors.brand : THEME.colors.muted,
                            bg: rowBg,
                            bold: isCursor,
                        },
                    })

                    // Line number
                    const numStr = String(lineIndex + 1).padStart(gutterWidth, ' ')
                    drawText(buffer, `${numStr} │ `, {
                        x: x + 2,
                        y: rowY,
                        style: {
                            fg: isCursor ? THEME.colors.brand : THEME.colors.dim,
                            bg: rowBg,
                            bold: isCursor,
                        },
                    })

                    // Line text
                    const codeX = x + 2 + gutterWidth + 3
                    const codeMaxWidth = Math.max(10, width - codeX - 4)
                    drawText(buffer, lineText, {
                        x: codeX,
                        y: rowY,
                        maxWidth: codeMaxWidth,
                        style: {
                            fg: isCursor ? THEME.colors.brand : THEME.colors.text,
                            bg: rowBg,
                            bold: isCursor,
                        },
                    })
                }
            }
        }

        // 4. Inline Add Entry Prompt (when adding entry)
        if (props.isAddingEntry) {
            const promptY = footerY - 2
            const cat = props.newEntryCategory || 'general'
            const promptLabel = `add memory [${cat}] › `
            drawText(buffer, promptLabel, {
                x,
                y: promptY,
                style: { fg: THEME.colors.brand, bold: true },
            })
            const inputX = x + promptLabel.length
            const inputVal = (props.newEntryText || '') + '█'
            drawText(buffer, inputVal, {
                x: inputX,
                y: promptY,
                maxWidth: Math.max(10, width - inputX - 2),
                style: { fg: THEME.colors.text },
            })
        }

        // 5. Navigation Footer
        if (props.isAddingEntry) {
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: 'enter', label: 'save' },
                    { key: 'tab', label: 'cycle category' },
                    { key: 'esc', label: 'cancel' },
                ],
            })
        } else if (isMem) {
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: 'tab', label: 'switch tab' },
                    { key: '↑/↓', label: 'select' },
                    { key: 'a', label: 'add' },
                    { key: 'd', label: 'forget' },
                    { key: 'esc', label: props.canGoBack ? 'back' : 'close' },
                ],
            })
        } else {
            const ruleFiles = props.ruleFiles || []
            const footerItems = [{ key: 'tab', label: 'switch tab' }]
            if (ruleFiles.length > 1) {
                footerItems.push({ key: '[/]', label: 'switch doc' })
            }
            footerItems.push({ key: '↑/↓', label: 'scroll' })
            if (ruleFiles.length === 0) {
                footerItems.push({ key: 'c', label: 'scaffold AGENTS.md' })
            }
            footerItems.push({
                key: 'esc',
                label: props.canGoBack ? 'back' : 'close',
            })

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: footerItems,
            })
        }
    },
}
