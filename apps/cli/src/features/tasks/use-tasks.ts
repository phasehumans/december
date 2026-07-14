import { useState } from 'react'

import type { BackgroundTask } from '@december/agent'

export function useTasks() {
    const [tasksData, setTasksData] = useState<BackgroundTask[]>([])
    const [taskSelectedIndex, setTaskSelectedIndex] = useState(0)
    const [taskViewingId, setTaskViewingId] = useState<string | null>(null)
    const [taskScrollOffset, setTaskScrollOffset] = useState(0)

    return {
        tasksData,
        setTasksData,
        taskSelectedIndex,
        setTaskSelectedIndex,
        taskViewingId,
        setTaskViewingId,
        taskScrollOffset,
        setTaskScrollOffset,
    }
}
