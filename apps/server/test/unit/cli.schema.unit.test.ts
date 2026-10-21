import { describe, it, expect } from 'bun:test'

import { ChatCompletionsSchema } from '../../src/modules/cli/cli.schema'

describe('CLI Schema - Unit Tests', () => {
    describe('ChatCompletionsSchema', () => {
        it('should pass with valid messages array and model', () => {
            const valid = {
                model: 'gemini-3.6-flash',
                messages: [{ role: 'user', content: 'Hello December' }],
                stream: true,
                temperature: 0.7,
            }
            const parsed = ChatCompletionsSchema.safeParse(valid)
            expect(parsed.success).toBe(true)
        })

        it('should pass with passthrough fields like functions or tools', () => {
            const valid = {
                messages: [{ role: 'user', content: 'Test' }],
                tools: [{ type: 'function', function: { name: 'bash' } }],
            }
            const parsed = ChatCompletionsSchema.safeParse(valid)
            expect(parsed.success).toBe(true)
        })

        it('should fail if messages is empty array', () => {
            const invalid = {
                messages: [],
            }
            const parsed = ChatCompletionsSchema.safeParse(invalid)
            expect(parsed.success).toBe(false)
        })

        it('should fail if messages is missing', () => {
            const invalid = {
                model: 'gpt-4o',
            }
            const parsed = ChatCompletionsSchema.safeParse(invalid)
            expect(parsed.success).toBe(false)
        })
    })
})
