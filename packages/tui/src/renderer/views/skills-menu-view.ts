import { homedir } from 'node:os'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface SkillItem {
    name: string
    description: string
    origin?: 'workspace' | 'global' | 'builtin' | string
    directoryPath?: string
    entryFilePath?: string
}

/** Full-screen SKILL.md viewer, opened from /plugin › Installed */
export interface SkillsMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    skill: SkillItem | null
    detailLines?: string[]
    cursorLineIndex?: number
    scrollOffset?: number
    isLoadingDetail?: boolean
    detailError?: string | null
}

export function toTildePath(p?: string): string {
    if (!p) return ''
    try {
        const home = homedir()
        return p.startsWith(home) ? '~' + p.slice(home.length) : p
    } catch {
        // Intentionally swallowed: fallback to original path
        return p
    }
}

export const SkillsMenuView = {
    render(buffer: ScreenBuffer, props: SkillsMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const skill = props.skill
        if (!skill) return

        const lines = props.detailLines || []
        const totalLines = lines.length
        const displayPath = toTildePath(skill.entryFilePath)

        // Header: Skill name & entry file path on left, line coordinates on right
        drawText(buffer, skill.name, {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })

        let headX = x + skill.name.length
        if (displayPath) {
            const pathLabel = ` · ${displayPath}`
            drawText(buffer, pathLabel, {
                x: headX,
                y,
                maxWidth: Math.max(10, width - headX - 20),
                style: { fg: THEME.colors.dim },
            })
            headX += Math.min(pathLabel.length, width - headX - 20)
        }

        if (totalLines > 0) {
            drawText(buffer, ` (${totalLines} lines)`, {
                x: headX,
                y,
                style: { fg: THEME.colors.dim },
            })
        }

        const coordLabel = `line ${(props.cursorLineIndex ?? 0) + 1}:${totalLines}`
        const coordX = Math.max(x + 40, width - coordLabel.length - 4)
        drawText(buffer, coordLabel, {
            x: coordX,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2

        const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
        const visibleLineCount = Math.max(1, footerY - y - 1)
        const gutterWidth = Math.max(3, String(totalLines).length)
        const scrollOffset = props.scrollOffset ?? 0
        const cursorLineIndex = props.cursorLineIndex ?? 0

        if (props.isLoadingDetail) {
            drawText(buffer, 'Loading documentation...', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else if (props.detailError) {
            const cleanErr = props.detailError.replace(/^Error:\s*/i, '').trim()
            drawText(buffer, cleanErr, {
                x,
                y,
                style: { fg: THEME.colors.error },
            })
        } else if (totalLines === 0) {
            drawText(buffer, '(Empty documentation)', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else {
            const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount)

            for (let i = 0; i < visibleLines.length; i++) {
                const absIdx = scrollOffset + i
                const isCursor = absIdx === cursorLineIndex
                const lineNum = absIdx + 1
                const lineText = visibleLines[i] || ''
                const rowY = y + i
                const rowBg = isCursor ? THEME.colors.codespanBg : undefined

                // Cursor row background
                if (isCursor) {
                    const rowWidth = Math.max(10, width - x - 2)
                    for (let c = 0; c < rowWidth; c++) {
                        buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                    }
                }

                // Selector
                const selector = isCursor ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.brand, bg: rowBg, bold: isCursor },
                })

                // Line number in gutter
                const paddedNum = String(lineNum).padStart(gutterWidth, ' ')
                drawText(buffer, `${paddedNum} `, {
                    x: x + 2,
                    y: rowY,
                    style: {
                        fg: isCursor ? THEME.colors.brand : THEME.colors.dim,
                        bg: rowBg,
                        bold: isCursor,
                    },
                })

                // Line text
                drawText(buffer, lineText || ' ', {
                    x: x + 2 + gutterWidth + 1,
                    y: rowY,
                    maxWidth: Math.max(10, width - x - gutterWidth - 5),
                    style: { fg: THEME.colors.text, bg: rowBg },
                })
            }
        }

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑/↓', label: 'scroll' },
                { key: 'space', label: 'use' },
                { key: 'esc', label: 'back' },
            ],
        })
    },
}
