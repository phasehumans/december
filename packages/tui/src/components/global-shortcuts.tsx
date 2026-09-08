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
        taskSelectedIndex,
        setTaskSelectedIndex,
        sessionRenameMode,
        setSessionRenameMode,
        customInputMode,
        setCustomInputMode,
        grillMode,
        setGrillMode,
        setGrillQuestions,
        setCurrentGrillIndex,
        setGrillAnswers,
        setGrillPrompt,
        setCurrentPlannedPrompt,
        tasksData,
        handleKillTask,
    } = session

    useInput((input, key) => {
        if (authMode === 'tasks_mode') {
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

        if (session.planRefineMode) {
            if (key.escape && session.setPlanRefineMode) {
                session.setPlanRefineMode(false)
            }
            return
        }

        if (authMode === 'session_select') {
            return
        }

        if (authMode !== 'none') {
            if (key.escape && authMode !== 'menu') {
                if (session.isStreaming) {
                    return
                }
                if (authMode === 'grill_question') {
                    setGrillQuestions([])
                    setCurrentGrillIndex(0)
                    setGrillAnswers([])
                    setGrillPrompt(null)
                    setCustomInputMode(false)
                    setGrillMode(false)
                } else if (authMode === 'byok_key') {
                    if (session.setAuthError) {
                        session.setAuthError(null)
                    }
                    if (session.setApiKey) {
                        session.setApiKey('')
                    }
                }
                setAuthMode('none')
            }
            return
        }

        if (session.isStreaming && key.escape) {
            session.handleAbort()
            return
        }

        if (key.ctrl && input === 'l') {
            setAuthMode('menu')
        } else if (key.ctrl && input === 'h') {
            if (session.sessionRepository?.listSessions) {
                session.sessionRepository
                    .listSessions()
                    .then((sessions: any[]) => {
                        if (session.setSessionsData) session.setSessionsData(sessions)
                        if (session.setSessionPage) session.setSessionPage(0)
                        if (session.setSessionSelectedIndex) session.setSessionSelectedIndex(0)
                        if (session.setSessionRenameMode) session.setSessionRenameMode(false)
                        setAuthMode('session_select')
                    })
                    .catch(() => {
                        setAuthMode('session_select')
                    })
            } else {
                setAuthMode('session_select')
            }
        } else if (key.ctrl && input === 't') {
            setAuthMode('tasks_mode')
        } else if (
            (key.ctrl && ((key as any).name === 'o' || input?.toLowerCase() === 'o')) ||
            input === '\x0f'
        ) {
            if (session.toggleExpandCommands) {
                session.toggleExpandCommands()
            }
        }
    })

    return null
}
