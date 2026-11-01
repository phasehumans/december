import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { DifferentialApp } from '@december/tui'
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'

import { FileSessionRepository } from '../../src/file-session-repository'
import { convertAgentMessagesToDifferentialMessages } from '../../src/utils/message-converter'

describe('Session Resume & Management Integration', () => {
    let tmpDir: string
    let sessionRepo: FileSessionRepository

    beforeEach(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'december-session-test-'))
        sessionRepo = new FileSessionRepository(tmpDir)

        // Seed mock sessions
        await sessionRepo.saveContext('sess-alpha', [
            { id: 'msg-1', role: 'user', content: 'Design an authentication system' } as any,
            { id: 'msg-2', role: 'assistant', content: 'Here is the auth system plan' } as any,
        ])

        await sessionRepo.saveContext('sess-beta', [
            { id: 'msg-3', role: 'user', content: 'Fix memory leak in renderer' } as any,
            {
                id: 'msg-4',
                role: 'assistant',
                thinking: 'Checking memory allocation',
                toolCalls: [
                    {
                        id: 'tc-1',
                        name: 'grep_search',
                        input: { query: 'leak' },
                    },
                ],
            } as any,
            {
                id: 'msg-5',
                role: 'tool',
                toolCallId: 'tc-1',
                content: 'Found 2 allocations in buffer.ts',
            } as any,
            { id: 'msg-6', role: 'assistant', content: 'Fixed the leak.' } as any,
        ])
    })

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true })
    })

    it('lists sessions from FileSessionRepository and populates DifferentialApp', async () => {
        const sessions = await sessionRepo.listSessions()
        expect(sessions.length).toBe(2)

        const app = new DifferentialApp({
            terminal: {
                write: () => {},
                onKey: () => () => {},
                onResize: () => () => {},
                cursor: { moveTo: () => {}, hide: () => {}, show: () => {} },
                clearScreen: () => {},
                enterAltScreen: () => {},
                exitAltScreen: () => {},
            } as any,
            width: 80,
            height: 24,
            sessions: sessions.map((s) => ({
                id: s.id,
                preview: s.preview || s.id,
                updatedAt: s.updatedAt,
                messageCount: s.messageCount,
            })),
            sessionRepository: sessionRepo,
            onSessionSelect: async (id) => {
                const loaded = await sessionRepo.loadContext(id)
                app.state.messages = convertAgentMessagesToDifferentialMessages(loaded)
                app.state.sessionId = id
            },
        })

        // 1. Open session overlay via /resume command
        app.executeCommand('resume')
        expect(app.state.activeOverlay).toBe('session')
        expect(app.state.sessions.length).toBe(2)

        // 2. Select sess-beta
        const betaIndex = app.state.sessions.findIndex((s) => s.id === 'sess-beta')
        expect(betaIndex).toBeGreaterThanOrEqual(0)
        app.state.sessionSelectedIndex = betaIndex

        // Press Enter to select
        app.handleKey('\r')
        expect(app.state.activeOverlay).toBe('none')
        expect(app.state.sessionId).toBe('sess-beta')

        // Wait for async loadContext & message rehydration
        await new Promise((r) => setTimeout(r, 20))
        expect(app.state.messages.length).toBe(4)
        expect(app.state.messages[0].role).toBe('user')
        expect(app.state.messages[0].content).toContain('Fix memory leak')
        expect(app.state.messages[1].role).toBe('thinking')
        expect(app.state.messages[2].role).toBe('tool')
        expect(app.state.messages[2].toolCall?.output).toContain('Found 2 allocations')
        expect(app.state.messages[3].role).toBe('assistant')
        expect(app.state.messages[3].content).toBe('Fixed the leak.')

        app.stop()
    })

    it('renames session file on disk when using onSessionRename', async () => {
        const app = new DifferentialApp({
            terminal: {
                write: () => {},
                onKey: () => () => {},
                onResize: () => () => {},
                cursor: { moveTo: () => {}, hide: () => {}, show: () => {} },
                clearScreen: () => {},
                enterAltScreen: () => {},
                exitAltScreen: () => {},
            } as any,
            width: 80,
            height: 24,
            sessions: [
                { id: 'sess-alpha', preview: 'Design an auth system', updatedAt: Date.now() },
            ],
            sessionRepository: sessionRepo,
            onSessionRename: async (oldId, newId) => {
                await sessionRepo.renameSession(oldId, newId)
            },
        })

        app.executeCommand('session')
        app.handleKey('r')
        expect(app.state.sessionRenameMode).toBe(true)
        app.state.sessionRenameValue = 'auth-architecture'
        app.handleKey('\r')

        // Give async rename a moment
        await new Promise((r) => setTimeout(r, 20))

        const sessionsAfter = await sessionRepo.listSessions()
        const found = sessionsAfter.find((s) => s.id === 'auth-architecture')
        expect(found).toBeDefined()
        const oldFound = sessionsAfter.find((s) => s.id === 'sess-alpha')
        expect(oldFound).toBeUndefined()

        app.stop()
    })

    it('deletes session file on disk when using onSessionDelete', async () => {
        const app = new DifferentialApp({
            terminal: {
                write: () => {},
                onKey: () => () => {},
                onResize: () => () => {},
                cursor: { moveTo: () => {}, hide: () => {}, show: () => {} },
                clearScreen: () => {},
                enterAltScreen: () => {},
                exitAltScreen: () => {},
            } as any,
            width: 80,
            height: 24,
            sessions: [
                { id: 'sess-alpha', preview: 'Design an auth system', updatedAt: Date.now() },
            ],
            sessionRepository: sessionRepo,
            onSessionDelete: async (id) => {
                await sessionRepo.deleteSession(id)
            },
        })

        app.executeCommand('session')
        app.handleKey('d')
        expect(app.state.sessionConfirmDeleteId).toBe('sess-alpha')
        app.handleKey('y')

        await new Promise((r) => setTimeout(r, 20))

        const sessionsAfter = await sessionRepo.listSessions()
        expect(sessionsAfter.find((s) => s.id === 'sess-alpha')).toBeUndefined()

        app.stop()
    })
})
