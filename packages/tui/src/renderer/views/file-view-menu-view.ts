import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawPagerRow, drawPagerTitle } from './panel'

import type { ScreenBuffer } from '../buffer'

export interface FileViewMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    filePath: string
    lines: string[]
    cursorLineIndex: number
    scrollOffset: number
    isLoading?: boolean
    error?: string | null
    returnOverlay?: string
    searchQuery?: string
    matchLines?: number[]
    currentMatchIndex?: number
    fileIndex?: number
    totalFiles?: number
}

export const FileViewMenuView = {
    async loadFile(
        filePath: string,
        workspaceDir: string = process.cwd()
    ): Promise<{ content: string; lines: string[] }> {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(workspaceDir, filePath)
        const content = await fs.readFile(fullPath, 'utf8')
        const lines = content.split(/\r?\n/)
        return { content, lines }
    },

    render(buffer: ScreenBuffer, props: FileViewMenuViewProps): void {
        const paddingLeft = THEME.padding.paddingLeft ?? 2
        const x = (props.x ?? 0) + paddingLeft
        let y = props.y
        const width = props.width
        const totalLines = props.lines.length
        const gutterWidth = Math.max(3, String(totalLines).length)
        const rightEdge = (props.x ?? 0) + width - (THEME.padding.paddingRight ?? 4)

        // 1. Title row (M19.4): path, then lines, file position, and search position as meta
        const metaParts: string[] = []
        if (totalLines > 0) metaParts.push(`${totalLines} line${totalLines === 1 ? '' : 's'}`)
        if (props.totalFiles && props.totalFiles > 1) {
            metaParts.push(`file ${(props.fileIndex ?? 0) + 1}/${props.totalFiles}`)
        }
        if (props.searchQuery && props.matchLines && props.matchLines.length > 0) {
            const currentIdx = (props.currentMatchIndex ?? 0) + 1
            metaParts.push(`"${props.searchQuery}" ${currentIdx}/${props.matchLines.length}`)
        }
        drawPagerTitle(buffer, {
            x,
            y,
            width: rightEdge - x,
            title: props.filePath || '(no file)',
            meta: metaParts.join(' · ') || undefined,
            right: `${props.cursorLineIndex + 1}:1`,
        })
        y += 2

        // 2. Viewport Lines
        const footerY = props.y + props.height - 1
        const visibleLineCount = Math.max(1, footerY - y - 1)

        if (props.isLoading) {
            drawText(buffer, 'Loading file…', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else if (props.error) {
            const cleanErr = props.error.replace(/^Error:\s*/i, '').trim()
            drawText(buffer, cleanErr, {
                x,
                y,
                style: { fg: THEME.colors.error },
            })
        } else if (totalLines === 0) {
            drawText(buffer, '(Empty file)', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else {
            const visibleLines = props.lines.slice(
                props.scrollOffset,
                props.scrollOffset + visibleLineCount
            )
            for (let i = 0; i < visibleLines.length; i++) {
                const absIdx = props.scrollOffset + i
                drawPagerRow(buffer, {
                    x,
                    y: y + i,
                    width: Math.max(10, width - x - 2),
                    lineNo: absIdx + 1,
                    gutterWidth,
                    text: visibleLines[i] || '',
                    cursor: absIdx === props.cursorLineIndex,
                    query: props.searchQuery,
                })
            }
        }

        // 3. Branded Footer
        const footerItems = []
        if (props.returnOverlay === 'tasks' || props.filePath?.startsWith('Task Output:')) {
            footerItems.push(
                { key: '↑/↓', label: 'scroll' },
                { key: 'c', label: 'copy log' },
                { key: 'esc', label: 'back' }
            )
        } else {
            if (props.searchQuery && props.matchLines && props.matchLines.length > 1) {
                footerItems.push({ key: 'n/p', label: 'next/prev match' })
            }
            if (props.totalFiles && props.totalFiles > 1) {
                footerItems.push({ key: '←/→', label: 'cycle file' })
            }
            footerItems.push(
                { key: '↑/↓', label: 'scroll' },
                { key: 'enter', label: 'insert @file:line' },
                {
                    key: 'esc',
                    label:
                        props.returnOverlay && props.returnOverlay !== 'none' ? 'back' : 'dismiss',
                }
            )
        }

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
