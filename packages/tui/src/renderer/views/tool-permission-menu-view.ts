import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface ToolPermissionOption {
    label: string
    value: string
    keyHint?: string
}

export interface ToolPermissionMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    toolName: string
    toolCommandOrTarget?: string
    diffPreviewLines?: string[]
    selectedIndex: number
}

export const DEFAULT_PERMISSION_OPTIONS: ToolPermissionOption[] = [
    { label: 'Approve once', value: 'approve', keyHint: 'y' },
    { label: 'Always allow in session', value: 'always', keyHint: 'a' },
    { label: 'Only git-tracked files', value: 'git-tracked', keyHint: 'g' },
    { label: 'Deny execution', value: 'deny', keyHint: 'd' },
]

export const ToolPermissionMenuView = {
    getHeight(diffLinesCount = 0): number {
        const previewRows = Math.min(Math.max(diffLinesCount, 0), 5)
        // Header (1), Target (1), Preview Box (previewRows > 0 ? previewRows + 2 : 0), Divider (1), Options (4), Divider (1), Footer (1)
        return 7 + (previewRows > 0 ? previewRows + 2 : 0)
    },

    render(buffer: ScreenBuffer, props: ToolPermissionMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )

        // 1. Header
        drawText(buffer, 'Tool Permission Required: ', {
            x,
            y,
            style: { fg: THEME.colors.warning, bold: true },
        })
        const toolLabel = props.toolName || 'tool'
        drawText(buffer, toolLabel, {
            x: x + 26,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        y += 1

        // 2. Command / Target Line
        if (props.toolCommandOrTarget) {
            const cmdText = props.toolCommandOrTarget.replace(/\s+/g, ' ').trim()
            drawText(buffer, cmdText, {
                x: x + 2,
                y,
                maxWidth: width - 4,
                style: { fg: THEME.colors.text },
            })
            y += 1
        }

        // 3. Diff preview if present
        const diffLines = props.diffPreviewLines || []
        if (diffLines.length > 0) {
            drawDivider(buffer, {
                x,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 1

            const visibleDiff = diffLines.slice(0, 5)
            for (let i = 0; i < visibleDiff.length; i++) {
                const line = visibleDiff[i]
                const rowY = y + i
                let color: string = THEME.colors.muted
                if (line.startsWith('+')) color = THEME.colors.success
                else if (line.startsWith('-')) color = THEME.colors.error
                else if (line.startsWith('@')) color = THEME.colors.brand

                drawText(buffer, line, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: { fg: color },
                })
            }
            y += visibleDiff.length
        }

        // 4. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 5. Options List
        for (let idx = 0; idx < DEFAULT_PERMISSION_OPTIONS.length; idx++) {
            const opt = DEFAULT_PERMISSION_OPTIONS[idx]
            const isSelected = idx === props.selectedIndex
            const rowY = y + idx

            // Selector
            const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
            })

            // Key hint
            const hint = opt.keyHint ? `[${opt.keyHint}] ` : '    '
            drawText(buffer, hint, {
                x: x + 2,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.dim, bold: isSelected },
            })

            // Label
            let labelColor: string = THEME.colors.text
            if (opt.value === 'approve' || opt.value === 'always') {
                labelColor = isSelected ? THEME.colors.success : THEME.colors.text
            } else if (opt.value === 'deny') {
                labelColor = isSelected ? THEME.colors.error : THEME.colors.text
            }

            drawText(buffer, opt.label, {
                x: x + 6,
                y: rowY,
                maxWidth: width - 8,
                style: {
                    fg: isSelected ? labelColor : THEME.colors.muted,
                    bold: isSelected,
                },
            })
        }
        y += DEFAULT_PERMISSION_OPTIONS.length

        // 6. Divider
        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1
        const bottomDividerY = (props.y ?? 0) + height - 2

        drawDivider(buffer, {
            x,
            y: bottomDividerY,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // 7. Footer
        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: [
                { key: 'y', label: 'approve' },
                { key: 'a', label: 'always' },
                { key: 'g', label: 'git-tracked' },
                { key: 'd/n', label: 'deny' },
                { key: '↑/↓', label: 'navigate' },
                { key: 'enter', label: 'select' },
            ],
        })
    },
}
