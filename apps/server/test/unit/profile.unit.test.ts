import { describe, expect, test } from 'bun:test'
import {
    updateNameSchema,
    updateUsernameSchema,
    updateAvatarUrlSchema,
} from '../../src/modules/profile/profile.schema'

describe('profile schemas', () => {
    test('updateNameSchema validation', () => {
        const valid = updateNameSchema.safeParse({ name: 'Chaitanya' })
        expect(valid.success).toBe(true)

        const tooShort = updateNameSchema.safeParse({ name: 'Ch' })
        expect(tooShort.success).toBe(false)
    })

    test('updateUsernameSchema validation', () => {
        const valid = updateUsernameSchema.safeParse({ username: 'chaitanya_dev' })
        expect(valid.success).toBe(true)

        const invalidChars = updateUsernameSchema.safeParse({ username: 'chaitanya-dev' })
        expect(invalidChars.success).toBe(false)
    })

    test('updateAvatarUrlSchema validation', () => {
        const valid = updateAvatarUrlSchema.safeParse({
            avatarUrl: 'https://example.com/avatar.png',
        })
        expect(valid.success).toBe(true)

        const invalid = updateAvatarUrlSchema.safeParse({ avatarUrl: 'not-a-url' })
        expect(invalid.success).toBe(false)
    })
})

import { sanitizeMarkdown } from '../../src/modules/profile/profile.utils'

describe('profile utils', () => {
    test('sanitizeMarkdown replaces newlines with space and escapes special markdown characters', () => {
        const input = 'Hello\nWorld! *bold* _italic_'
        const output = sanitizeMarkdown(input)
        expect(output).toBe('Hello World\\! \\*bold\\* \\_italic\\_')
    })
})
