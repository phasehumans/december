import { describe, expect, it } from 'bun:test'

import { webClipRequestSchema } from '../src'

describe('canvas.schema', () => {
    it('accepts a valid https URL with an optional project id', () => {
        const result = webClipRequestSchema.safeParse({
            url: 'https://example.com/article',
            projectId: '550e8400-e29b-41d4-a716-446655440000',
        })

        expect(result.success).toBe(true)
    })

    it('rejects URLs that are not http or https', () => {
        const result = webClipRequestSchema.safeParse({
            url: 'ftp://example.com/file.txt',
        })

        expect(result.success).toBe(false)
    })

    it('rejects an invalid project id', () => {
        const result = webClipRequestSchema.safeParse({
            url: 'https://example.com/article',
            projectId: 'not-a-uuid',
        })

        expect(result.success).toBe(false)
    })
})
