import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export const TASKS_WINDOW_SIZE = 8
const META_WIDTH = 28

export type TaskStatus = 'running' | 'completed' | 'failed' | 'killed'
export type TaskType = 'shell' | 'subagent'
export type TasksConfirmStop = 'one' | 'all' | null

export interface TaskItem {
    id: string
    command: string
    type: TaskType
    status: TaskStatus
    /** epoch ms */
    createdAt: number
    /** epoch ms, set once the task is no longer running */
    completedAt?: number
    exitCode?: number
    pid?: number
    /** subagent role */
    role?: string
    /** subagent nesting depth */
    depth?: number
    /** subagent: turns started so far */
    turns?: number
    output?: string
}

export interface TasksModeMenuViewProps {
    x?: number
    y: number
    width: number
    height: number
    /** tasks in display order (see `orderTasks`) */
    tasks: TaskItem[]
    selectedTaskIndex: number
    windowStart: number
    confirmStop?: TasksConfirmStop
    /** epoch ms used for running durations (defaults to Date.now()) */
    now?: number
}

const SECTION_TITLES: Record<TaskType, string> = {
    shell: 'Shells',
    subagent: 'Subagents',
}

/** display order: shells first, then subagents, each in start order */
export function orderTasks(tasks: TaskItem[]): TaskItem[] {
    return [
        ...tasks.filter((t) => t.type !== 'subagent'),
        ...tasks.filter((t) => t.type === 'subagent'),
    ]
}

export function formatTaskDuration(ms: number): string {
    const secs = Math.floor(Math.max(0, ms) / 1000)
    if (secs < 60) return `${secs}s`
    const mins = Math.floor(secs / 60)
    if (mins < 60) return `${mins}m ${secs % 60}s`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

/** one-line label for a task row: whitespace (including newlines) collapsed */
export function getTaskLabel(task: TaskItem): string {
    const command = task.command.replace(/\s+/g, ' ').trim()
    if (task.type === 'subagent' && task.role) {
        return command ? `${task.role} · ${command}` : task.role
    }
    return command || task.id
}

/** lines shown in the task log view */
export function getTaskLogLines(task: TaskItem): string[] {
    return (task.output || '(no output recorded for this task)').split(/\r?\n/)
}

/** title of the task log view; `following` is true while it tails new output */
export function getTaskLogTitle(task: TaskItem, following: boolean): string {
    const mode =
        task.status !== 'running' ? task.status : following ? 'following' : 'paused (G to follow)'
    return `Task Output: ${task.id} (${getTaskLabel(task)}) · ${mode}`
}

function getStatusColor(status: TaskStatus): string {
    switch (status) {
        case 'running':
            return THEME.colors.warning
        case 'completed':
            return THEME.colors.success
        case 'failed':
            return THEME.colors.error
        default:
            return THEME.colors.muted
    }
}

function getMetaText(task: TaskItem, now: number): string {
    let info = ''
    if (task.status === 'killed') {
        info = 'stopped'
    } else if (task.type === 'subagent') {
        const parts: string[] = []
        if (task.depth !== undefined) parts.push(`depth ${task.depth}`)
        if (task.turns) {
            // while running: the turn it is on; when done: how many turns it took
            parts.push(
                task.status === 'running'
                    ? `turn ${task.turns}`
                    : `${task.turns} turn${task.turns === 1 ? '' : 's'}`
            )
        }
        info = parts.join(' · ')
    } else if (task.status === 'running') {
        info = task.pid ? `pid ${task.pid}` : ''
    } else if (task.exitCode !== undefined) {
        info = `exit ${task.exitCode}`
    }
    const end = task.completedAt ?? now
    const duration = formatTaskDuration(end - task.createdAt)
    return info ? `${info}  ${duration}` : duration
}

/** number of distinct sections (0, 1 or 2) the list will show */
function countSections(tasks: TaskItem[]): number {
    return new Set(tasks.map((t) => t.type)).size
}

export const TasksModeMenuView = {
    getHeight(tasks: TaskItem[], windowSize = TASKS_WINDOW_SIZE): number {
        if (tasks.length === 0) {
            // Title (1) + Subtitle (1) + Gap (1) + Empty row (1) + Gap (1) + Footer (1)
            return 6
        }
        const visible = Math.min(windowSize, tasks.length)
        const hasOverflow = tasks.length > windowSize
        // Title (1) + Subtitle (1) + Gap (1) + Section titles + Visible + Overflow (0|1) + Gap (1) + Footer (1)
        return 3 + countSections(tasks) + visible + (hasOverflow ? 1 : 0) + 2
    },

    render(buffer: ScreenBuffer, props: TasksModeMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )
        const tasks = props.tasks
        const now = props.now ?? Date.now()
        const confirmStop = props.confirmStop ?? null
        const runningCount = tasks.filter((t) => t.status === 'running').length

        // 1. Title
        drawText(buffer, 'Tasks', { x, y, style: { fg: THEME.colors.text, bold: true } })
        y += 1

        // 2. Subtitle (doubles as the stop-all confirmation)
        if (confirmStop === 'all') {
            drawText(
                buffer,
                `Stop ${runningCount} running task${runningCount === 1 ? '' : 's'}? [y/n]`,
                { x, y, maxWidth: width, style: { fg: THEME.colors.warning, bold: true } }
            )
        } else {
            const subtitle =
                runningCount > 0
                    ? `Background shells and subagents. ${runningCount} running.`
                    : 'Background shells and subagents.'
            drawText(buffer, subtitle, {
                x,
                y,
                maxWidth: width,
                style: { fg: THEME.colors.muted },
            })
        }
        y += 2

        // 3. Rows
        if (tasks.length === 0) {
            drawText(buffer, '  No background tasks.', {
                x,
                y,
                maxWidth: width,
                style: { fg: THEME.colors.muted },
            })
        } else {
            const windowSize = TASKS_WINDOW_SIZE
            const windowStart = Math.max(
                0,
                Math.min(props.windowStart, Math.max(0, tasks.length - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, tasks.length)
            let rowY = y

            for (let absIdx = windowStart; absIdx < windowEnd; absIdx++) {
                const task = tasks[absIdx]!
                const prev = absIdx > windowStart ? tasks[absIdx - 1] : undefined

                // Section title where the type changes (and at the top of the window)
                if (!prev || prev.type !== task.type) {
                    drawText(buffer, SECTION_TITLES[task.type] ?? 'Tasks', {
                        x,
                        y: rowY,
                        style: { fg: THEME.colors.muted, bold: true },
                    })
                    rowY += 1
                }

                const isSelected = absIdx === props.selectedTaskIndex
                const isConfirming = isSelected && confirmStop === 'one'

                drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted, bold: true },
                })

                drawText(buffer, `${THEME.glyphs.status} `, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: getStatusColor(task.status) },
                })

                const metaText = getMetaText(task, now)
                drawText(buffer, metaText.padStart(META_WIDTH), {
                    x: x + width - META_WIDTH,
                    y: rowY,
                    maxWidth: META_WIDTH,
                    style: { fg: THEME.colors.muted },
                })

                const confirmSuffix = ' [Stop? y/n]'
                const maxLabelWidth = Math.max(4, width - 4 - META_WIDTH - 2)
                const labelWidth = isConfirming
                    ? Math.max(4, maxLabelWidth - confirmSuffix.length)
                    : maxLabelWidth
                const labelResult = drawText(buffer, getTaskLabel(task), {
                    x: x + 4,
                    y: rowY,
                    maxWidth: labelWidth,
                    ellipsis: true,
                    style: {
                        fg: isConfirming
                            ? THEME.colors.warning
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text,
                        bold: isSelected,
                    },
                })
                if (isConfirming) {
                    drawText(buffer, confirmSuffix, {
                        x: labelResult.x,
                        y: rowY,
                        style: { fg: THEME.colors.warning, bold: true },
                    })
                }

                rowY += 1
            }

            // Overflow indicator
            if (tasks.length > windowSize) {
                const above = windowStart
                const below = tasks.length - windowEnd
                const statusText =
                    above > 0 && below > 0
                        ? `↑ ${above} more · ↓ ${below} more`
                        : above > 0
                          ? `↑ ${above} more`
                          : `↓ ${below} more`
                drawText(buffer, statusText, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: THEME.colors.subtle },
                })
            }
        }

        // 4. Footer
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: props.y + props.height - 1,
            width: props.width,
            items: confirmStop
                ? [
                      { key: 'y', label: 'stop' },
                      { key: 'n/esc', label: 'cancel' },
                  ]
                : [
                      { key: '↑/↓', label: 'navigate' },
                      { key: 'enter', label: 'log' },
                      { key: 'd', label: 'stop' },
                      { key: 'D', label: 'stop all' },
                      { key: 'c', label: 'copy' },
                      { key: 'x', label: 'clear done' },
                      { key: 'esc', label: 'close' },
                  ],
        })
    },
}
