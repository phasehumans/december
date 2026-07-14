import { useInput, useApp } from 'ink'

import { useToast } from '../providers/toast'

export function GlobalShortcuts(session: any) {
    const { exit } = useApp()
    const toast = useToast()

    const {
        authMode,
        setAuthMode,
        taskViewingId,
        setTaskViewingId,
        taskScrollOffset,
        setTaskScrollOffset,
        sessionRenameMode,
        setSessionRenameMode,
        customInputMode,
        setCustomInputMode,
        planMode,
        setPlanMode,
        grillMode,
        setGrillMode,
        grillQuestions,
        setGrillQuestions,
        setCurrentGrillIndex,
        setGrillAnswers,
        setGrillPrompt,
        setCurrentPlannedPrompt,
        tasksData,
    } = session

    useInput((input, key) => {
        if (authMode === 'tasks_mode') {
            if (key.escape) {
                if (taskViewingId) {
                    setTaskViewingId(null)
                    setTaskScrollOffset(0)
                } else {
                    setAuthMode('none')
                }
            }
            if (taskViewingId && key.upArrow)
                setTaskScrollOffset((prev: number) => Math.max(0, prev - 1))
            if (taskViewingId && key.downArrow) setTaskScrollOffset((prev: number) => prev + 1)
            return
        }

        if (sessionRenameMode) {
            if (key.escape) setSessionRenameMode(false)
            return
        }

        if (customInputMode) {
            if (key.escape) setCustomInputMode(false)
            return
        }

        if (planMode) {
            if (key.escape) {
                setPlanMode(false)
                setCurrentPlannedPrompt(null)
                toast.show({ variant: 'error', message: 'Plan rejected.' })
            }
            return
        }

        if (grillMode) {
            if (key.escape) {
                setGrillMode(false)
                setGrillQuestions([])
                setCurrentGrillIndex(0)
                setGrillAnswers([])
                setGrillPrompt(null)
            }
            return
        }

        if (authMode !== 'none') {
            if (key.escape && authMode !== 'login') {
                setAuthMode('none')
            }
            return
        }

        if (key.ctrl && input === 'l') {
            setAuthMode('login')
        } else if (key.ctrl && input === 'h') {
            setAuthMode('sessions')
        } else if (key.ctrl && input === 'k') {
            setAuthMode('settings')
        } else if (key.ctrl && input === 't') {
            setAuthMode('tasks_mode')
        }
    })

    return null
}
