import { describe, it, expect, afterEach } from 'bun:test'

import { memoryRepository } from '../../src/modules/memory/memory.repository'
import { memoryContentSchema, memoryIdParamsSchema } from '../../src/modules/memory/memory.schema'
import { memoryService } from '../../src/modules/memory/memory.service'
import { ruleRepository } from '../../src/modules/rule/rule.repository'
import { ruleNameParamsSchema, saveRuleSchema } from '../../src/modules/rule/rule.schema'
import { ruleService } from '../../src/modules/rule/rule.service'
import { AppError } from '../../src/shared/appError'

// the rule and memory services with their repositories replaced: the edge cases a real
// database makes hard to reach (two saves at once, rows of another user)

const savedRule = (name: string, body: string, id = name) => ({
    id,
    userId: 'u1',
    name,
    body,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
})

const originalRules = { ...ruleRepository }
const originalMemory = { ...memoryRepository }

afterEach(() => {
    Object.assign(ruleRepository, originalRules)
    Object.assign(memoryRepository, originalMemory)
})

const statusOf = async (work: Promise<unknown>) => {
    try {
        await work
        return 200
    } catch (error) {
        return error instanceof AppError ? error.statusCode : 500
    }
}

describe('ruleService.saveRule', () => {
    it('answers 409 when a save of the same new name wins the race', async () => {
        ruleRepository.findRules = (async () => []) as any
        ruleRepository.createRule = (async () => {
            throw Object.assign(new Error('unique'), { code: 'P2002' })
        }) as any
        const status = await statusOf(
            ruleService.saveRule({
                userId: 'u1',
                currentName: 'a',
                name: 'a',
                body: 'x',
                enabled: true,
            })
        )
        expect(status).toBe(409)
    })

    it('lets another database error through', async () => {
        ruleRepository.findRules = (async () => []) as any
        ruleRepository.createRule = (async () => {
            throw new Error('db down')
        }) as any
        const status = await statusOf(
            ruleService.saveRule({
                userId: 'u1',
                currentName: 'a',
                name: 'a',
                body: 'x',
                enabled: true,
            })
        )
        expect(status).toBe(500)
    })

    it('counts the new text of a saved rule once against the total', async () => {
        ruleRepository.findRules = (async () => [
            savedRule('a', 'a'.repeat(16 * 1024)),
            savedRule('b', 'b'.repeat(16 * 1024)),
        ]) as any
        let updated: unknown = null
        ruleRepository.updateRule = (async (id: string, data: object) => {
            updated = { id, ...data }
            return savedRule('a', 'short')
        }) as any
        const ok = await ruleService.saveRule({
            userId: 'u1',
            currentName: 'a',
            name: 'a',
            body: 'short',
            enabled: false,
        })
        expect(ok.rule.body).toBe('short')
        expect(updated).toEqual({ id: 'a', name: 'a', body: 'short', enabled: false })

        const status = await statusOf(
            ruleService.saveRule({
                userId: 'u1',
                currentName: 'c',
                name: 'c',
                body: 'c',
                enabled: true,
            })
        )
        expect(status).toBe(400)
    })

    it('never returns the user id or row id', async () => {
        ruleRepository.findRules = (async () => [savedRule('a', 'x')]) as any
        const { rules } = await ruleService.listRules({ userId: 'u1' })
        expect(Object.keys(rules[0] ?? {}).sort()).toEqual(['body', 'enabled', 'name', 'updatedAt'])
    })
})

describe('rule schemas', () => {
    it('take a body of exactly 16 KiB and refuse one byte more', () => {
        expect(saveRuleSchema.safeParse({ name: 'a', body: 'x'.repeat(16 * 1024) }).success).toBe(
            true
        )
        expect(
            saveRuleSchema.safeParse({ name: 'a', body: 'x'.repeat(16 * 1024 + 1) }).success
        ).toBe(false)
    })

    it('trim the name and refuse capitals and a dash first', () => {
        expect(ruleNameParamsSchema.parse({ name: ' ok-1 ' }).name).toBe('ok-1')
        expect(ruleNameParamsSchema.safeParse({ name: 'Ok' }).success).toBe(false)
        expect(ruleNameParamsSchema.safeParse({ name: '-ok' }).success).toBe(false)
    })
})

describe('memoryService', () => {
    it('refuses a new memory at the limit of 100', async () => {
        memoryRepository.countMemories = (async () => 100) as any
        let created = false
        memoryRepository.createMemory = (async () => {
            created = true
        }) as any
        expect(await statusOf(memoryService.addMemory({ userId: 'u1', content: 'x' }))).toBe(409)
        expect(created).toBe(false)
    })

    it('answers 404 for a memory of another user, and changes nothing', async () => {
        memoryRepository.findMemory = (async () => null) as any
        let updated = false
        memoryRepository.updateMemory = (async () => {
            updated = true
        }) as any
        const status = await statusOf(
            memoryService.updateMemory({ userId: 'u2', id: 'm1', content: 'x' })
        )
        expect(status).toBe(404)
        expect(updated).toBe(false)

        memoryRepository.deleteMemory = (async () => ({ count: 0 })) as any
        expect(await statusOf(memoryService.deleteMemory({ userId: 'u2', id: 'm1' }))).toBe(404)
    })

    it('reads the switch as off for a user that is gone', async () => {
        memoryRepository.findMemories = (async () => []) as any
        memoryRepository.findMemoryEnabled = (async () => false) as any
        expect(await memoryService.listMemories({ userId: 'gone' })).toEqual({
            enabled: false,
            memories: [],
        })
    })
})

describe('memory schemas', () => {
    it('trim the text and keep it to 500 characters', () => {
        expect(memoryContentSchema.parse({ content: '  a  ' }).content).toBe('a')
        expect(memoryContentSchema.safeParse({ content: 'x'.repeat(500) }).success).toBe(true)
        expect(memoryContentSchema.safeParse({ content: 'x'.repeat(501) }).success).toBe(false)
    })

    it('take a uuid id only', () => {
        expect(memoryIdParamsSchema.safeParse({ id: '../x' }).success).toBe(false)
        expect(
            memoryIdParamsSchema.safeParse({ id: '00000000-0000-4000-8000-000000000000' }).success
        ).toBe(true)
    })
})
