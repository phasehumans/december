import { describe, expect, test } from 'bun:test'
import { signupSchema, loginSchema } from '../../src/modules/auth/auth.schema'
import { getUsernameFromEmail } from '../../src/modules/auth/auth.utils'

describe('auth.schema', () => {
    describe('signupSchema', () => {
        test('should accept valid email and password', () => {
            // AAA method : arrange, act , assert
            const input = {
                email: 'chaitanya@example.com',
                password: 'pass12',
            }

            const result = signupSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject invalid email', () => {
            const input = {
                email: 'invalidemailsample',
                password: '123456',
            }

            const result = signupSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject email without end domain', () => {
            const input = {
                email: 'chaitanya@',
                password: '123456',
            }

            const result = signupSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject password shorter than 6 chars', () => {
            const input = {
                email: 'chaitanya@example.com',
                password: '12345',
            }

            const result = signupSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject password longer than 20 chars', () => {
            const input = {
                email: 'chaitanya@example.com',
                password: '123456789012345678901',
            }

            const result = signupSchema.safeParse(input)

            expect(result.success).toBe(false)
        })
    })

    describe('loginSchema', () => {
        test('should accept valid email and password', () => {
            const input = {
                email: 'chaitanya@example.com',
                password: 'pass@1234',
            }

            const result = loginSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject invalid email', () => {
            const input = {
                email: 'invalidemailsample',
                password: '123456',
            }

            const result = loginSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject email without end domain', () => {
            const input = {
                email: 'chaitanya@',
                password: '123456',
            }

            const result = loginSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject password shorter than 6 chars', () => {
            const input = {
                email: 'chaitanya@example.com',
                password: '12345',
            }

            const result = loginSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject password longer than 20 chars', () => {
            const input = {
                email: 'chaitanya@example.com',
                password: '123456789012345678901',
            }

            const result = loginSchema.safeParse(input)

            expect(result.success).toBe(false)
        })
    })
})

describe('auth.utils', () => {
    describe('getUsernameFromEmail', () => {
        test('should return the part before @', () => {
            const result = getUsernameFromEmail('chaitanya@gmail.com')

            expect(result).toBe('chaitanya')
        })

        test('should remove numbers from the username part', () => {
            const result = getUsernameFromEmail('chaitanya123@gmail.com')

            expect(result).toBe('chaitanya')
        })

        test('should return empty string when username part contains only numbers', () => {
            const result = getUsernameFromEmail('12345@example.com')

            expect(result).toBe('')
        })

        test('should remove numbers from the username part in between', () => {
            const result = getUsernameFromEmail('phase123humans@example.com')

            expect(result).toBe('phasehumans')
        })
    })
})
