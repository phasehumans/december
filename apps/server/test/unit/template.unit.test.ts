import { describe, expect, test } from 'bun:test'
import { toggleLikeSchema, remixTemplateSchema } from '../../src/modules/template/template.schema'

describe('template schemas', () => {
    test('toggleLikeSchema validation', () => {
        const valid = toggleLikeSchema.safeParse({ isLiked: true })
        expect(valid.success).toBe(true)

        const invalid = toggleLikeSchema.safeParse({ isLiked: 'yes' })
        expect(invalid.success).toBe(false)
    })

    test('remixTemplateSchema validation', () => {
        const valid = remixTemplateSchema.safeParse({ name: 'Remix Project' })
        expect(valid.success).toBe(true)
    })
})
