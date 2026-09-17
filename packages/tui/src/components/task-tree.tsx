import { Box, Text } from 'ink'
import React, { useState, useEffect } from 'react'

import { THEME } from '../theme'

import { Spinner } from './spinner'

export interface TaskItem {
    id: string
    command: string
    status: 'running' | 'completed' | 'failed' | 'killed'
    createdAt?: Date | number
    completedAt?: Date | number
    exitCode?: number | null
    output?: string
}

export interface TaskTreeProps {
    tasks: TaskItem[]
}

function formatDuration(start?: Date | number, end?: Date | number): string {
    if (!start) return ''
    const s = typeof start === 'number' ? start : start.getTime()
    const e = end ? (typeof end === 'number' ? end : end.getTime()) : Date.now()
    const sec = Math.max(0.1, Math.round(((e - s) / 1000) * 10) / 10)
    return `${sec.toFixed(1)}s`
}

export const TaskTree = React.memo(function TaskTree({ tasks }: TaskTreeProps) {
    const [, setTick] = useState(0)

    const runningTasks = tasks.filter((t) => t.status === 'running')
    const hasRunning = runningTasks.length > 0

    useEffect(() => {
        if (!hasRunning) return
        const timer = setInterval(() => {
            setTick((t) => t + 1)
        }, 500)
        return () => clearInterval(timer)
    }, [hasRunning])

    if (!tasks || tasks.length === 0) return null

    const runningCount = runningTasks.length
    const completedCount = tasks.filter((t) => t.status === 'completed').length

    const headerLabel =
        runningCount > 0
            ? `Background Tasks (${runningCount} running)`
            : `Background Tasks (${completedCount} completed)`

    return (
        <Box flexDirection="column" marginY={1}>
            <Box flexDirection="row" gap={1} alignItems="center">
                <Text color={runningCount > 0 ? THEME.colors.brand : THEME.colors.success}>
                    {runningCount > 0 ? THEME.glyphs.status : '✓'}
                </Text>
                <Text color={runningCount > 0 ? THEME.colors.brand : THEME.colors.success} bold>
                    {headerLabel}
                </Text>
            </Box>

            <Box flexDirection="column" paddingLeft={1} marginTop={0}>
                {tasks.map((task, idx) => {
                    const isLast = idx === tasks.length - 1
                    const prefix = isLast ? '└─ ' : '├─ '
                    const duration = formatDuration(task.createdAt, task.completedAt)

                    let statusText = ''
                    if (task.status === 'running') {
                        statusText = `(running · ${duration})`
                    } else if (task.status === 'completed') {
                        statusText = `(passed · ${duration})`
                    } else if (task.status === 'failed') {
                        statusText = `(failed code ${task.exitCode ?? 1} · ${duration})`
                    } else if (task.status === 'killed') {
                        statusText = `(killed · ${duration})`
                    }

                    const lastLine = task.output
                        ? task.output.trim().split(/\r?\n/).slice(-1)[0]
                        : undefined

                    return (
                        <Box key={task.id} flexDirection="column">
                            <Box flexDirection="row" gap={1} alignItems="center">
                                <Text color={THEME.colors.dim}>{prefix}</Text>
                                {task.status === 'running' ? (
                                    <Spinner />
                                ) : task.status === 'completed' ? (
                                    <Text color={THEME.colors.success}>✓</Text>
                                ) : (
                                    <Text color={THEME.colors.error}>✗</Text>
                                )}
                                <Text color={THEME.colors.text} bold>
                                    {task.command}
                                </Text>
                                <Text color={THEME.colors.muted}>{statusText}</Text>
                            </Box>

                            {task.status === 'running' && lastLine && (
                                <Box flexDirection="row" paddingLeft={isLast ? 3 : 3}>
                                    <Text color={THEME.colors.dim}>│ </Text>
                                    <Text color={THEME.colors.muted} wrap="truncate-end">
                                        {lastLine}
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    )
                })}
            </Box>
        </Box>
    )
})
