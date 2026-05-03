import { describe, test, expect } from 'bun:test'

import {
    updateNameSchema,
    updateUsernameSchema,
    changePasswordSchema,
    updateNotificationSchema,
    chatSuggestionsSchema,
    generationSoundSchema,
    GenerationSound,
} from '../../src/modules/profile/profile.schema'
import { extractFirstName } from '../../src/modules/profile/profile.utils'

describe('profile.schema', () => {
    describe('updateNameSchema', () => {
        test('should accept a valid name', () => {
            const result = updateNameSchema.safeParse({ name: 'Chaitanya' })
            expect(result.success).toBe(true)
        })

        test('should reject name shorter than 3 chars', () => {
            const result = updateNameSchema.safeParse({ name: 'Ch' })
            expect(result.success).toBe(false)
        })

        test('should reject name longer than 20 chars', () => {
            const result = updateNameSchema.safeParse({ name: 'a'.repeat(21) })
            expect(result.success).toBe(false)
        })

        test('should accept name with exactly 3 chars', () => {
            const result = updateNameSchema.safeParse({ name: 'cha' })
            expect(result.success).toBe(true)
        })

        test('should accept name with exactly 20 chars', () => {
            const result = updateNameSchema.safeParse({ name: 'a'.repeat(20) })
            expect(result.success).toBe(true)
        })

        test('should reject name as number', () => {
            const result = updateNameSchema.safeParse({ name: 39 })
            expect(result.success).toBe(false)
        })

        test('should reject name as null', () => {
            const result = updateNameSchema.safeParse({ name: null })
            expect(result.success).toBe(false)
        })

        test('should reject when name is missing', () => {
            const result = updateNameSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject empty string name', () => {
            const result = updateNameSchema.safeParse({ name: '' })
            expect(result.success).toBe(false)
        })
    })

    describe('updateUsernameSchema', () => {
        test('should accept valid lowercase username with underscores', () => {
            const result = updateUsernameSchema.safeParse({ username: 'chaitanya_dev' })
            expect(result.success).toBe(true)
        })

        test('should reject username shorter than 6 chars', () => {
            const result = updateUsernameSchema.safeParse({ username: 'abc' })
            expect(result.success).toBe(false)
        })

        test('should reject username longer than 20 chars', () => {
            const result = updateUsernameSchema.safeParse({ username: 'a'.repeat(21) })
            expect(result.success).toBe(false)
        })

        test('should accept username with exactly 6 chars', () => {
            const result = updateUsernameSchema.safeParse({ username: 'abcdef' })
            expect(result.success).toBe(true)
        })

        test('should accept username with exactly 20 chars', () => {
            const result = updateUsernameSchema.safeParse({ username: 'a'.repeat(20) })
            expect(result.success).toBe(true)
        })

        test('should reject username with uppercase letters', () => {
            const result = updateUsernameSchema.safeParse({ username: 'Chaitanya' })
            expect(result.success).toBe(false)
        })

        test('should reject username with numbers', () => {
            const result = updateUsernameSchema.safeParse({ username: 'user123' })
            expect(result.success).toBe(false)
        })

        test('should reject username with spaces', () => {
            const result = updateUsernameSchema.safeParse({ username: 'user name' })
            expect(result.success).toBe(false)
        })

        test('should reject username with hyphens', () => {
            const result = updateUsernameSchema.safeParse({ username: 'user-name' })
            expect(result.success).toBe(false)
        })

        test('should reject missing username', () => {
            const result = updateUsernameSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject username as number', () => {
            const result = updateUsernameSchema.safeParse({ username: 123456 })
            expect(result.success).toBe(false)
        })
    })

    describe('changePasswordSchema', () => {
        test('should accept valid password', () => {
            const result = changePasswordSchema.safeParse({ password: '123456' })
            expect(result.success).toBe(true)
        })

        test('should reject password shorter than 6 chars', () => {
            const result = changePasswordSchema.safeParse({ password: '12345' })
            expect(result.success).toBe(false)
        })

        test('should reject password longer than 20 chars', () => {
            const result = changePasswordSchema.safeParse({ password: 'a'.repeat(21) })
            expect(result.success).toBe(false)
        })

        test('should accept password with exactly 6 chars', () => {
            const result = changePasswordSchema.safeParse({ password: '123456' })
            expect(result.success).toBe(true)
        })

        test('should accept password with exactly 20 chars', () => {
            const result = changePasswordSchema.safeParse({ password: 'a'.repeat(20) })
            expect(result.success).toBe(true)
        })

        test('should reject when password is missing', () => {
            const result = changePasswordSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject password as number', () => {
            const result = changePasswordSchema.safeParse({ password: 123456 })
            expect(result.success).toBe(false)
        })

        test('should reject password as boolean', () => {
            const result = changePasswordSchema.safeParse({ password: true })
            expect(result.success).toBe(false)
        })
    })

    describe('updateNotificationSchema', () => {
        test('should accept all fields as true', () => {
            const result = updateNotificationSchema.safeParse({
                notifyProjectActivity: true,
                notifyProductUpdates: true,
                notifySecurityAlerts: true,
            })
            expect(result.success).toBe(true)
        })

        test('should accept all fields as false', () => {
            const result = updateNotificationSchema.safeParse({
                notifyProjectActivity: false,
                notifyProductUpdates: false,
                notifySecurityAlerts: false,
            })
            expect(result.success).toBe(true)
        })

        test('should accept partial fields', () => {
            const result = updateNotificationSchema.safeParse({
                notifyProjectActivity: true,
            })
            expect(result.success).toBe(true)
        })

        test('should accept empty object (all fields optional)', () => {
            const result = updateNotificationSchema.safeParse({})
            expect(result.success).toBe(true)
        })

        test('should reject string value for boolean field', () => {
            const result = updateNotificationSchema.safeParse({
                notifyProjectActivity: 'true',
            })
            expect(result.success).toBe(false)
        })

        test('should reject number value for boolean field', () => {
            const result = updateNotificationSchema.safeParse({
                notifyProductUpdates: 1,
            })
            expect(result.success).toBe(false)
        })

        test('should reject null value for boolean field', () => {
            const result = updateNotificationSchema.safeParse({
                notifySecurityAlerts: null,
            })
            expect(result.success).toBe(false)
        })

        test('should reject multiple invalid fields', () => {
            const result = updateNotificationSchema.safeParse({
                notifyProjectActivity: 'true',
                notifySecurityAlerts: 0,
            })
            expect(result.success).toBe(false)
        })
    })

    describe('chatSuggestionsSchema', () => {
        test('should accept chatSuggestions true', () => {
            const result = chatSuggestionsSchema.safeParse({ chatSuggestions: true })
            expect(result.success).toBe(true)
        })

        test('should accept chatSuggestions false', () => {
            const result = chatSuggestionsSchema.safeParse({ chatSuggestions: false })
            expect(result.success).toBe(true)
        })

        test('should reject missing chatSuggestions', () => {
            const result = chatSuggestionsSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject chatSuggestions as string', () => {
            const result = chatSuggestionsSchema.safeParse({ chatSuggestions: 'true' })
            expect(result.success).toBe(false)
        })

        test('should reject chatSuggestions as number', () => {
            const result = chatSuggestionsSchema.safeParse({ chatSuggestions: 1 })
            expect(result.success).toBe(false)
        })

        test('should reject chatSuggestions as null', () => {
            const result = chatSuggestionsSchema.safeParse({ chatSuggestions: null })
            expect(result.success).toBe(false)
        })
    })

    describe('generationSoundSchema', () => {
        test('should accept ALWAYS', () => {
            const result = generationSoundSchema.safeParse({
                generationSound: GenerationSound.ALWAYS,
            })
            expect(result.success).toBe(true)
        })

        test('should accept NEVER', () => {
            const result = generationSoundSchema.safeParse({
                generationSound: GenerationSound.NEVER,
            })
            expect(result.success).toBe(true)
        })

        test('should accept FIRST_GENERATION', () => {
            const result = generationSoundSchema.safeParse({
                generationSound: GenerationSound.FIRST_GENERATION,
            })
            expect(result.success).toBe(true)
        })

        test('should reject invalid enum value', () => {
            const result = generationSoundSchema.safeParse({
                generationSound: 'INVALID',
            })
            expect(result.success).toBe(false)
        })

        test('should reject missing generationSound', () => {
            const result = generationSoundSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject number', () => {
            const result = generationSoundSchema.safeParse({ generationSound: 1 })
            expect(result.success).toBe(false)
        })

        test('should reject boolean', () => {
            const result = generationSoundSchema.safeParse({ generationSound: true })
            expect(result.success).toBe(false)
        })
    })
})

describe('profile.utils', () => {
    describe('extractFirstName', () => {
        test('should return the first name from full name', () => {
            expect(extractFirstName('Chaitanya Sonawane')).toBe('Chaitanya')
        })

        test('should return single name as-is', () => {
            expect(extractFirstName('Chaitanya')).toBe('Chaitanya')
        })

        test('should return "Profile" for empty string', () => {
            expect(extractFirstName('')).toBe('Profile')
        })

        test('should return "Profile" for whitespace-only string', () => {
            expect(extractFirstName('   ')).toBe('Profile')
        })

        test('should trim leading/trailing whitespace', () => {
            expect(extractFirstName('  John Doe  ')).toBe('John')
        })

        test('should handle multiple spaces between names', () => {
            expect(extractFirstName('John    Doe')).toBe('John')
        })

        test('should handle three-part name', () => {
            expect(extractFirstName('John Middle Last')).toBe('John')
        })
    })
})
