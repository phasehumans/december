import { describe, expect, test } from 'bun:test'

import { parseModelJson } from '../../src/modules/agent/agents.utils'
import { isFrontendWorkspacePath } from '../../src/modules/generation/generation.utils'

describe('generation utility functions', () => {
    test('repairs raw line breaks inside model JSON strings', () => {
        const parsed = parseModelJson<{ thinking: string }>(
            '{"thinking":"First line\\nSecond line"}',
            'plan agent'
        )

        expect(parsed.thinking).toBe('First line\\nSecond line')
    })
})

describe('generation workspace paths', () => {
    test('allows root index.html for runnable preview manifests', () => {
        expect(isFrontendWorkspacePath('index.html')).toBe(true)
    })

    test('allows configuration files at root', () => {
        expect(isFrontendWorkspacePath('vite.config.ts')).toBe(true)
        expect(isFrontendWorkspacePath('vite.config.js')).toBe(true)
        expect(isFrontendWorkspacePath('vite.config.mjs')).toBe(true)
        expect(isFrontendWorkspacePath('vite.config.cjs')).toBe(true)
        expect(isFrontendWorkspacePath('tailwind.config.js')).toBe(true)
        expect(isFrontendWorkspacePath('tailwind.config.ts')).toBe(true)
        expect(isFrontendWorkspacePath('postcss.config.js')).toBe(true)
        expect(isFrontendWorkspacePath('tsconfig.node.json')).toBe(true)
        expect(isFrontendWorkspacePath('components.json')).toBe(true)
        expect(isFrontendWorkspacePath('vite-env.d.ts')).toBe(true)
    })

    test('keeps backend files out of patch plans', () => {
        expect(isFrontendWorkspacePath('server/src/api.ts')).toBe(false)
    })
})
