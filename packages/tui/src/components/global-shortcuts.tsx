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
        setCurrentPlannedPrompt,
        tasksData,
        handleKillTask,
    } = session

    useInput((input, key) => {
        if (authMode !== 'none') {
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

        if (session.planRefineMode) {
            if (key.escape && session.setPlanRefineMode) {
                session.setPlanRefineMode(false)
            }
            return
        }

        if (session.btwState) {
            if (key.escape || input === '\u001B') {
                if (session.handleDismissBtw) {
                    session.handleDismissBtw()
                }
            }
            return
        }

        if (session.pendingDeviceAuthUrl) {
            if (input === 'o' || input === 'O') {
                if (session.handleOpenDeviceAuthUrl) {
                    session.handleOpenDeviceAuthUrl()
                }
            } else if (key.escape || input === '\u001B') {
                session.handleAbort()
            }
            return
        }

        if (session.isStreaming && (key.escape || input === '\u001B')) {
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
        }
    })

    return null
}
