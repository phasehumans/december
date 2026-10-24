import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useRef } from 'react'

import { useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import { writeToClipboard } from '../../utils/clipboard'

import { MenuFooter } from './menu-footer'

export interface TaskItem {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed' | 'killed' | string
    output?: string
    pid?: number
    createdAt?: Date | string
    completedAt?: Date | string
    exitCode?: number | null
}

export interface TasksModeMenuProps {
    tasksData?: TaskItem[]
    taskViewingId?: string | null
    taskScrollOffset?: number
    taskSelectedIndex?: number
    setTaskViewingId?: (id: string | null) => void
    setTaskScrollOffset?: (offset: number | ((prev: number) => number)) => void
    setTaskSelectedIndex?: (index: number | ((prev: number) => number)) => void
    setAuthMode?: (mode: string) => void
    onClose?: () => void
    handleKillTask?: (taskId: string) => void
    handleClearCompletedTasks?: () => void
    handleRemoveTask?: (taskId: string) => void
    handleKillAllTasks?: () => void
}

function formatDuration(createdAt?: Date | string, completedAt?: Date | string): string {
    if (!createdAt) return '-'
    const start =
        typeof createdAt === 'string' ? new Date(createdAt).getTime() : createdAt.getTime()
    const end = completedAt
        ? typeof completedAt === 'string'
            ? new Date(completedAt).getTime()
            : completedAt.getTime()
        : Date.now()
    if (isNaN(start) || isNaN(end) || end < start) return '-'
    const diffMs = Math.max(0, end - start)
    const seconds = Math.floor(diffMs / 1000)
    if (seconds < 60) return `${(diffMs / 1000).toFixed(1)}s`
    const minutes = Math.floor(seconds / 60)
    const remSec = seconds % 60
    if (minutes < 60) return `${minutes}m ${remSec}s`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
}

function formatTime(createdAt?: Date | string): string | null {
    if (!createdAt) return null
    const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
    if (isNaN(d.getTime())) return null
    const pad = (n: number) => String(n).padStart(2, '0')
    return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`
}

export function TasksModeMenu(props: TasksModeMenuProps) {
    const {
        tasksData = [],
        taskViewingId: propTaskViewingId = null,
        taskScrollOffset: propTaskScrollOffset = 0,
        taskSelectedIndex: propTaskSelectedIndex = 0,
        setTaskViewingId,
        setTaskScrollOffset,
        setTaskSelectedIndex,
        setAuthMode,
        onClose,
        handleKillTask,
        handleClearCompletedTasks,
        handleRemoveTask,
        handleKillAllTasks,
    } = props

    const rows = useTerminalRows()

    const [viewingId, setViewingId] = useState<string | null>(propTaskViewingId)
    const [scrollOffset, setScrollOffset] = useState<number>(propTaskScrollOffset)
    const [pageSelectedIndex, setPageSelectedIndex] = useState<number>(propTaskSelectedIndex)
    const [page, setPage] = useState<number>(0)
    const [isFollowing, setIsFollowing] = useState<boolean>(true)
    const [statusNotice, setStatusNotice] = useState<string | null>(null)

    useEffect(() => {
        if (propTaskViewingId !== undefined) {
            setViewingId(propTaskViewingId)
        }
    }, [propTaskViewingId])

    useEffect(() => {
        if (propTaskScrollOffset !== undefined) {
            setScrollOffset(propTaskScrollOffset)
        }
    }, [propTaskScrollOffset])

    useEffect(() => {
        if (propTaskSelectedIndex !== undefined) {
            setPageSelectedIndex(propTaskSelectedIndex)
        }
    }, [propTaskSelectedIndex])

    const changeViewingId = (id: string | null) => {
        setViewingId(id)
        if (setTaskViewingId) setTaskViewingId(id)
        setScrollOffset(0)
        if (setTaskScrollOffset) setTaskScrollOffset(0)
        setIsFollowing(true)
        setStatusNotice(null)
    }

    const changeScrollOffset = (valOrFn: number | ((prev: number) => number)) => {
        setScrollOffset((prev) => {
            const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn
            if (setTaskScrollOffset) setTaskScrollOffset(next)
            return next
        })
    }

    const handleClose = () => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }

    const getStatusColor = (status: string) => {
        const normalized = (status || '').toLowerCase()
        switch (normalized) {
            case 'running':
            case 'processing':
                return THEME.colors.warning
            case 'completed':
                return THEME.colors.success
            case 'failed':
            case 'killed':
            case 'cancelled':
                return THEME.colors.error
            default:
                return THEME.colors.text
        }
    }

    const renderStatusBadge = (
        status: string,
        exitCode?: number | null,
        createdAt?: Date | string,
        completedAt?: Date | string
    ) => {
        const normalized = (status || '').toLowerCase()
        const dur = formatDuration(createdAt, completedAt)
        const durSuffix = dur && dur !== '-' ? ` · ${dur}` : ''

        switch (normalized) {
            case 'running':
            case 'processing':
                return (
                    <Text color={THEME.colors.warning} bold>
                        [running]
                    </Text>
                )
            case 'completed':
                return (
                    <Text color={THEME.colors.success} bold>
                        [completed{durSuffix}]
                    </Text>
                )
            case 'cancelled':
            case 'killed':
                return (
                    <Text color={THEME.colors.error} bold>
                        [cancelled]
                    </Text>
                )
            case 'failed':
                return (
                    <Text color={THEME.colors.error} bold>
                        [
                        {exitCode !== undefined && exitCode !== null
                            ? `failed · exit ${exitCode}`
                            : 'failed'}
                        ]
                    </Text>
                )
            default:
                return (
                    <Text color={THEME.colors.muted} bold>
                        [{normalized || 'unknown'}]
                    </Text>
                )
        }
    }

    const PAGE_SIZE = 8
    const totalPages = Math.max(1, Math.ceil(tasksData.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages - 1)
    const startIndex = currentPage * PAGE_SIZE
    const visibleTasks = tasksData.slice(startIndex, startIndex + PAGE_SIZE)

    // Output view lines
    const visibleLineCount = Math.max(6, Math.min(15, rows - 12))

    // Ref to track latest state inside useInput
    const stateRef = useRef({
        viewingId,
        tasksData,
        visibleTasks,
        pageSelectedIndex,
        page: currentPage,
        totalPages,
        scrollOffset,
        visibleLineCount,
        isFollowing,
    })
    stateRef.current = {
        viewingId,
        tasksData,
        visibleTasks,
        pageSelectedIndex,
        page: currentPage,
        totalPages,
        scrollOffset,
        visibleLineCount,
        isFollowing,
    }

    useInput((input, key) => {
        const state = stateRef.current

        // 1. Detail / Log View Mode
        if (state.viewingId) {
            if (key.escape || (key.ctrl && (input === 't' || input === 'T'))) {
                changeViewingId(null)
                return
            }

            const currentTask = tasksData.find((t) => t.id === state.viewingId)
            const rawOut = currentTask?.output || ''
            const lines = rawOut.split(/\r?\n/)
            const maxOff = Math.max(0, lines.length - state.visibleLineCount)

            // Mouse Wheel Up: SGR, X10, rxvt
            if (
                /\[<(?:64|68|72|80|84);/.test(input) ||
                /\[M[`@]/.test(input) ||
                /\[64~/.test(input)
            ) {
                const upCount = Math.max(
                    1,
                    (input.match(/\[<(?:64|68|72|80|84);/g) || []).length +
                        (input.match(/\[M[`@]/g) || []).length +
                        (input.match(/\[64~/g) || []).length
                )
                setIsFollowing(false)
                changeScrollOffset((prev) => Math.max(0, Math.min(maxOff, prev - 3 * upCount)))
                return
            }

            // Mouse Wheel Down: SGR, X10, rxvt
            if (/\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)) {
                const downCount = Math.max(
                    1,
                    (input.match(/\[<(?:65|69|73|81|85);/g) || []).length +
                        (input.match(/\[Ma/g) || []).length +
                        (input.match(/\[65~/g) || []).length
                )
                changeScrollOffset((prev) => {
                    const next = Math.min(maxOff, prev + 3 * downCount)
                    if (next >= maxOff) setIsFollowing(true)
                    return next
                })
                return
            }

            if (key.upArrow || input === 'k') {
                setIsFollowing(false)
                changeScrollOffset((prev) => Math.max(0, Math.min(maxOff, prev - 1)))
                return
            }
            if (key.downArrow || input === 'j') {
                changeScrollOffset((prev) => {
                    const next = Math.min(maxOff, prev + 1)
                    if (next >= maxOff) setIsFollowing(true)
                    return next
                })
                return
            }
            if (key.leftArrow || key.pageUp || input === 'b') {
                setIsFollowing(false)
                changeScrollOffset((prev) => Math.max(0, prev - state.visibleLineCount))
                return
            }
            if (key.rightArrow || key.pageDown || input === ' ') {
                changeScrollOffset((prev) => {
                    const next = Math.min(maxOff, prev + state.visibleLineCount)
                    if (next >= maxOff) setIsFollowing(true)
                    return next
                })
                return
            }
            if (input === 'g') {
                setIsFollowing(false)
                changeScrollOffset(0)
                return
            }
            if (input === 'G') {
                setIsFollowing(true)
                changeScrollOffset(maxOff)
                return
            }
            if (input === 'f' || input === 'F') {
                setIsFollowing((prev) => {
                    const next = !prev
                    if (next) changeScrollOffset(maxOff)
                    return next
                })
                return
            }
            if (input === 'y' || input === 'c') {
                if (currentTask?.output) {
                    writeToClipboard(currentTask.output)
                    setStatusNotice('Output copied to clipboard!')
                    setTimeout(() => setStatusNotice(null), 2500)
                }
                return
            }
            if (input === 'k' || input === 'K' || input === 'x' || input === 'X') {
                if (currentTask && handleKillTask) {
                    handleKillTask(currentTask.id)
                }
                return
            }
            return
        }

        // 2. List Mode
        if (key.escape || (key.ctrl && (input === 't' || input === 'T'))) {
            handleClose()
            return
        }

        // Vertical navigation
        if (key.upArrow) {
            setPageSelectedIndex((prev) => {
                const next = Math.max(0, prev - 1)
                if (setTaskSelectedIndex) setTaskSelectedIndex(next)
                return next
            })
            return
        }
        if (key.downArrow || input === 'j') {
            const maxIdx = Math.max(0, state.visibleTasks.length - 1)
            setPageSelectedIndex((prev) => {
                const next = Math.min(maxIdx, prev + 1)
                if (setTaskSelectedIndex) setTaskSelectedIndex(next)
                return next
            })
            return
        }

        // Page navigation
        if (key.leftArrow || input === 'h') {
            setPage((prev) => Math.max(0, prev - 1))
            setPageSelectedIndex(0)
            if (setTaskSelectedIndex) setTaskSelectedIndex(0)
            return
        }
        if (key.rightArrow || input === 'l') {
            setPage((prev) => Math.min(state.totalPages - 1, prev + 1))
            setPageSelectedIndex(0)
            if (setTaskSelectedIndex) setTaskSelectedIndex(0)
            return
        }

        // View output
        if (key.return) {
            const selected = state.visibleTasks[state.pageSelectedIndex]
            if (selected) {
                changeViewingId(selected.id)
            }
            return
        }

        // Kill selected task
        if (input === 'k' || input === 'K') {
            const selected = state.visibleTasks[state.pageSelectedIndex]
            if (selected && handleKillTask) {
                handleKillTask(selected.id)
            }
            return
        }

        // Clear completed
        if (input === 'c' || input === 'C') {
            if (handleClearCompletedTasks) {
                handleClearCompletedTasks()
            }
            return
        }

        // Dismiss single task
        if (input === 'x' || input === 'X' || input === 'd' || input === 'D' || key.delete) {
            const selected = state.visibleTasks[state.pageSelectedIndex]
            if (selected && handleRemoveTask) {
                handleRemoveTask(selected.id)
            }
            return
        }

        // Kill all running
        if (input === 'K') {
            if (handleKillAllTasks) {
                handleKillAllTasks()
            }
            return
        }
    })

    // Detail View Render
    if (viewingId) {
        const task = tasksData.find((t) => t.id === viewingId)
        if (!task) {
            return (
                <Box flexDirection="column">
                    <Box marginBottom={1}>
                        <Text color={THEME.colors.error}>Task not found or has been removed.</Text>
                    </Box>
                    <MenuFooter items={[{ key: 'esc', label: 'close' }]} />
                </Box>
            )
        }

        const rawOutput = task.output || ''
        const outputLines = rawOutput.split(/\r?\n/)
        const maxOffset = Math.max(0, outputLines.length - visibleLineCount)
        const effectiveOffset =
            isFollowing && task.status === 'running' ? maxOffset : Math.min(scrollOffset, maxOffset)

        const visibleLines = outputLines.slice(effectiveOffset, effectiveOffset + visibleLineCount)
        const durationStr = formatDuration(task.createdAt, task.completedAt)
        const pidStr = task.pid ? String(task.pid) : '-'
        const gutterWidth = Math.max(2, outputLines.length.toString().length)

        return (
            <Box flexDirection="column">
                <Box marginBottom={1} justifyContent="space-between" flexDirection="row">
                    <Box flexDirection="row" gap={2}>
                        <Text color={THEME.colors.text}>Task: {task.id}</Text>
                        <Text color={THEME.colors.muted}>PID: {pidStr}</Text>
                        <Text color={THEME.colors.muted}>Duration: {durationStr}</Text>
                    </Box>
                    <Box flexDirection="row" gap={1}>
                        <Text color={getStatusColor(task.status)}>
                            [{task.status.toLowerCase()}]
                        </Text>
                        {task.exitCode !== undefined && task.exitCode !== null && (
                            <Text
                                color={
                                    task.exitCode === 0 ? THEME.colors.success : THEME.colors.error
                                }
                            >
                                (exit {task.exitCode})
                            </Text>
                        )}
                    </Box>
                </Box>

                <Box marginBottom={1}>
                    <Text color={THEME.colors.muted} wrap="truncate">
                        Cmd: {task.command.replace(/\r?\n+/g, ' ').trim()}
                    </Text>
                </Box>

                <Box
                    borderColor={THEME.colors.border}
                    borderStyle="single"
                    flexDirection="column"
                    paddingX={1}
                >
                    {visibleLines.length === 0 ||
                    (visibleLines.length === 1 && visibleLines[0] === '') ? (
                        <Text color={THEME.colors.muted}>[No output recorded yet]</Text>
                    ) : (
                        visibleLines.map((line, idx) => {
                            const lineNum = effectiveOffset + idx + 1
                            const gutter = `${lineNum.toString().padStart(gutterWidth, ' ')} | `
                            return (
                                <Box key={idx} flexDirection="row">
                                    <Text color={THEME.colors.dim}>{gutter}</Text>
                                    <Text color={THEME.colors.text}>{line}</Text>
                                </Box>
                            )
                        })
                    )}
                </Box>

                <Box marginTop={1} justifyContent="space-between" flexDirection="row">
                    <Text color={THEME.colors.muted}>
                        Showing lines {outputLines.length > 0 ? effectiveOffset + 1 : 0}-
                        {Math.min(outputLines.length, effectiveOffset + visibleLines.length)} of{' '}
                        {outputLines.length}
                    </Text>
                    <Box flexDirection="row" gap={2}>
                        {statusNotice && <Text color={THEME.colors.success}>{statusNotice}</Text>}
                        {task.status === 'running' && (
                            <Text color={isFollowing ? THEME.colors.brand : THEME.colors.muted}>
                                {isFollowing ? '[following]' : '[paused - press f]'}
                            </Text>
                        )}
                    </Box>
                </Box>

                <MenuFooter
                    items={[
                        { key: '↑/↓', label: 'scroll' },
                        { key: '←/→', label: 'page' },
                        { key: 'g/G', label: 'top/end' },
                        { key: 'f', label: isFollowing ? 'pause' : 'follow' },
                        { key: 'y', label: 'copy' },
                        { key: 'k', label: 'kill' },
                        { key: 'esc', label: 'close' },
                    ]}
                />
            </Box>
        )
    }

    // List View Render
    return (
        <Box flexDirection="column">
            <Box marginBottom={1} justifyContent="space-between" flexDirection="row">
                <Box flexDirection="row" gap={2}>
                    <Text color={THEME.colors.text} bold>
                        Tasks
                    </Text>
                    <Text color={THEME.colors.muted}>
                        ({tasksData.length} {tasksData.length === 1 ? 'task' : 'tasks'})
                    </Text>
                </Box>
            </Box>

            {tasksData.length === 0 ? (
                <Box marginY={1}>
                    <Text color={THEME.colors.muted}>No background tasks.</Text>
                </Box>
            ) : (
                <Box flexDirection="column" marginY={1}>
                    <Box marginBottom={1}>
                        <Text color={THEME.colors.muted} bold>
                            Agent Backgrounded
                        </Text>
                    </Box>
                    {visibleTasks.map((task, idx) => {
                        const isSelected = idx === pageSelectedIndex
                        const cleanCmd =
                            (task.command || '').replace(/\r?\n+/g, ' ').trim() || task.id
                        const timeTag = formatTime(task.createdAt) || `[${task.id}]`

                        return (
                            <Box
                                key={task.id}
                                flexDirection="row"
                                justifyContent="space-between"
                                width="100%"
                            >
                                <Box flexDirection="row" flexShrink={1}>
                                    <Box width={2} flexShrink={0}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.muted
                                            }
                                        >
                                            {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                        </Text>
                                    </Box>
                                    <Box flexShrink={0} marginRight={1}>
                                        <Text color={THEME.colors.dim}>{timeTag}</Text>
                                    </Box>
                                    <Box flexShrink={1}>
                                        <Text
                                            bold={isSelected}
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.text
                                            }
                                            wrap="truncate-end"
                                        >
                                            {cleanCmd}
                                        </Text>
                                    </Box>
                                </Box>
                                <Box flexShrink={0} paddingLeft={2}>
                                    {renderStatusBadge(
                                        task.status,
                                        task.exitCode,
                                        task.createdAt,
                                        task.completedAt
                                    )}
                                </Box>
                            </Box>
                        )
                    })}
                </Box>
            )}

            {/* Pagination info */}
            {tasksData.length > PAGE_SIZE && (
                <Box marginTop={1} justifyContent="space-between" flexDirection="row">
                    <Text color={THEME.colors.muted}>
                        [{startIndex + 1}-{Math.min(startIndex + PAGE_SIZE, tasksData.length)} of{' '}
                        {tasksData.length} tasks]
                    </Text>
                    {totalPages > 1 && (
                        <Text color={THEME.colors.muted}>
                            Page {currentPage + 1}/{totalPages} (←/→)
                        </Text>
                    )}
                </Box>
            )}

            {/* Footer */}
            <MenuFooter
                items={[
                    { key: '↑/↓', label: 'navigate' },
                    ...(totalPages > 1 ? [{ key: '←/→', label: 'page' }] : []),
                    { key: 'enter', label: 'view logs' },
                    { key: 'k', label: 'kill' },
                    { key: 'x', label: 'remove' },
                    { key: 'c', label: 'clear finished' },
                    { key: 'esc', label: 'close' },
                ]}
            />
        </Box>
    )
}
