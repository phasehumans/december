import { describe, expect, test } from 'bun:test'
import {
    updateNameSchema,
    updateUsernameSchema,
    updateAvatarUrlSchema,
    changePasswordSchema,
    updateNotificationSchema,
    chatSuggestionsSchema,
    generationSoundSchema,
    GenerationSound,
    designSchema,
    submitFeedbackSchema,
} from '../../src/modules/profile/profile.schema'
import { sanitizeMarkdown } from '../../src/modules/profile/profile.utils'

describe('profile schemas unit tests', () => {
    describe('updateNameSchema', () => {
        test('should validate a valid name (3-20 chars)', () => {
            const res = updateNameSchema.safeParse({ name: 'Alice' })
            expect(res.success).toBe(true)
        })

        test('should reject name shorter than 3 characters', () => {
            const res = updateNameSchema.safeParse({ name: 'Al' })
            expect(res.success).toBe(false)
        })

        test('should reject name longer than 20 characters', () => {
            const res = updateNameSchema.safeParse({ name: 'A'.repeat(21) })
            expect(res.success).toBe(false)
        })

        test('should reject missing name', () => {
            const res = updateNameSchema.safeParse({})
            expect(res.success).toBe(false)
        })
    })

    describe('updateUsernameSchema', () => {
        test('should validate a valid username (6-20 lowercase letters/underscores)', () => {
            const res = updateUsernameSchema.safeParse({ username: 'valid_user' })
            expect(res.success).toBe(true)
        })

        test('should reject username shorter than 6 characters', () => {
            const res = updateUsernameSchema.safeParse({ username: 'user' })
            expect(res.success).toBe(false)
        })

        test('should reject username longer than 20 characters', () => {
            const res = updateUsernameSchema.safeParse({ username: 'a_'.repeat(11) })
            expect(res.success).toBe(false)
        })

        test('should reject username containing uppercase letters', () => {
            const res = updateUsernameSchema.safeParse({ username: 'Valid_User' })
            expect(res.success).toBe(false)
        })

        test('should reject username containing numbers or special characters', () => {
            const res1 = updateUsernameSchema.safeParse({ username: 'user123' })
            const res2 = updateUsernameSchema.safeParse({ username: 'user@name' })
            const res3 = updateUsernameSchema.safeParse({ username: 'user name' })
            expect(res1.success).toBe(false)
            expect(res2.success).toBe(false)
            expect(res3.success).toBe(false)
        })

        test('should reject missing username', () => {
            const res = updateUsernameSchema.safeParse({})
            expect(res.success).toBe(false)
        })
    })

    describe('updateAvatarUrlSchema', () => {
        test('should validate a valid avatar URL', () => {
            const res = updateAvatarUrlSchema.safeParse({
                avatarUrl: 'https://example.com/avatar.png',
            })
            expect(res.success).toBe(true)
        })

        test('should reject invalid URL string', () => {
            const res = updateAvatarUrlSchema.safeParse({ avatarUrl: 'not-a-url' })
            expect(res.success).toBe(false)
        })

        test('should reject avatar URL exceeding 500 characters', () => {
            const res = updateAvatarUrlSchema.safeParse({
                avatarUrl: `https://example.com/${'a'.repeat(500)}`,
            })
            expect(res.success).toBe(false)
        })

        test('should reject missing avatar URL', () => {
            const res = updateAvatarUrlSchema.safeParse({})
            expect(res.success).toBe(false)
        })
    })

    describe('changePasswordSchema', () => {
        test('should validate valid currentPassword and newPassword', () => {
            const res = changePasswordSchema.safeParse({
                currentPassword: 'old_password',
                newPassword: 'new_password',
            })
            expect(res.success).toBe(true)
        })

        test('should validate empty or missing currentPassword', () => {
            const res1 = changePasswordSchema.safeParse({
                currentPassword: '',
                newPassword: 'new_password',
            })
            const res2 = changePasswordSchema.safeParse({ newPassword: 'new_password' })
            expect(res1.success).toBe(true)
            expect(res2.success).toBe(true)
        })

        test('should reject newPassword shorter than 6 characters', () => {
            const res = changePasswordSchema.safeParse({
                currentPassword: 'old',
                newPassword: 'short',
            })
            expect(res.success).toBe(false)
        })

        test('should reject newPassword longer than 20 characters', () => {
            const res = changePasswordSchema.safeParse({
                currentPassword: 'old',
                newPassword: 'a'.repeat(21),
            })
            expect(res.success).toBe(false)
        })

        test('should reject currentPassword longer than 20 characters', () => {
            const res = changePasswordSchema.safeParse({
                currentPassword: 'a'.repeat(21),
                newPassword: 'new_password',
            })
            expect(res.success).toBe(false)
        })

        test('should reject missing newPassword', () => {
            const res = changePasswordSchema.safeParse({ currentPassword: 'old' })
            expect(res.success).toBe(false)
        })
    })

    describe('updateNotificationSchema', () => {
        test('should validate valid notification boolean flags', () => {
            const res = updateNotificationSchema.safeParse({
                notifyProjectActivity: true,
                notifyProductUpdates: false,
                notifySecurityAlerts: true,
            })
            expect(res.success).toBe(true)
        })

        test('should validate partial or missing flags (all optional)', () => {
            const res1 = updateNotificationSchema.safeParse({ notifyProjectActivity: true })
            const res2 = updateNotificationSchema.safeParse({})
            expect(res1.success).toBe(true)
            expect(res2.success).toBe(true)
        })

        test('should reject non-boolean notification flags', () => {
            const res = updateNotificationSchema.safeParse({ notifyProjectActivity: 'true' })
            expect(res.success).toBe(false)
        })
    })

    describe('chatSuggestionsSchema', () => {
        test('should validate valid boolean flag', () => {
            const res1 = chatSuggestionsSchema.safeParse({ chatSuggestions: true })
            const res2 = chatSuggestionsSchema.safeParse({ chatSuggestions: false })
            expect(res1.success).toBe(true)
            expect(res2.success).toBe(true)
        })

        test('should reject missing flag', () => {
            const res = chatSuggestionsSchema.safeParse({})
            expect(res.success).toBe(false)
        })

        test('should reject non-boolean flag', () => {
            const res = chatSuggestionsSchema.safeParse({ chatSuggestions: 'true' })
            expect(res.success).toBe(false)
        })
    })

    describe('generationSoundSchema', () => {
        test('should validate valid enum values', () => {
            const res1 = generationSoundSchema.safeParse({
                generationSound: GenerationSound.ALWAYS,
            })
            const res2 = generationSoundSchema.safeParse({ generationSound: GenerationSound.NEVER })
            const res3 = generationSoundSchema.safeParse({
                generationSound: GenerationSound.FIRST_GENERATION,
            })
            expect(res1.success).toBe(true)
            expect(res2.success).toBe(true)
            expect(res3.success).toBe(true)
        })

        test('should reject invalid enum value', () => {
            const res = generationSoundSchema.safeParse({ generationSound: 'INVALID_VALUE' })
            expect(res.success).toBe(false)
        })

        test('should reject missing enum value', () => {
            const res = generationSoundSchema.safeParse({})
            expect(res.success).toBe(false)
        })
    })

    describe('designSchema', () => {
        test('should validate valid design string', () => {
            const res = designSchema.safeParse({ design: 'Dark mode sleek UI' })
            expect(res.success).toBe(true)
        })

        test('should validate empty design string', () => {
            const res = designSchema.safeParse({ design: '' })
            expect(res.success).toBe(true)
        })

        test('should reject design string exceeding 10000 characters', () => {
            const res = designSchema.safeParse({ design: 'a'.repeat(10001) })
            expect(res.success).toBe(false)
        })

        test('should reject missing design string', () => {
            const res = designSchema.safeParse({})
            expect(res.success).toBe(false)
        })
    })

    describe('submitFeedbackSchema', () => {
        test('should validate valid feedback with number rating', () => {
            const res = submitFeedbackSchema.safeParse({ rating: 5, feedback: 'Great job!' })
            expect(res.success).toBe(true)
        })

        test('should validate valid feedback with string rating', () => {
            const res = submitFeedbackSchema.safeParse({ rating: '5', feedback: 'Great job!' })
            expect(res.success).toBe(true)
        })

        test('should validate valid feedback with null or missing rating', () => {
            const res1 = submitFeedbackSchema.safeParse({ rating: null, feedback: 'Great job!' })
            const res2 = submitFeedbackSchema.safeParse({ feedback: 'Great job!' })
            expect(res1.success).toBe(true)
            expect(res2.success).toBe(true)
        })

        test('should reject empty feedback string', () => {
            const res = submitFeedbackSchema.safeParse({ rating: 5, feedback: '' })
            expect(res.success).toBe(false)
        })

        test('should reject feedback string exceeding 2000 characters', () => {
            const res = submitFeedbackSchema.safeParse({ rating: 5, feedback: 'a'.repeat(2001) })
            expect(res.success).toBe(false)
        })

        test('should reject missing feedback', () => {
            const res = submitFeedbackSchema.safeParse({ rating: 5 })
            expect(res.success).toBe(false)
        })
    })
})

describe('profile utils unit tests', () => {
    describe('sanitizeMarkdown', () => {
        test('should keep normal text unchanged', () => {
            const result = sanitizeMarkdown('Hello World')
            expect(result).toBe('Hello World')
        })

        test('should replace newlines with spaces', () => {
            const result = sanitizeMarkdown('Line1\nLine2\r\nLine3')
            expect(result).toBe('Line1 Line2 Line3')
        })

        test('should escape markdown special characters', () => {
            const result = sanitizeMarkdown('# Header *bold* [link](url)')
            expect(result).toBe('\\# Header \\*bold\\* \\[link\\]\\(url\\)')
        })
    })
})
