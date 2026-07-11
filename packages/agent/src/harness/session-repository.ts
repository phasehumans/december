import { Message } from '../types'

export interface SessionRepository {
    saveContext(sessionId: string, messages: Message[]): Promise<void>
    loadContext(sessionId: string): Promise<Message[]>
    deleteSession?(sessionId: string): Promise<void>
    renameSession?(oldSessionId: string, newSessionId: string): Promise<void>
}
