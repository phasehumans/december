import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

import { ConversationManager, MAX_WORKSPACE_MEMORY_BYTES } from '../../../agent/src'
import { prisma } from '../../src/index'

import type { LLMProvider, Message, ProviderStreamChunk } from '@december/providers'

class SimpleMockLLM implements LLMProvider {
    public id = 'simple-mock'
    public calls: any[] = []
    public responseText = 'Structured Memory Summary Checkpoint'

    async *stream(
        messages: Message[],
        _tools?: any,
        _systemPrompt?: string,
        _modelOptions?: any,
        signal?: AbortSignal
    ): AsyncGenerator<ProviderStreamChunk, void, unknown> {
        this.calls.push(messages)
        if (signal?.aborted) {
            throw new Error('Aborted')
        }
        yield { type: 'text', text: this.responseText }
    }
}

describe('Project Entity, Context Inheritance & Bounded Memory (Integration)', () => {
    let testUserId: string
    let testProjectId: string
    let testSessionId: string
    let dbAvailable = false
    let tmpDir: string

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-memory-test-'))

        try {
            await prisma.$queryRaw`SELECT 1`
            dbAvailable = true

            // 1. Create User
            const user = await prisma.user.create({
                data: {
                    name: 'Project Test User',
                    email: `project-user-${Date.now()}@example.com`,
                    username: `projuser_${Date.now()}`,
                },
            })
            testUserId = user.id

            // 2. Create Project
            const project = await prisma.project.create({
                data: {
                    name: 'December Runtime Project',
                    description: 'Persistent project anchor for agent sessions',
                    userId: testUserId,
                    repoOwner: 'phasehumans',
                    repoName: 'december',
                    repoUrl: 'https://github.com/phasehumans/december',
                    defaultBranch: 'main',
                    pinnedRules:
                        'pinned: adhere strictly to AGENTS.md and lowercase git conventions',
                },
            })
            testProjectId = project.id

            // 3. Create Child Session linked to Project
            const session = await prisma.session.create({
                data: {
                    title: 'Project Child Session',
                    userId: testUserId,
                    projectId: testProjectId,
                    type: 'WEB',
                    epoch: 1,
                    status: 'IDLE',
                },
            })
            testSessionId = session.id
        } catch (err) {
            console.warn('Postgres test database unavailable for integration test:', err)
            dbAvailable = false
        }
    })

    afterAll(async () => {
        if (tmpDir && fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true })
        }

        if (dbAvailable && testUserId) {
            try {
                await prisma.user.delete({ where: { id: testUserId } })
            } catch {
                // Intentionally swallowed: cleanup error
            }
            await prisma.$disconnect()
        }
    })

    it('persists project entity with repository metadata and pinned instructions', async () => {
        if (!dbAvailable) return

        const fetchedProject = await prisma.project.findUnique({
            where: { id: testProjectId },
            include: { sessions: true },
        })

        expect(fetchedProject).toBeDefined()
        expect(fetchedProject!.name).toBe('December Runtime Project')
        expect(fetchedProject!.repoName).toBe('december')
        expect(fetchedProject!.repoOwner).toBe('phasehumans')
        expect(fetchedProject!.pinnedRules).toContain('lowercase git conventions')
        expect(fetchedProject!.sessions.length).toBe(1)
        expect(fetchedProject!.sessions[0]!.id).toBe(testSessionId)
    })

    it('inherits project context and pinned instructions into child session agent prompt', async () => {
        if (!dbAvailable) return

        // Fetch session with linked project
        const sessionWithProject = await prisma.session.findUnique({
            where: { id: testSessionId },
            include: { project: true },
        })

        expect(sessionWithProject).toBeDefined()
        expect(sessionWithProject!.project).toBeDefined()

        const pinnedRules = sessionWithProject!.project!.pinnedRules!

        // Initialize ConversationManager inheriting child session context
        const conversation = new ConversationManager([], {
            pinnedRules,
            systemPrompt: 'You are December.',
        })

        expect(conversation.messages.length).toBe(1)
        const systemPrompt = conversation.messages[0]!.content
        expect(systemPrompt).toContain('<project_memory>')
        expect(systemPrompt).toContain(
            'pinned: adhere strictly to AGENTS.md and lowercase git conventions'
        )
        expect(systemPrompt).toContain('</project_memory>')
    })

    it('enforces strict 2KB ceiling on workspace memory file injection', async () => {
        // Create an oversized 10KB memory file in workspace
        const decDir = path.join(tmpDir, '.december')
        fs.mkdirSync(decDir, { recursive: true })
        const largeMemory = '## architecture_notes\n' + 'long instruction entry\n'.repeat(450)
        expect(Buffer.byteLength(largeMemory, 'utf8')).toBeGreaterThan(5000)
        fs.writeFileSync(path.join(decDir, 'memory.md'), largeMemory)

        const conversation = new ConversationManager([], {
            workspaceRoot: tmpDir,
            systemPrompt: 'Base agent prompt.',
        })

        const systemPrompt = conversation.messages[0]!.content
        expect(systemPrompt).toContain('<project_memory>')
        expect(systemPrompt).toContain('[truncated to 2KB budget]')

        const match = systemPrompt.match(/<project_memory>([\s\S]*?)<\/project_memory>/)
        expect(match).toBeDefined()
        const memoryPayload = match![1]!.trim()
        expect(Buffer.byteLength(memoryPayload, 'utf8')).toBeLessThanOrEqual(
            MAX_WORKSPACE_MEMORY_BYTES
        )
    })

    it('connects multi-turn session runs exceeding 15 turns to compaction for structured summarization', async () => {
        const conversation = new ConversationManager()
        conversation.addMessage({ role: 'system', content: 'You are December.' })

        // Populate 16 user-assistant turns
        for (let i = 1; i <= 16; i++) {
            conversation.addMessage({ role: 'user', content: `User query for turn ${i}` })
            conversation.addMessage({
                role: 'assistant',
                content: `Assistant answer for turn ${i}`,
            })
        }

        expect(conversation.messages.length).toBe(33) // 1 system + 32 turn messages

        const mockLlm = new SimpleMockLLM()
        mockLlm.responseText =
            '## Goal\nRefactor worker architecture\n\n## Progress\n### Done\n- Completed tickets 571 to 574'

        const compactionResult = await conversation.compactIfNeeded(mockLlm)

        expect(compactionResult.compacted).toBe(true)
        expect(mockLlm.calls.length).toBe(1)
        expect(conversation.messages[1]!.content).toContain('[COMPACTED HISTORY SUMMARY]')
        expect(conversation.messages[1]!.content).toContain('Refactor worker architecture')
        expect(conversation.messages.length).toBeLessThan(33)
    })
})
