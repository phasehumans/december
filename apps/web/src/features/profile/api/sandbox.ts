import { apiRequest } from '@/shared/api/client'

export type IdleStopMinutes = 10 | 30 | 60
/** null: never archive */
export type ArchiveAfterDays = 7 | 30 | null

export type SetupCommands = {
    /** `owner/name`, in lower case */
    repoFullName: string
    commands: string
}

export type SandboxSettings = {
    idleStopMinutes: IdleStopMinutes
    archiveAfterDays: ArchiveAfterDays
    setupCommands: SetupCommands[]
}

export type RunningSandbox = {
    sessionId: string
    title: string | null
    repoFullName: string | null
    startedAt: string
    costInCents: number
    sandboxStatus: 'STARTING' | 'RUNNING'
}

/** the state a stop leads to. the worker gets there a moment later */
export type StoppedSession = {
    sessionId: string
    vmStatus: string
    sandboxStatus: string | null
}

const getSettings = () => apiRequest<SandboxSettings>('/setting/sandbox')

const updateSettings = (
    patch: Partial<Pick<SandboxSettings, 'idleStopMinutes' | 'archiveAfterDays'>>
) =>
    apiRequest<SandboxSettings>('/setting/sandbox', {
        method: 'PATCH',
        body: JSON.stringify(patch),
    })

/** an empty text removes the setup commands of the repository */
const setSetupCommands = (data: SetupCommands) =>
    apiRequest<SandboxSettings>('/setting/sandbox/setup-commands', {
        method: 'PUT',
        body: JSON.stringify(data),
    })

const getRunning = () => apiRequest<{ items: RunningSandbox[] }>('/session/sandboxes')

const stop = (sessionId: string) =>
    apiRequest<StoppedSession>(`/session/${encodeURIComponent(sessionId)}/stop`, {
        method: 'POST',
    })

export const sandboxAPI = {
    getSettings,
    updateSettings,
    setSetupCommands,
    getRunning,
    stop,
}
