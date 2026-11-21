import { homedir } from 'node:os'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawPagerRow, drawPagerTitle } from './panel'

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

        // Title row (M19.4): skill name, then entry file and line count as meta
        const metaParts: string[] = []
        if (displayPath) metaParts.push(displayPath)
        if (totalLines > 0) metaParts.push(`${totalLines} line${totalLines === 1 ? '' : 's'}`)
        drawPagerTitle(buffer, {
            x,
            y,
            width: (props.x ?? 0) + width - (THEME.padding.paddingRight ?? 4) - x,
            title: skill.name,
            meta: metaParts.join(' · ') || undefined,
            right: totalLines > 0 ? `${(props.cursorLineIndex ?? 0) + 1}:1` : undefined,
        })
        y += 2

        const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
        const visibleLineCount = Math.max(1, footerY - y - 1)
        const gutterWidth = Math.max(3, String(totalLines).length)
        const scrollOffset = props.scrollOffset ?? 0
        const cursorLineIndex = props.cursorLineIndex ?? 0

        if (props.isLoadingDetail) {
            drawText(buffer, 'Loading documentation…', {
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
                drawPagerRow(buffer, {
                    x,
                    y: y + i,
                    width: Math.max(10, width - x - 2),
                    lineNo: absIdx + 1,
                    gutterWidth,
                    text: visibleLines[i] || '',
                    cursor: absIdx === cursorLineIndex,
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
