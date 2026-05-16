import { describe, expect, test } from 'bun:test'

import { signupSchema, loginSchema } from '../../src/modules/auth/auth.schema'
import { getNameFromEmail, getUsername } from '../../src/modules/auth/auth.utils'

describe('auth.schema', () => {
    describe('signupSchema', () => {
        test('should accept valid email and password', () => {
            const result = signupSchema.safeParse({
                email: 'chaitanya@example.com',
                password: 'pass123',
            })
            expect(result.success).toBe(true)
        })

        test('should accept email with subdomain', () => {
            const result = signupSchema.safeParse({
                email: 'user@mail.example.com',
                password: 'pass123',
            })
            expect(result.success).toBe(true)
        })

        test('should accept email with plus addressing', () => {
            const result = signupSchema.safeParse({
                email: 'user+tag@example.com',
                password: 'pass123',
            })
            expect(result.success).toBe(true)
        })

        test('should reject plain string as email', () => {
            const result = signupSchema.safeParse({
                email: 'plainstring',
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject email without @', () => {
            const result = signupSchema.safeParse({
                email: 'missingatsign.com',
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject email without domain', () => {
            const result = signupSchema.safeParse({
                email: 'missingdomain@',
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject email without user', () => {
            const result = signupSchema.safeParse({
                email: '@nouser.com',
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject email with dot-only domain', () => {
            const result = signupSchema.safeParse({
                email: 'test@.com',
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject email as a number', () => {
            const result = signupSchema.safeParse({
                email: 12345,
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject email as null', () => {
            const result = signupSchema.safeParse({
                email: null,
                password: '123456',
            })
            expect(result.success).toBe(false)
        })

        test('should reject password shorter than 6 chars', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: '12345',
            })
            expect(result.success).toBe(false)
        })

        test('should accept password exactly 6 chars', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: '123456',
            })
            expect(result.success).toBe(true)
        })

        test('should accept password exactly 20 chars', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: 'a'.repeat(20),
            })
            expect(result.success).toBe(true)
        })

        test('should reject password longer than 20 chars', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: 'a'.repeat(21),
            })
            expect(result.success).toBe(false)
        })

        test('should reject password as a number', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: 123456,
            })
            expect(result.success).toBe(false)
        })

        test('should reject password as null', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: null,
            })
            expect(result.success).toBe(false)
        })

        test('should reject missing email', () => {
            const result = signupSchema.safeParse({ password: '123456' })
            expect(result.success).toBe(false)
        })

        test('should reject missing password', () => {
            const result = signupSchema.safeParse({ email: 'test@example.com' })
            expect(result.success).toBe(false)
        })

        test('should reject empty object', () => {
            const result = signupSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject empty strings', () => {
            const result = signupSchema.safeParse({ email: '', password: '' })
            expect(result.success).toBe(false)
        })
    })

    describe('loginSchema', () => {
        test('should accept valid credentials', () => {
            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: 'password123',
            })
            expect(result.success).toBe(true)
        })

        test('should reject invalid email', () => {
            const result = loginSchema.safeParse({
                email: 'invalid',
                password: 'password123',
            })
            expect(result.success).toBe(false)
        })

        test('should reject short password', () => {
            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: '123',
            })
            expect(result.success).toBe(false)
        })

        test('should reject long password (> 20)', () => {
            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: 'a'.repeat(21),
            })
            expect(result.success).toBe(false)
        })

        test('should reject missing fields', () => {
            const result = loginSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject email as number', () => {
            const result = loginSchema.safeParse({
                email: 123,
                password: 'password123',
            })
            expect(result.success).toBe(false)
        })

        test('should reject password as boolean', () => {
            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: true,
            })
            expect(result.success).toBe(false)
        })

        test('should accept password at exact boundary 6 chars', () => {
            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: '123456',
            })
            expect(result.success).toBe(true)
        })

        test('should accept password at exact boundary 20 chars', () => {
            const result = loginSchema.safeParse({
                email: 'user@example.com',
                password: 'a'.repeat(20),
            })
            expect(result.success).toBe(true)
        })
    })
})

describe('auth.utils', () => {
    describe('getNameFromEmail', () => {
        test('should return part before @', () => {
            expect(getNameFromEmail('chaitanya@gmail.com')).toBe('chaitanya')
        })

        test('should remove numbers from username', () => {
            expect(getNameFromEmail('chaitanya123@gmail.com')).toBe('chaitanya')
        })

        test('should remove numbers in between', () => {
            expect(getNameFromEmail('phase123humans@gmail.com')).toBe('december')
        })

        test('should return empty string if only numbers', () => {
            expect(getNameFromEmail('123456@gmail.com')).toBe('')
        })

        test('should return empty string for @ at start', () => {
            expect(getNameFromEmail('@gmail.com')).toBe('')
        })

        test('should return empty string for empty input', () => {
            expect(getNameFromEmail('')).toBe('')
        })

        test('should handle email with dots in local part', () => {
            expect(getNameFromEmail('first.last@gmail.com')).toBe('first.last')
        })

        test('should handle email with underscores', () => {
            expect(getNameFromEmail('first_last@gmail.com')).toBe('first_last')
        })
    })

    describe('getUsername', () => {
        test('should return a non-empty string', () => {
            const username = getUsername()
            expect(typeof username).toBe('string')
            expect(username.length).toBeGreaterThan(0)
        })

        test('should follow pattern: word_word_suffix', () => {
            const username = getUsername()
            const parts = username.split('_')
            expect(parts.length).toBe(3)
            expect(parts[0]!.length).toBeGreaterThan(0)
            expect(parts[1]!.length).toBeGreaterThan(0)
            expect(parts[2]!.length).toBe(4)
        })

        test('should generate different usernames (probabilistic)', () => {
            const usernames = new Set()
            for (let i = 0; i < 20; i++) {
                usernames.add(getUsername())
            }
            expect(usernames.size).toBeGreaterThan(1)
        })

        test('should only contain lowercase letters, underscores, and digits in suffix', () => {
            const username = getUsername()
            expect(username).toMatch(/^[a-z]+_[a-z]+_[a-z0-9]{4}$/)
        })
    })
})
