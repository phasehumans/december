import { describe, expect, test, mock } from 'bun:test'

import {
    extractStyleGuidelines,
    getErrorSignature,
    loadMemoryPromptInstructions,
} from '../../src/modules/memory/memory.service'

mock.module('@december/database', () => ({
    prisma: {
        user: {
            findUnique: async () => ({
                design: 'General layout spacing is 24px.\nPrefer rounded-lg borders.',
            }),
        },
        projectMemory: {
            findMany: async () => [
                { key: 'theme', value: 'warm-amber' },
                { key: 'font', value: 'Outfit' },
            ],
        },
    },
}))

describe('memory service unit tests', () => {
    test('extractStyleGuidelines extracts style key-values', () => {
        const prompt =
            'Create a dashboard. theme: warm-amber, font: Outfit. Spacing: 12px. Also color: slate.'
        const guidelines = extractStyleGuidelines(prompt)
        expect(guidelines).toEqual({
            theme: 'warm-amber',
            font: 'Outfit',
            spacing: '12px',
            color: 'slate',
        })
    })

    test('extractStyleGuidelines ignores URLs', () => {
        const prompt = 'Check http://example.com/style. theme: warm-amber.'
        const guidelines = extractStyleGuidelines(prompt)
        expect(guidelines).toEqual({
            theme: 'warm-amber',
        })
    })

    test('getErrorSignature normalizes compiler errors', () => {
        const rawErrors =
            'Error in C:\\Code\\december\\src\\App.tsx:12:43:\nType 0x3f2e is not assignable.'
        const sig = getErrorSignature(rawErrors)
        expect(sig).toContain('[path]')
        expect(sig).toContain('[line]')
        expect(sig).toContain('[col]')
        expect(sig).toContain('0x[hex]')
    })

    test('loadMemoryPromptInstructions loads formatted instructions', async () => {
        const instructions = await loadMemoryPromptInstructions({
            projectId: 'project-id',
            userId: 'user-id',
        })
        expect(instructions).toContain('=== CUSTOM DESIGN SYSTEM AND STYLE INSTRUCTIONS ===')
        expect(instructions).toContain('General Design Preferences')
        expect(instructions).toContain('General layout spacing is 24px.')
        expect(instructions).toContain('Project-Specific Style Guidelines')
        expect(instructions).toContain('- theme: warm-amber')
        expect(instructions).toContain('- font: Outfit')
    })
})
