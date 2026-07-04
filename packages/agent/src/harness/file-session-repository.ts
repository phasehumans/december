import fs from 'node:fs/promises'
import path from 'node:path'
import { Message } from '../types'
import { SessionRepository } from './session-repository'

export class FileSessionRepository implements SessionRepository {
    private sessionDir: string

    constructor(sessionDir?: string) {
        this.sessionDir = sessionDir || path.join(process.cwd(), '.december', 'sessions')
    }

    async saveContext(sessionId: string, messages: Message[]): Promise<void> {
        await fs.mkdir(this.sessionDir, { recursive: true })
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)
        const content = messages.map((m) => JSON.stringify(m)).join('\n')
        await fs.writeFile(historyPath, content, 'utf-8')
    }

    async loadContext(sessionId: string): Promise<Message[]> {
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)
        try {
            const data = await fs.readFile(historyPath, 'utf-8')
            const lines = data.split('\n').filter((l) => l.trim().length > 0)
            return lines.map((l) => JSON.parse(l))
        } catch (e) {
            return []
        }
    }
}
