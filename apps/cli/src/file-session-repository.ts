import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { SessionRepository } from '@december/agent'
import { AgentMessage } from '@december/shared'

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

    async saveContext(sessionId: string, messages: AgentMessage[]): Promise<void> {
        await fs.mkdir(this.sessionDir, { recursive: true })
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)
        // Append all messages to the file. (In a real DB, we'd upsert by ID)
        // For local files, we just write the whole array to ensure it's saved.
        // Wait, to truly support branching in the same file, we can't just overwrite.
        // But if we append everything every time, it gets huge.
        // Let's read existing, merge by ID, and write back.
        const existing: Record<string, AgentMessage> = {}
        try {
            const data = await fs.readFile(historyPath, 'utf-8')
            const lines = data.split('\n').filter((l) => l.trim().length > 0)
            for (const l of lines) {
                const msg = JSON.parse(l) as AgentMessage
                if (msg.id) existing[msg.id] = msg
            }
        } catch (e) {}

        for (const msg of messages) {
            if (msg.id) existing[msg.id] = msg
        }

        const content = Object.values(existing)
            .map((m) => JSON.stringify(m))
            .join('\n')
        await fs.writeFile(historyPath, content, 'utf-8')
    }

    async loadContext(sessionId: string): Promise<AgentMessage[]> {
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)
        try {
            const data = await fs.readFile(historyPath, 'utf-8')
            const lines = data.split('\n').filter((l) => l.trim().length > 0)
            const msgs = lines.map((l) => JSON.parse(l) as AgentMessage)

            // Reconstruct the active branch (the one ending with the latest message)
            if (msgs.length === 0) return []

            // Find the latest message by timestamp
            let latestMsg = msgs[0]
            for (const msg of msgs) {
                if ((msg.timestamp || 0) >= (latestMsg.timestamp || 0)) {
                    latestMsg = msg
                }
            }

            // Walk back up the tree using parentId
            const branch: AgentMessage[] = []
            const msgMap = new Map(msgs.map((m) => [m.id, m]))

            let current: AgentMessage | undefined = latestMsg
            while (current) {
                branch.unshift(current)
                if (!current.parentId) break
                current = msgMap.get(current.parentId)
            }

            return branch
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
