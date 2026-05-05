import { describe, test, expect } from 'bun:test'
import { toggleLikeSchema } from '../../src/modules/template/template.schema'

describe('template.schema', () => {
    describe('toggleLikeSchema', () => {
        test('should accept isLiked as true', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: true })
            expect(result.success).toBe(true)
        })

        test('should accept isLiked as false', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: false })
            expect(result.success).toBe(true)
        })

        test('should reject isLiked as string "true"', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: 'true' })
            expect(result.success).toBe(false)
        })

        test('should reject isLiked as string "false"', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: 'false' })
            expect(result.success).toBe(false)
        })

        test('should reject isLiked as number 1', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: 1 })
            expect(result.success).toBe(false)
        })

        test('should reject isLiked as number 0', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: 0 })
            expect(result.success).toBe(false)
        })

        test('should reject isLiked as null', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: null })
            expect(result.success).toBe(false)
        })

        test('should reject isLiked as undefined', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: undefined })
            expect(result.success).toBe(false)
        })

        test('should reject missing isLiked field', () => {
            const result = toggleLikeSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should strip extra fields and still succeed', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: true, extra: 'field' })
            expect(result.success).toBe(true)
            if (result.success) {
                expect((result.data as any).extra).toBeUndefined()
            }
        })

        test('should reject array as value', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: [true] })
            expect(result.success).toBe(false)
        })

        test('should reject object as value', () => {
            const result = toggleLikeSchema.safeParse({ isLiked: { value: true } })
            expect(result.success).toBe(false)
        })
    })
})
