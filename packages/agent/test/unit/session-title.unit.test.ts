import { describe, expect, test } from 'bun:test'

import { Agent } from '../../src/agent'
import {
    buildTitleTranscript,
    cleanGeneratedTitle,
    deriveTitleFromPrompt,
    generateSessionTitle,
    normalizeSessionTitle,
    type SessionMeta,
} from '../../src/session-title'
import { MockLLM } from '../mock-provider'

import type { SessionRepository } from '../../src/harness/session-repository'
import type { AgentMessage } from '@december/shared'

class MemorySessionRepository implements SessionRepository {
    contexts = new Map<string, AgentMessage[]>()
    metas = new Map<string, SessionMeta>()

    async saveContext(sessionId: string, messages: AgentMessage[]) {
        this.contexts.set(sessionId, [...messages])
    }
    async loadContext(sessionId: string) {
        return this.contexts.get(sessionId) || []
    }
    async hasSession(sessionId: string) {
        return this.contexts.has(sessionId)
    }
    async getSessionMeta(sessionId: string) {
        return this.metas.get(sessionId) || null
    }
    async setSessionMeta(sessionId: string, meta: SessionMeta) {
        this.metas.set(sessionId, meta)
    }
}

const createAgent = (llm = new MockLLM(), repo = new MemorySessionRepository()) => ({
    llm,
    repo,
    agent: new Agent({
        llm,
        tools: [],
        operations: {} as any,
        sessionId: 'session-1',
        sessionRepository: repo,
    }),
})

describe('session title helpers', () => {
    test('deriveTitleFromPrompt strips context markup and cuts at a word boundary', () => {
        const prompt =
            '<context_file path="a.ts">const x = 1</context_file> fix the rewind menu so that it lists snapshots in the right order please'
        const title = deriveTitleFromPrompt(prompt)
        expect(title).not.toContain('context_file')
        expect(title).not.toContain('const x')
        expect(title.startsWith('fix the rewind menu')).toBe(true)
        expect(title.endsWith('...')).toBe(true)
        expect(title.length).toBeLessThanOrEqual(53)
    })

    test('deriveTitleFromPrompt returns an empty string when only markup is left', () => {
        expect(deriveTitleFromPrompt('<piped_stdin>log</piped_stdin>')).toBe('')
    })

    test('cleanGeneratedTitle removes labels, quotes, markdown, and extra lines', () => {
        expect(cleanGeneratedTitle('Title: "Fix rewind snapshot ordering."\nmore text')).toBe(
            'Fix rewind snapshot ordering'
        )
        expect(cleanGeneratedTitle('## **Add session titles**')).toBe('Add session titles')
        expect(cleanGeneratedTitle('<think>hmm</think>\nRename command')).toBe('Rename command')
        expect(cleanGeneratedTitle('   ')).toBe('')
    })

    test('normalizeSessionTitle collapses whitespace and limits length', () => {
        expect(normalizeSessionTitle('  auth\n\tflow  ')).toBe('auth flow')
        expect(normalizeSessionTitle('word '.repeat(40)).length).toBeLessThanOrEqual(83)
    })

    test('buildTitleTranscript keeps user and assistant text only', () => {
        const transcript = buildTitleTranscript([
            { id: '0', role: 'system', content: 'system prompt' },
            { id: '1', role: 'user', content: 'add a rename command' },
            { id: '2', role: 'tool', content: 'tool output' } as any,
            { id: '3', role: 'assistant', content: 'done' },
        ])
        expect(transcript).toBe('User: add a rename command\nAssistant: done')
    })

    test('generateSessionTitle uses the model with thinking off', async () => {
        const llm = new MockLLM()
        llm.pushResponse('"Add rename command."')
        const title = await generateSessionTitle({
            llm,
            messages: [{ id: '1', role: 'user', content: 'add a rename command' }],
            modelOptions: { model: 'm', thinkingLevel: 'deep' },
        })
        expect(title).toBe('Add rename command')
        expect(llm.calls[0]?.modelOptions).toEqual({ model: 'm', thinkingLevel: 'off' })
        expect(llm.calls[0]?.tools).toBeUndefined()
    })

    test('generateSessionTitle returns an empty string when the model fails', async () => {
        const llm = new MockLLM()
        llm.pushResponse(new Error('offline'))
        const title = await generateSessionTitle({
            llm,
            messages: [{ id: '1', role: 'user', content: 'hello' }],
        })
        expect(title).toBe('')
    })
})

describe('Agent session titles', () => {
    test('prompt title is upgraded once to a model title', async () => {
        const { agent, llm, repo } = createAgent()
        agent.messages.push({ id: 'u1', role: 'user', content: 'please fix the flaky login test' })
        await agent.ensurePromptTitle('please fix the flaky login test')
        expect(agent.sessionTitleSource).toBe('prompt')

        llm.pushResponse('Fix flaky login test')
        expect(await agent.upgradeAutoTitle()).toBe('Fix flaky login test')
        expect(repo.metas.get('session-1')).toEqual({
            title: 'Fix flaky login test',
            titleSource: 'auto',
        })

        // second call is a no-op, no extra model call
        const callsBefore = llm.calls.length
        expect(await agent.upgradeAutoTitle()).toBeUndefined()
        expect(llm.calls.length).toBe(callsBefore)
    })

    test('a manual title is never replaced', async () => {
        const { agent, llm, repo } = createAgent()
        agent.messages.push({ id: 'u1', role: 'user', content: 'hello' })
        await agent.setSessionTitle('My name', 'manual')
        expect(await agent.upgradeAutoTitle()).toBeUndefined()
        await agent.ensurePromptTitle('hello')
        expect(agent.sessionTitle).toBe('My name')
        expect(repo.metas.get('session-1')?.titleSource).toBe('manual')
        expect(llm.calls.length).toBe(0)
    })

    test('a manual rename made while the model runs wins', async () => {
        const { agent, llm, repo } = createAgent()
        agent.messages.push({ id: 'u1', role: 'user', content: 'hello' })
        await agent.ensurePromptTitle('hello')
        llm.pushResponse(() => {
            repo.metas.set('session-1', { title: 'Typed by user', titleSource: 'manual' })
            return 'Model title'
        })
        expect(await agent.upgradeAutoTitle()).toBeUndefined()
        expect(repo.metas.get('session-1')?.title).toBe('Typed by user')
    })

    test('fork gets a new internal id and uses the given name as its title', async () => {
        const { agent, repo } = createAgent()
        agent.messages.push({ id: 'u1', role: 'user', content: 'hello' })
        await agent.saveContext()
        const newId = await agent.forkContext('try another approach')
        expect(newId).not.toBe('session-1')
        expect(newId.startsWith('session-')).toBe(true)
        expect(agent.sessionTitle).toBe('try another approach')
        expect(repo.metas.get(newId)).toEqual({
            title: 'try another approach',
            titleSource: 'manual',
        })
        expect(repo.contexts.get(newId)?.length).toBe(repo.contexts.get('session-1')?.length)
    })

    test('fork without a name reuses the parent title', async () => {
        const { agent } = createAgent()
        await agent.setSessionTitle('Auth redesign', 'auto')
        await agent.forkContext()
        expect(agent.sessionTitle).toBe('Auth redesign (fork)')
        expect(agent.sessionTitleSource).toBe('auto')
    })

    test('loadContext reads the title and newContext clears it', async () => {
        const { agent, repo } = createAgent()
        repo.metas.set('other', { title: 'Old work', titleSource: 'manual' })
        await agent.loadContext('other')
        expect(agent.sessionTitle).toBe('Old work')
        await agent.newContext()
        expect(agent.sessionTitle).toBeUndefined()
        expect(agent.sessionTitleSource).toBeUndefined()
    })
})
