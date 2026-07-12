import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { Message } from '@december/shared'

import { SessionRepository } from './session-repository'

export interface SessionInfo {
    id: string
    updatedAt: Date
    messageCount: number
    preview: string // First user message or empty
}

export class FileSessionRepository implements SessionRepository {
    private sessionDir: string

    constructor(sessionDir?: string) {
        this.sessionDir = sessionDir || path.join(os.homedir(), '.config', 'december', 'sessions')
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

    async listSessions(): Promise<SessionInfo[]> {
        try {
            await fs.mkdir(this.sessionDir, { recursive: true })
            const files = await fs.readdir(this.sessionDir)
            const sessions: SessionInfo[] = []

            for (const file of files) {
                if (!file.endsWith('.jsonl')) continue
                const id = file.replace('.jsonl', '')
                const filePath = path.join(this.sessionDir, file)
                try {
                    const stat = await fs.stat(filePath)
                    const data = await fs.readFile(filePath, 'utf-8')
                    const lines = data.split('\n').filter((l) => l.trim().length > 0)

                    // Find first user message for preview
                    let preview = ''
                    for (const line of lines) {
                        try {
                            const msg = JSON.parse(line)
                            if (msg.role === 'user') {
                                preview = msg.content?.substring(0, 80) || ''
                                break
                            }
                        } catch {}
                    }

                    sessions.push({
                        id,
                        updatedAt: stat.mtime,
                        messageCount: lines.length,
                        preview,
                    })
                } catch {}
            }

            // Sort by most recently updated first
            sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            return sessions
        } catch {
            return []
        }
    }

    async deleteSession(sessionId: string): Promise<void> {
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)
        try {
            await fs.unlink(historyPath)
        } catch (e) {
            // Ignore if it doesn't exist
        }
    }

    async renameSession(oldSessionId: string, newSessionId: string): Promise<void> {
        const oldPath = path.join(this.sessionDir, `${oldSessionId}.jsonl`)
        const newPath = path.join(this.sessionDir, `${newSessionId}.jsonl`)
        await fs.rename(oldPath, newPath)
    }
}
