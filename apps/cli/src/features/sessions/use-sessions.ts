import { useState } from 'react'

import type { SessionInfo } from '../../file-session-repository'

export function useSessions() {
    const [sessionItems, setSessionItems] = useState<{ label: string; value: string }[]>([])
    const [sessionsData, setSessionsData] = useState<SessionInfo[]>([])
    const [sessionPage, setSessionPage] = useState(0)
    const [sessionSelectedIndex, setSessionSelectedIndex] = useState(0)
    const [sessionRenameMode, setSessionRenameMode] = useState(false)
    const [sessionNewName, setSessionNewName] = useState('')

    return {
        sessionItems,
        setSessionItems,
        sessionsData,
        setSessionsData,
        sessionPage,
        setSessionPage,
        sessionSelectedIndex,
        setSessionSelectedIndex,
        sessionRenameMode,
        setSessionRenameMode,
        sessionNewName,
        setSessionNewName,
    }
}
