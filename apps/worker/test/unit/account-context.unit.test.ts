import { prisma } from '@december/database'
import { afterEach, describe, it, expect } from 'bun:test'

import {
    createMemoryTool,
    loadAccountContext,
    memoryHandle,
    withAccountContext,
    type MemoryStore,
} from '../../src/account-context'

import type { ToolExecuteContext } from '@december/shared'

// the account rules and the agent memory of a cloud run: what reaches the system prompt,
// and what the memory tool may read and write

const ctx = {} as ToolExecuteContext

/** an in-memory store with the rows of two users */
const fakeStore = (enabled = true) => {
    const rows = new Map<string, { userId: string; content: string; sessionId: string | null }>()
    let next = 0
    const state = { enabled }
    const store: MemoryStore = {
        isEnabled: async () => state.enabled,
        count: async (userId) => [...rows.values()].filter((row) => row.userId === userId).length,
        create: async (row) => {
            const id = `id-${++next}`
            rows.set(id, { userId: row.userId, content: row.content, sessionId: row.sessionId })
            return { id, content: row.content }
        },
        update: async (userId, id, content) => {
            const row = rows.get(id)
            if (!row || row.userId !== userId) return false
            row.content = content
            return true
        },
        remove: async (userId, id) => {
            const row = rows.get(id)
            if (!row || row.userId !== userId) return false
            rows.delete(id)
            return true
        },
    }
    return { store, rows, state }
}

describe('withAccountContext', () => {
    it('puts the rules first, then the user rules, then the memory', () => {
        const text = withAccountContext({
            context: {
                rules: [{ name: 'style', body: 'no em dashes', enabled: true }],
                memoryEnabled: true,
                memories: [
                    { id: 'a', content: 'prefers bun' },
                    { id: 'b', content: 'works on acme/web' },
                ],
            },
            userRules: '## Skills\nwrite-tests',
        })
        const rules = text.indexOf('# Account rules')
        const skills = text.indexOf('## Skills')
        const memory = text.indexOf('# Memory')
        expect(rules).toBeGreaterThanOrEqual(0)
        expect(skills).toBeGreaterThan(rules)
        expect(memory).toBeGreaterThan(skills)
        expect(text).toContain('## style\nno em dashes')
        expect(text).toContain('- [m1] prefers bun')
        expect(text).toContain('- [m2] works on acme/web')
    })

    it('leaves the memory out while memory is off', () => {
        const text = withAccountContext({
            context: {
                rules: [],
                memoryEnabled: false,
                memories: [{ id: 'a', content: 'prefers bun' }],
            },
            userRules: undefined,
        })
        expect(text).toBe('')
    })
})

describe('createMemoryTool', () => {
    const make = (store: MemoryStore, memories = [{ id: 'old-1', content: 'old fact' }]) =>
        createMemoryTool({
            userId: 'u1',
            sessionId: 's1',
            sessionTitle: 'fix build',
            memories,
            secretValues: ['sk-live-123456', 'abc'],
            store,
        })

    it('saves a memory with the session it came from, and gives it the next handle', async () => {
        const { store, rows } = fakeStore()
        const tool = make(store)
        expect(await tool.execute({ action: 'save', content: '  prefers  bun ' }, ctx)).toBe(
            'Saved as m2.'
        )
        const saved = [...rows.values()][0]
        expect(saved).toEqual({ userId: 'u1', content: 'prefers bun', sessionId: 's1' })
    })

    it('updates and deletes by handle, and never reuses a handle', async () => {
        const { store, rows } = fakeStore()
        const tool = make(store, [])
        await tool.execute({ action: 'save', content: 'one' }, ctx)
        await tool.execute({ action: 'save', content: 'two' }, ctx)
        expect(await tool.execute({ action: 'delete', id: 'm1' }, ctx)).toBe('Deleted m1.')
        expect(await tool.execute({ action: 'save', content: 'three' }, ctx)).toBe('Saved as m3.')
        expect(await tool.execute({ action: 'update', id: 'm2', content: 'TWO' }, ctx)).toBe(
            'Updated m2.'
        )
        expect([...rows.values()].map((row) => row.content).sort()).toEqual(['TWO', 'three'])
        expect(await tool.execute({ action: 'delete', id: 'm1' }, ctx)).toMatch(/^Error/)
    })

    it('cannot reach a memory of another user, even with its row id', async () => {
        const { store, rows } = fakeStore()
        rows.set('theirs', { userId: 'u2', content: 'their fact', sessionId: null })
        const tool = make(store, [{ id: 'theirs', content: 'their fact' }])
        expect(await tool.execute({ action: 'update', id: 'm1', content: 'x' }, ctx)).toBe(
            'Error: memory m1 is gone.'
        )
        expect(await tool.execute({ action: 'delete', id: 'theirs' }, ctx)).toMatch(/^Error/)
        expect(rows.get('theirs')?.content).toBe('their fact')
    })

    it('refuses empty, too long and secret text', async () => {
        const { store, rows } = fakeStore()
        const tool = make(store)
        expect(await tool.execute({ action: 'save', content: ' ' }, ctx)).toMatch(/^Error/)
        expect(await tool.execute({ action: 'save', content: 'x'.repeat(501) }, ctx)).toMatch(
            /^Error/
        )
        expect(
            await tool.execute({ action: 'save', content: 'the key is sk-live-123456' }, ctx)
        ).toBe('Error: a memory must not hold a secret value.')
        // a very short secret value is not matched: it would refuse normal words
        expect(await tool.execute({ action: 'save', content: 'abc is fine' }, ctx)).toBe(
            'Saved as m2.'
        )
        expect(await tool.execute({ action: 'forget' } as any, ctx)).toMatch(/^Error/)
        expect(rows.size).toBe(1)
    })

    it('stops when the user turns memory off during the run', async () => {
        const { store, state, rows } = fakeStore()
        const tool = make(store)
        state.enabled = false
        expect(await tool.execute({ action: 'save', content: 'x' }, ctx)).toBe(
            'Error: the user turned memory off.'
        )
        expect(rows.size).toBe(0)
    })

    it('keeps the limits of 100 memories and 20 changes a run', async () => {
        const full = fakeStore()
        for (let i = 0; i < 100; i++) {
            full.rows.set(`r${i}`, { userId: 'u1', content: 'x', sessionId: null })
        }
        expect(await make(full.store).execute({ action: 'save', content: 'y' }, ctx)).toMatch(
            /memory is full/
        )

        const { store } = fakeStore()
        const tool = make(store, [])
        for (let i = 0; i < 20; i++) {
            expect(await tool.execute({ action: 'save', content: `f${i}` }, ctx)).toMatch(/^Saved/)
        }
        expect(await tool.execute({ action: 'save', content: 'one more' }, ctx)).toMatch(
            /already changed 20 memories/
        )
    })

    it('names handles from m1', () => {
        expect(memoryHandle(0)).toBe('m1')
        expect(memoryHandle(9)).toBe('m10')
    })
})

describe('loadAccountContext', () => {
    const stamp = Date.now()
    const ids: string[] = []

    afterEach(async () => {
        await prisma.user.deleteMany({ where: { id: { in: ids } } })
    })

    const makeUser = async (memoryEnabled: boolean) => {
        const user = await prisma.user.create({
            data: {
                name: 'ctx',
                email: `ctx-${stamp}-${ids.length}@example.com`,
                memoryEnabled,
            },
        })
        ids.push(user.id)
        return user.id
    }

    it('reads only the rules that are on and the memories of this user, newest first', async () => {
        const userId = await makeUser(true)
        const otherId = await makeUser(true)
        await prisma.userRule.createMany({
            data: [
                { userId, name: 'b-on', body: 'on' },
                { userId, name: 'a-off', body: 'off', enabled: false },
                { userId: otherId, name: 'theirs', body: 'not mine' },
            ],
        })
        await prisma.userMemory.create({
            data: { userId, content: 'older', updatedAt: new Date('2026-01-01') },
        })
        await prisma.userMemory.create({ data: { userId, content: 'newer' } })
        await prisma.userMemory.create({ data: { userId: otherId, content: 'their memory' } })

        const context = await loadAccountContext(userId)
        expect(context.rules).toEqual([{ name: 'b-on', body: 'on', enabled: true }])
        expect(context.memoryEnabled).toBe(true)
        expect(context.memories.map((row) => row.content)).toEqual(['newer', 'older'])
    })

    it('reads no memories while memory is off, and nothing with no user', async () => {
        const userId = await makeUser(false)
        await prisma.userMemory.create({ data: { userId, content: 'kept but not read' } })
        const context = await loadAccountContext(userId)
        expect(context.memoryEnabled).toBe(false)
        expect(context.memories).toEqual([])
        expect(await loadAccountContext(undefined)).toEqual({
            rules: [],
            memoryEnabled: false,
            memories: [],
        })
    })
})
