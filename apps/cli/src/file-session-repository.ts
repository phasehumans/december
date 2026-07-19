import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { SessionRepository } from '@december/agent'
import { AgentMessage } from '@december/shared'

export interface SessionInfo {
    id: string
    updatedAt: Date
    messageCount: number
    preview: string // first user message or empty
}

export class FileSessionRepository implements SessionRepository {
    private sessionDir: string
    private sessionCache: Record<string, Record<string, AgentMessage>> = {}

    constructor(sessionDir?: string) {
        this.sessionDir = sessionDir || path.join(os.homedir(), '.config', 'december', 'sessions')
    }

    async saveContext(sessionId: string, messages: AgentMessage[]): Promise<void> {
        await fs.mkdir(this.sessionDir, { recursive: true })
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)

        let existing = this.sessionCache[sessionId]
        if (!existing) {
            existing = {}
            this.sessionCache[sessionId] = existing
            try {
                const data = await fs.readFile(historyPath, 'utf-8')
                const lines = data.split('\n').filter((l) => l.trim().length > 0)
                for (const l of lines) {
                    try {
                        const msg = JSON.parse(l) as AgentMessage
                        if (msg.id) existing[msg.id] = msg
                    } catch {}
                }
            } catch (e) {}
        }

        let appendContent = ''
        for (const msg of messages) {
            if (msg.id) {
                const cached = existing[msg.id]
                if (!cached || JSON.stringify(cached) !== JSON.stringify(msg)) {
                    existing[msg.id] = { ...msg }
                    appendContent += JSON.stringify(msg) + '\n'
                }
            }
        }

        if (appendContent) {
            await fs.appendFile(historyPath, appendContent, 'utf-8')
        }
    }

    async loadContext(sessionId: string): Promise<AgentMessage[]> {
        const historyPath = path.join(this.sessionDir, `${sessionId}.jsonl`)
        try {
            const data = await fs.readFile(historyPath, 'utf-8')
            const lines = data.split('\n').filter((l) => l.trim().length > 0)

            const msgMap = new Map<string, AgentMessage>()
            for (const l of lines) {
                try {
                    const msg = JSON.parse(l) as AgentMessage
                    if (msg.id) msgMap.set(msg.id, msg)
                } catch {
                    // ignore corrupted lines
                }
            }

            const msgs = Array.from(msgMap.values())
            if (msgs.length === 0) return []

            let latestMsg = msgs[0]
            for (const msg of msgs) {
                if ((msg.timestamp || 0) >= (latestMsg.timestamp || 0)) {
                    latestMsg = msg
                }
            }

            const branch: AgentMessage[] = []
            let current: AgentMessage | undefined = latestMsg
            while (current) {
                branch.unshift(current)
                if (!current.parentId) break
                current = msgMap.get(current.parentId)
            }

            // compaction: clean up token-deltas from previous streaming sessions
            if (msgs.length < lines.length) {
                const compacted = msgs.map((m) => JSON.stringify(m)).join('\n')
                await fs.writeFile(historyPath, compacted, 'utf-8').catch(() => {})
            }

            // warm up cache
            const cacheObj: Record<string, AgentMessage> = {}
            for (const msg of msgs) {
                cacheObj[msg.id] = { ...msg }
            }
            this.sessionCache[sessionId] = cacheObj

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

                    // find first user message for preview
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

            // sort by most recently updated first
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
            // ignore if it doesn't exist
        }
    }

    async renameSession(oldSessionId: string, newSessionId: string): Promise<void> {
        const oldPath = path.join(this.sessionDir, `${oldSessionId}.jsonl`)
        const newPath = path.join(this.sessionDir, `${newSessionId}.jsonl`)
        await fs.rename(oldPath, newPath)
    }
}
