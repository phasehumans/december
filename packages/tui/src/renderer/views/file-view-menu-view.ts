import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

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
        const contentWidth = Math.max(10, width - x - gutterWidth - 5)

        // 1. Header: File path & line count on left, coordinates on right
        drawText(buffer, props.filePath || '(no file)', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })

        if (totalLines > 0) {
            const countLabel = ` · ${totalLines} line${totalLines === 1 ? '' : 's'}`
            drawText(buffer, countLabel, {
                x: x + (props.filePath || '(no file)').length,
                y,
                style: { fg: THEME.colors.dim },
            })
        }

        const coordLabel = `line ${props.cursorLineIndex + 1}:1`
        const coordX = Math.max(x + 40, width - coordLabel.length - 4)
        drawText(buffer, coordLabel, {
            x: coordX,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2 // Clean 1 empty line spacing matching React/Ink marginBottom={1}

        // 2. Viewport Lines
        const footerY = props.y + props.height - 1
        const visibleLineCount = Math.max(1, footerY - y - 1)

        if (props.isLoading) {
            drawText(buffer, 'Loading file...', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else if (props.error) {
            drawText(buffer, `Error: ${props.error}`, {
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
                const isCursor = absIdx === props.cursorLineIndex
                const lineNum = absIdx + 1
                const lineText = visibleLines[i] || ''
                const rowY = y + i
                const rowBg = isCursor ? THEME.colors.codespanBg : undefined

                // Active cursor line highlight bar across the full row
                if (isCursor) {
                    const rowWidth = Math.max(10, width - x - 2)
                    for (let c = 0; c < rowWidth; c++) {
                        buffer.setChar(x + c, rowY, ' ', { bg: rowBg })
                    }
                }

                // Selector glyph
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

                // Code text: crisp white for all code, highlighted background for cursor line
                const codeX = x + 2 + gutterWidth + 1
                drawText(buffer, lineText, {
                    x: codeX,
                    y: rowY,
                    maxWidth: contentWidth,
                    style: {
                        fg: THEME.colors.text,
                        bg: rowBg,
                        bold: isCursor,
                    },
                })
            }
        }

        // 3. Branded Footer
        const footerItems = [
            { key: '↑/↓', label: 'scroll' },
            { key: 'enter', label: 'insert @file:line' },
            {
                key: 'esc',
                label: props.returnOverlay && props.returnOverlay !== 'none' ? 'back' : 'dismiss',
            },
        ]

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
