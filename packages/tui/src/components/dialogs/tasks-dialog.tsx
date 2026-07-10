import { taskManager, BackgroundTask } from '@december/agent'
import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect } from 'react'

import { useKeyboardLayer } from '../../providers/keyboard-layer'

type Props = {
    close: () => void
    toast: any
}

export function TasksDialog({ close, toast }: Props) {
    const { isTopLayer } = useKeyboardLayer()
    const [tasks, setTasks] = useState<BackgroundTask[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [viewingTaskId, setViewingTaskId] = useState<string | null>(null)
    const [scrollOffset, setScrollOffset] = useState(0)

    // Poll/update tasks list in real-time (every 500ms)
    useEffect(() => {
        const update = () => {
            setTasks([...taskManager.getTasks()])
        }
        update()
        const interval = setInterval(update, 500)
        return () => clearInterval(interval)
    }, [])

    useInput((input, key) => {
        if (!isTopLayer('dialog')) return

        if (viewingTaskId) {
            if (key.escape) {
                setViewingTaskId(null)
            } else if (key.upArrow) {
                setScrollOffset((prev) => Math.max(0, prev - 1))
            } else if (key.downArrow) {
                setScrollOffset((prev) => prev + 1)
            } else if (key.leftArrow) {
                setScrollOffset((prev) => Math.max(0, prev - 15))
            } else if (key.rightArrow) {
                setScrollOffset((prev) => prev + 15)
            }
            return
        }

        if (key.escape) {
            close()
            return
        }

        const currentTask = tasks[selectedIndex]

        if (key.upArrow) {
            setSelectedIndex((prev) => Math.max(0, prev - 1))
        } else if (key.downArrow) {
            setSelectedIndex((prev) => Math.min(tasks.length - 1, prev + 1))
        } else if (key.return && currentTask) {
            setViewingTaskId(currentTask.id)
            setScrollOffset(0)
        } else if (input === 'k' && currentTask) {
            const killed = taskManager.killTask(currentTask.id)
            if (killed) {
                toast.show({ variant: 'success', message: `Task ${currentTask.id} killed.` })
            } else {
                toast.show({ variant: 'error', message: `Task ${currentTask.id} is not running.` })
            }
            setTasks([...taskManager.getTasks()])
        } else if (input === 'x' && currentTask) {
            taskManager.removeTask(currentTask.id)
            toast.show({ message: `Task ${currentTask.id} removed from list.` })
            const nextTasks = taskManager.getTasks()
            setTasks(nextTasks)
            setSelectedIndex((prev) => Math.min(nextTasks.length - 1, Math.max(0, prev)))
        }
    })

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running':
                return '#2ECC71' // green
            case 'completed':
                return '#3498DB' // blue
            case 'failed':
                return '#E74C3C' // red
            case 'killed':
                return '#F1C40F' // yellow
            default:
                return 'white'
        }
    }

    if (viewingTaskId) {
        const task = tasks.find((t) => t.id === viewingTaskId)
        if (!task) {
            setViewingTaskId(null)
            return null
        }

        const outputLines = task.output.split('\n')
        const visibleLines = outputLines.slice(scrollOffset, scrollOffset + 15)

        return (
            <Box flexDirection="column" gap={1}>
                <Box borderStyle="single" borderColor="#444444" flexDirection="column" padding={1}>
                    <Box justifyContent="space-between">
                        <Text bold color="#89B4F8">
                            Task: {task.id}
                        </Text>
                        <Text bold color={getStatusColor(task.status)}>
                            [{task.status.toUpperCase()}]
                        </Text>
                    </Box>
                    <Box marginTop={1} marginBottom={1}>
                        <Text color="#AAAAAA" bold>
                            Cmd: {task.command}
                        </Text>
                    </Box>
                    <Box
                        borderColor="#333333"
                        borderStyle="round"
                        flexDirection="column"
                        minHeight={8}
                        paddingX={1}
                    >
                        {visibleLines.length === 0 ||
                        (visibleLines.length === 1 && visibleLines[0] === '') ? (
                            <Text color="gray">[No output recorded yet]</Text>
                        ) : (
                            visibleLines.map((line, idx) => (
                                <Text key={idx} color="white">
                                    {line}
                                </Text>
                            ))
                        )}
                    </Box>
                    <Box marginTop={1} justifyContent="space-between">
                        <Text color="gray">
                            Showing lines {Math.min(outputLines.length, scrollOffset + 1)}-
                            {Math.min(outputLines.length, scrollOffset + visibleLines.length)} of{' '}
                            {outputLines.length}
                        </Text>
                    </Box>
                </Box>
                <Text color="gray">Keyboard: ↑/↓ Scroll Line · ←/→ Page · esc Back</Text>
            </Box>
        )
    }

    return (
        <Box flexDirection="column" gap={1}>
            <Box borderStyle="single" borderColor="#444444" flexDirection="column" padding={1}>
                <Text bold color="#89B4F8">
                    Tasks
                </Text>
                {tasks.length === 0 ? (
                    <Box marginTop={1} paddingLeft={2}>
                        <Text color="gray">No background tasks.</Text>
                    </Box>
                ) : (
                    <Box marginTop={1} flexDirection="column">
                        {tasks.map((task, idx) => {
                            const isSelected = idx === selectedIndex
                            const truncatedCommand =
                                task.command.length > 35
                                    ? task.command.slice(0, 32) + '...'
                                    : task.command
                            return (
                                <Box key={task.id}>
                                    <Text color="#89B4F8">{isSelected ? '❭ ' : '  '}</Text>
                                    <Box gap={2}>
                                        <Text color="white" bold={isSelected}>
                                            {task.id}
                                        </Text>
                                        <Text color={getStatusColor(task.status)}>
                                            [{task.status.toUpperCase()}]
                                        </Text>
                                        <Text color={isSelected ? 'white' : 'gray'}>
                                            {truncatedCommand}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}
                    </Box>
                )}
            </Box>
            <Text color="gray">
                Keyboard: ↑/↓ Navigate · enter View output · k Kill Task · x Remove Task From List ·
                esc Close
            </Text>
        </Box>
    )
}
