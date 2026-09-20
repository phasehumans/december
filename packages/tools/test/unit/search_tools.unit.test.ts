import { describe, it, expect, beforeEach } from 'bun:test'

import { DeferredToolRegistry } from '../../src/deferred-registry'
import { SearchToolsTool } from '../../src/search_tools'
import { createMockContext } from '../mock-context'

import type { Tool } from '@december/shared'

describe('DeferredToolRegistry (Unit)', () => {
    let registry: DeferredToolRegistry

    const dummyTool1: Tool = {
        name: 'web_search',
        description: 'Search the web using Tavily or Google search engines',
        inputSchema: {},
        execute: async () => 'search result',
    }

    const dummyTool2: Tool = {
        name: 'browser',
        description: 'Inspect live web pages using a headless browser with screenshot support',
        inputSchema: {},
        execute: async () => 'browser page',
    }

    const dummyTool3: Tool = {
        name: 'diff_preview',
        description: 'Preview diffs against git HEAD before committing',
        inputSchema: {},
        execute: async () => 'diff output',
    }

    beforeEach(() => {
        registry = new DeferredToolRegistry()
        registry.register(dummyTool1, {
            category: 'web',
            keywords: ['search', 'google', 'internet'],
        })
        registry.register(dummyTool2, { category: 'web', keywords: ['browser', 'render', 'html'] })
        registry.register(dummyTool3, { category: 'git', keywords: ['diff', 'preview', 'git'] })
    })

    it('should register and retrieve tools by name', () => {
        expect(registry.has('web_search')).toBe(true)
        expect(registry.get('web_search')?.name).toBe('web_search')
        expect(registry.has('non_existent')).toBe(false)
        expect(registry.getAll().length).toBe(3)
    })

    it('should search tools by query keywords', () => {
        const results = registry.search('internet search')
        expect(results.length).toBeGreaterThanOrEqual(1)
        expect(results[0]?.name).toBe('web_search')
    })

    it('should filter search by category', () => {
        const results = registry.search('diff', { category: 'git' })
        expect(results.length).toBe(1)
        expect(results[0]?.name).toBe('diff_preview')

        const empty = registry.search('diff', { category: 'web' })
        expect(empty.length).toBe(0)
    })

    it('should unregister tools', () => {
        registry.unregister('diff_preview')
        expect(registry.has('diff_preview')).toBe(false)
        expect(registry.getAll().length).toBe(2)
    })
})

describe('SearchToolsTool (Unit)', () => {
    let registry: DeferredToolRegistry

    const sampleTool: Tool = {
        name: 'browser',
        description: 'Browse external websites and render pages',
        inputSchema: {},
        execute: async () => 'rendered',
    }

    beforeEach(() => {
        registry = new DeferredToolRegistry()
        registry.register(sampleTool, { category: 'web', keywords: ['browse', 'website', 'html'] })
    })

    it('should find and activate tool via context agent registerTool', async () => {
        const context = createMockContext() as any
        const registeredTools = new Map<string, Tool>()
        context.agent = {
            registerTool: (tool: Tool) => {
                registeredTools.set(tool.name, tool)
            },
        }
        context.deferredRegistry = registry

        const result = await SearchToolsTool.execute({ query: 'browse website' }, context)

        expect(result).toContain('Found and activated')
        expect(result).toContain('browser')
        expect(registeredTools.has('browser')).toBe(true)
    })

    it('should inform when no tools match query', async () => {
        const context = createMockContext() as any
        context.deferredRegistry = registry

        const result = await SearchToolsTool.execute(
            { query: 'something completely unrelated 12345' },
            context
        )

        expect(result).toContain('No deferred tools found')
    })
})
