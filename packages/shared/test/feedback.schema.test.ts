import { describe, test, expect } from 'bun:test'
import { submitFeedbackSchema } from '../src'

describe('feedback.schema', () => {
    describe('submitFeedbackSchema', () => {
        test('should accept valid feedback and rating', () => {
            const result = submitFeedbackSchema.safeParse({ rating: 5, feedback: 'Great app!' })
            expect(result.success).toBe(true)
        })

        test('should accept rating as string', () => {
            const result = submitFeedbackSchema.safeParse({ rating: '4', feedback: 'Nice UI' })
            expect(result.success).toBe(true)
        })

        test('should accept feedback without rating', () => {
            const result = submitFeedbackSchema.safeParse({ feedback: 'Loving the features' })
            expect(result.success).toBe(true)
        })

        test('should reject when feedback is missing', () => {
            const result = submitFeedbackSchema.safeParse({ rating: 3 })
            expect(result.success).toBe(false)
        })

        test('should reject empty feedback', () => {
            const result = submitFeedbackSchema.safeParse({ feedback: '' })
            expect(result.success).toBe(false)
        })

        test('should reject extremely long feedback (>2000 chars)', () => {
            const result = submitFeedbackSchema.safeParse({ feedback: 'a'.repeat(2001) })
            expect(result.success).toBe(false)
        })
    })
})
