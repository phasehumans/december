import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface TaskItem {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed'
    duration?: string
    exitCode?: number
}

export interface TasksModeMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    tasks: TaskItem[]
    selectedTaskIndex: number
    windowStart: number
}

export const TasksModeMenuView = {
    render(buffer: ScreenBuffer, props: TasksModeMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const tasks = props.tasks
        const windowSize = 8

        drawText(buffer, `Background Tasks (${tasks.length} total)`, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        drawDivider(buffer, {
            x: props.x ?? 0,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        if (tasks.length === 0) {
            drawText(buffer, 'No background tasks running or completed.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
        } else {
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, tasks.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, tasks.length)
            const visible = tasks.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const task = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === props.selectedTaskIndex
                const rowY = y + i

                // Selector indicator
                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                // Status Badge
                let badge = 'DONE'
                let badgeColor = THEME.colors.success
                if (task.status === 'running') {
                    badge = 'RUNNING'
                    badgeColor = THEME.colors.warning
                } else if (task.status === 'failed') {
                    badge = 'FAILED'
                    badgeColor = THEME.colors.error
                }

                drawText(buffer, `[${badge}]`, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: badgeColor, bold: true },
                })

                // Command
                drawText(buffer, task.command, {
                    x: x + 13,
                    y: rowY,
                    maxWidth: Math.max(10, width - x - 30),
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })

                // Duration if present
                if (task.duration) {
                    drawText(buffer, task.duration, {
                        x: Math.max(x + 50, width - task.duration.length - 4),
                        y: rowY,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }
        }

        // Footer at bottom
        const footerY = props.y + props.height - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑↓', label: 'Navigate' },
                { key: 'k', label: 'Kill Task' },
                { key: 'Esc', label: 'Close' },
            ],
        })
    },
}
