import { describe, expect, test } from 'bun:test'

import {
    applyProjectEditSchema,
    applyProjectFixSchema,
    projectChangePlanSchema,
} from '../../src/modules/generation/generation.schema'
import { isFrontendWorkspacePath } from '../../src/modules/generation/generation.utils'

describe('generation schemas', () => {
    test('accepts streamed edit requests with prompt and project id', () => {
        const parsed = applyProjectEditSchema.safeParse({
            projectId: '11111111-1111-4111-8111-111111111111',
            prompt: 'Make the hero more compact',
        })

        expect(parsed.success).toBe(true)
    })

    test('accepts streamed fix requests with runtime error details', () => {
        const parsed = applyProjectFixSchema.safeParse({
            projectId: '11111111-1111-4111-8111-111111111111',
            errorMessage: 'Failed to resolve import ./Missing',
            stack: 'at App.tsx:4:1',
        })

        expect(parsed.success).toBe(true)
    })

    test('rejects duplicate patch operation paths', () => {
        const parsed = projectChangePlanSchema.safeParse({
            success: true,
            message: 'Patch plan generated successfully',
            data: {
                summary: 'Update hero copy',
                operations: [
                    {
                        path: 'src/App.tsx',
                        action: 'update',
                        purpose: 'Update hero copy',
                        instructions: 'Change the headline text',
                    },
                    {
                        path: 'src/App.tsx',
                        action: 'update',
                        purpose: 'Update hero layout',
                        instructions: 'Tighten spacing',
                    },
                ],
            },
            errors: [],
        })

        expect(parsed.success).toBe(false)
    })
})

describe('generation workspace paths', () => {
    test('allows root index.html for runnable preview manifests', () => {
        expect(isFrontendWorkspacePath('index.html')).toBe(true)
    })

    test('keeps backend files out of patch plans', () => {
        expect(isFrontendWorkspacePath('server/src/api.ts')).toBe(false)
    })
})
