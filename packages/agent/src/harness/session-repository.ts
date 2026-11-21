import type { SessionMeta } from '../session-title'
import type { AgentMessage } from '@december/shared'

export interface SessionRepository {
    saveContext(sessionId: string, messages: AgentMessage[]): Promise<void>
    loadContext(sessionId: string): Promise<AgentMessage[]>
    deleteSession?(sessionId: string): Promise<void>
    hasSession?(sessionId: string): Promise<boolean>
    listSessions?(): Promise<any[]>
    /** reads display metadata (title) kept next to the session. null when there is none. */
    getSessionMeta?(sessionId: string): Promise<SessionMeta | null>
    /** writes display metadata. the session id and its history do not change. */
    setSessionMeta?(sessionId: string, meta: SessionMeta): Promise<void>
}
