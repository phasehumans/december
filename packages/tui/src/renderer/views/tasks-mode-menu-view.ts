import { THEME } from '../../theme'
import { drawText } from '../ui'

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
    getHeight(tasksCount: number, windowSize = 5): number {
        const count = tasksCount || 1
        const visible = Math.min(windowSize, count)
        const hasOverflow = count > windowSize
        // Title (1) + Top Margin (1) + Tasks (visible) + Overflow (0|1) + Bottom Margin (1) + Footer (1)
        return 2 + visible + (hasOverflow ? 1 : 0) + 1 + 1
    },

    render(buffer: ScreenBuffer, props: TasksModeMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const tasks = props.tasks
        const windowSize = 8

        drawText(buffer, `Tasks (${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'})`, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2 // Clean 1-row empty margin matching React/Ink marginBottom={1}

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
                let badgeColor: string = THEME.colors.success
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
                { key: '↑/↓', label: 'navigate' },
                { key: 'k', label: 'kill' },
                { key: 'esc', label: 'dismiss' },
            ],
        })
    },
}
