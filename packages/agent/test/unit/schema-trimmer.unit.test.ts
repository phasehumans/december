import { describe, test, expect } from 'bun:test'

import { getAdaptiveThinkingLevel } from '../../src/agent-loop'
import { trimToolSchema } from '../../src/utils/schema-trimmer'

describe('Performance & Schema Trimming (Unit)', () => {
    test('trimToolSchema strips markdown and non-essential schema properties', () => {
        const schema = {
            type: 'object',
            properties: {
                filePath: {
                    type: 'string',
                    description: 'The **absolute** path to `target` file.',
                    examples: ['/foo/bar.txt'],
                    $comment: 'Must exist',
                },
            },
        }

        const trimmed = trimToolSchema(schema)
        expect(trimmed.properties.filePath.description).toBe('The absolute path to target file.')
        expect(trimmed.properties.filePath.examples).toBeUndefined()
        expect(trimmed.properties.filePath.$comment).toBeUndefined()
    })

    test('getAdaptiveThinkingLevel respects user configuration and defaults to fast', () => {
        // Slash commands are off
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: '/login' }])).toBe('off')

        // Default is fast for standard and complex prompts
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: 'read package.json' }])).toBe(
            'fast'
        )
        expect(
            getAdaptiveThinkingLevel([
                { role: 'user', content: 'Add a new utility function to file' },
            ])
        ).toBe('fast')
        expect(
            getAdaptiveThinkingLevel([
                { role: 'user', content: 'refactor the module architecture and fix broken tests' },
            ])
        ).toBe('fast')

        // Explicit user settings are honored
        expect(
            getAdaptiveThinkingLevel(
                [{ role: 'user', content: 'refactor the module architecture' }],
                'deep'
            )
        ).toBe('deep')
        expect(getAdaptiveThinkingLevel([{ role: 'user', content: 'test prompt' }], 'off')).toBe(
            'off'
        )
    })
})
