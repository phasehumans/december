import { Message } from '../types'

export interface SessionRepository {
    saveContext(sessionId: string, messages: Message[]): Promise<void>
    loadContext(sessionId: string): Promise<Message[]>
}
