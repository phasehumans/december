import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawInlineConfirm, drawPanelTitle, formatPanelDuration, statusMark } from './panel'

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

/** "2m 03s", the chat's duration format */
export function formatTaskDuration(ms: number): string {
    return formatPanelDuration(ms)
}

/** one-line label for a task row: whitespace (including newlines) collapsed */
export function getTaskLabel(task: TaskItem): string {
    const command = task.command.replace(/\s+/g, ' ').trim()
    if (task.type === 'subagent' && task.role) {
        return command ? `${task.role}: ${command}` : task.role
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

/** G7: running is a steady brand dot, done and stopped dim, failed red */
function getStatusColor(status: TaskStatus): string {
    switch (status) {
        case 'running':
            return statusMark('running').color
        case 'failed':
            return statusMark('failed').color
        default:
            return statusMark('done').color
    }
}

/** the right-hand meta of a row: an optional red fault word, then muted info and the duration */
function getMeta(task: TaskItem, now: number): { fault: string; text: string } {
    const parts: string[] = []
    if (task.status === 'killed') {
        parts.push('stopped')
    } else if (task.type === 'subagent') {
        if (task.turns && task.status !== 'failed') {
            // while running: the turn it is on; when done: how many turns it took
            parts.push(
                task.status === 'running'
                    ? `turn ${task.turns}`
                    : `${task.turns} turn${task.turns === 1 ? '' : 's'}`
            )
        }
    } else if (task.status === 'running') {
        if (task.pid) parts.push(`pid ${task.pid}`)
    } else if (task.exitCode !== undefined) {
        parts.push(`exit ${task.exitCode}`)
    }
    const end = task.completedAt ?? now
    parts.push(formatTaskDuration(end - task.createdAt))
    return { fault: task.status === 'failed' ? 'failed' : '', text: parts.join('  ') }
}

/** number of distinct sections (0, 1 or 2) the list will show */
function countSections(tasks: TaskItem[]): number {
    return new Set(tasks.map((t) => t.type)).size
}

export const TasksModeMenuView = {
    getHeight(tasks: TaskItem[], windowSize = TASKS_WINDOW_SIZE): number {
        if (tasks.length === 0) {
            // Title (1) + Gap (1) + Empty row (1) + Gap (1) + Footer (1)
            return 5
        }
        const visible = Math.min(windowSize, tasks.length)
        const hasOverflow = tasks.length > windowSize
        // Title (1) + Gap or stop-all question (1) + Section titles + Visible + Overflow (0|1) + Gap (1) + Footer (1)
        return 2 + countSections(tasks) + visible + (hasOverflow ? 1 : 0) + 2
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

        // 1. Title, with the running count as meta (no description row)
        drawPanelTitle(buffer, {
            x,
            y,
            title: 'Tasks',
            meta: runningCount > 0 ? `${runningCount} running` : undefined,
            width,
        })
        y += 1

        // 2. The stop-all question takes the gap row under the title, inline as today
        if (confirmStop === 'all') {
            drawInlineConfirm(buffer, {
                x,
                y,
                text: `Stop ${runningCount} running task${runningCount === 1 ? '' : 's'}? [y/n]`,
                tone: 'warning',
            })
        }
        y += 1

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

                // Group label where the type changes (and at the top of the window), muted, not bold
                if (!prev || prev.type !== task.type) {
                    drawText(buffer, SECTION_TITLES[task.type] ?? 'Tasks', {
                        x,
                        y: rowY,
                        style: { fg: THEME.colors.muted },
                    })
                    rowY += 1
                }

                const isSelected = absIdx === props.selectedTaskIndex
                const isConfirming = isSelected && confirmStop === 'one'

                drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.brand },
                })

                drawText(buffer, THEME.glyphs.status, {
                    x: x + 2,
                    y: rowY,
                    style: { fg: getStatusColor(task.status) },
                })

                // Meta, right-aligned: a red fault word first, then muted info and duration
                const meta = getMeta(task, now)
                const faultText = meta.fault ? `${meta.fault}  ` : ''
                const metaLen = Math.min(META_WIDTH, faultText.length + meta.text.length)
                const metaX = x + width - metaLen
                if (faultText) {
                    drawText(buffer, meta.fault, {
                        x: metaX,
                        y: rowY,
                        style: { fg: THEME.colors.error },
                    })
                }
                drawText(buffer, meta.text, {
                    x: metaX + faultText.length,
                    y: rowY,
                    maxWidth: Math.max(0, metaLen - faultText.length),
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
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })
                if (isConfirming) {
                    drawInlineConfirm(buffer, {
                        x: labelResult.x,
                        y: rowY,
                        text: confirmSuffix,
                        tone: 'warning',
                    })
                }

                rowY += 1
            }

            // Overflow indicator, in dim under the last row
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
                    style: { fg: THEME.colors.dim },
                })
            }
        }

        // 4. Footer, as today
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
