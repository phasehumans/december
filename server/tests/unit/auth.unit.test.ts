import { describe, expect, test } from 'bun:test'
import { signupSchema, loginSchema } from '../../src/modules/auth/auth.schema'
import { getNameFromEmail, getUsername } from '../../src/modules/auth/auth.utils'

describe('auth.schema', () => {
    describe('signupSchema', () => {
        test('should accept valid email and password', () => {
            const input = {
                email: 'chaitanya@example.com',
                password: 'pass123',
            }

            const result = signupSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject invalid email formats', () => {
            const invalidEmails = [
                'plainstring',
                'missingatsign.com',
                'missingdomain@',
                '@nouser.com',
                'test@.com',
            ]

            invalidEmails.forEach((email) => {
                const result = signupSchema.safeParse({
                    email,
                    password: '123456',
                })

                expect(result.success).toBe(false)
            })
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

        test('should reject password longer than 20 chars', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: 'a'.repeat(21),
            })

            expect(result.success).toBe(false)
        })

        test('should accept password exactly 20 chars', () => {
            const result = signupSchema.safeParse({
                email: 'test@example.com',
                password: 'a'.repeat(20),
            })

            expect(result.success).toBe(true)
        })

        test('should reject missing fields', () => {
            const result = signupSchema.safeParse({})

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

        test('should reject missing fields', () => {
            const result = loginSchema.safeParse({})

            expect(result.success).toBe(false)
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
            expect(getNameFromEmail('phase123humans@gmail.com')).toBe('phasehumans')
        })

        test('should return empty string if only numbers', () => {
            expect(getNameFromEmail('123456@gmail.com')).toBe('')
        })

        test('should handle edge cases', () => {
            expect(getNameFromEmail('@gmail.com')).toBe('')
            expect(getNameFromEmail('')).toBe('')
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

            const [first, second, suffix] = parts

            expect(first!.length).toBeGreaterThan(0)
            expect(second!.length).toBeGreaterThan(0)
            expect(suffix!.length).toBe(4)
        })

        test('should generate different usernames (probabilistic)', () => {
            const usernames = new Set()

            for (let i = 0; i < 20; i++) {
                usernames.add(getUsername())
            }

            expect(usernames.size).toBeGreaterThan(1)
        })
    })
})
