import { describe, expect, test } from 'bun:test'

import {
    updateNameSchema,
    updateUsernameSchema,
    updateAvatarUrlSchema,
    changePasswordSchema,
    updateNotificationSchema,
    chatSuggestionsSchema,
    generationSoundSchema,
    designSchema,
    submitFeedbackSchema,
    GenerationSound,
} from '../../src/modules/profile/profile.schema'
import { sanitizeMarkdown } from '../../src/modules/profile/profile.utils'

describe('profile schemas', () => {
    describe('updateNameSchema', () => {
        test('validates correct name', () => {
            const valid = updateNameSchema.safeParse({ name: 'Chaitanya' })
            expect(valid.success).toBe(true)
        })

        test('fails if name is too short', () => {
            const tooShort = updateNameSchema.safeParse({ name: 'Ch' })
            expect(tooShort.success).toBe(false)
        })

        test('fails if name is too long', () => {
            const tooLong = updateNameSchema.safeParse({ name: 'a'.repeat(21) })
            expect(tooLong.success).toBe(false)
        })
    })

    describe('updateUsernameSchema', () => {
        test('validates correct username', () => {
            const valid = updateUsernameSchema.safeParse({ username: 'chaitanya_dev' })
            expect(valid.success).toBe(true)
        })

        test('fails if username contains invalid characters', () => {
            const invalidChars = updateUsernameSchema.safeParse({ username: 'chaitanya-dev' })
            expect(invalidChars.success).toBe(false)
        })

        test('fails if username is too short', () => {
            const tooShort = updateUsernameSchema.safeParse({ username: 'chai' })
            expect(tooShort.success).toBe(false)
        })

        test('fails if username is too long', () => {
            const tooLong = updateUsernameSchema.safeParse({ username: 'a'.repeat(21) })
            expect(tooLong.success).toBe(false)
        })
    })

    describe('updateAvatarUrlSchema', () => {
        test('validates valid url', () => {
            const valid = updateAvatarUrlSchema.safeParse({
                avatarUrl: 'https://example.com/avatar.png',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if avatarUrl is not a valid URL', () => {
            const invalid = updateAvatarUrlSchema.safeParse({ avatarUrl: 'not-a-url' })
            expect(invalid.success).toBe(false)
        })

        test('fails if avatarUrl is too long', () => {
            const tooLong = updateAvatarUrlSchema.safeParse({
                avatarUrl: 'https://example.com/' + 'a'.repeat(500),
            })
            expect(tooLong.success).toBe(false)
        })
    })

    describe('changePasswordSchema', () => {
        test('validates valid passwords', () => {
            const valid = changePasswordSchema.safeParse({
                currentPassword: 'oldpassword123',
                newPassword: 'newpassword123',
            })
            expect(valid.success).toBe(true)
        })

        test('validates when currentPassword is empty or missing', () => {
            const validMissing = changePasswordSchema.safeParse({
                newPassword: 'newpassword123',
            })
            expect(validMissing.success).toBe(true)

            const validEmpty = changePasswordSchema.safeParse({
                currentPassword: '',
                newPassword: 'newpassword123',
            })
            expect(validEmpty.success).toBe(true)
        })

        test('fails if newPassword is too short', () => {
            const tooShort = changePasswordSchema.safeParse({
                newPassword: '12345',
            })
            expect(tooShort.success).toBe(false)
        })

        test('fails if newPassword is too long', () => {
            const tooLong = changePasswordSchema.safeParse({
                newPassword: 'a'.repeat(21),
            })
            expect(tooLong.success).toBe(false)
        })
    })

    describe('updateNotificationSchema', () => {
        test('validates all flags set', () => {
            const valid = updateNotificationSchema.safeParse({
                notifyProjectActivity: true,
                notifyProductUpdates: false,
                notifySecurityAlerts: true,
            })
            expect(valid.success).toBe(true)
        })

        test('validates empty payload', () => {
            const valid = updateNotificationSchema.safeParse({})
            expect(valid.success).toBe(true)
        })

        test('fails if flag is not boolean', () => {
            const invalid = updateNotificationSchema.safeParse({
                notifyProjectActivity: 'yes',
            })
            expect(invalid.success).toBe(false)
        })
    })

    describe('chatSuggestionsSchema', () => {
        test('validates true or false', () => {
            const valid = chatSuggestionsSchema.safeParse({ chatSuggestions: true })
            expect(valid.success).toBe(true)
        })

        test('fails if not boolean', () => {
            const invalid = chatSuggestionsSchema.safeParse({ chatSuggestions: 'true' })
            expect(invalid.success).toBe(false)
        })
    })

    describe('generationSoundSchema', () => {
        test('validates correct enum value', () => {
            const valid = generationSoundSchema.safeParse({
                generationSound: GenerationSound.FIRST_GENERATION,
            })
            expect(valid.success).toBe(true)
        })

        test('fails on invalid enum value', () => {
            const invalid = generationSoundSchema.safeParse({
                generationSound: 'MAYBE',
            })
            expect(invalid.success).toBe(false)
        })
    })

    describe('designSchema', () => {
        test('validates valid design string', () => {
            const valid = designSchema.safeParse({ design: 'my design content' })
            expect(valid.success).toBe(true)
        })

        test('fails if design is too long', () => {
            const tooLong = designSchema.safeParse({ design: 'a'.repeat(10001) })
            expect(tooLong.success).toBe(false)
        })
    })

    describe('submitFeedbackSchema', () => {
        test('validates correct feedback', () => {
            const valid = submitFeedbackSchema.safeParse({
                rating: 5,
                feedback: 'great product!',
            })
            expect(valid.success).toBe(true)
        })

        test('fails if feedback is empty', () => {
            const invalid = submitFeedbackSchema.safeParse({
                feedback: '',
            })
            expect(invalid.success).toBe(false)
        })

        test('fails if feedback is too long', () => {
            const invalid = submitFeedbackSchema.safeParse({
                feedback: 'a'.repeat(2001),
            })
            expect(invalid.success).toBe(false)
        })
    })
})

describe('profile utils', () => {
    test('sanitizeMarkdown replaces newlines with space and escapes special markdown characters', () => {
        const input = 'Hello\nWorld! *bold* _italic_'
        const output = sanitizeMarkdown(input)
        expect(output).toBe('Hello World\\! \\*bold\\* \\_italic\\_')
    })
})
