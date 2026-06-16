import { describe, expect, test } from 'bun:test'
import {
    forgotPasswordRequestSchema,
    forgotPasswordResetSchema,
    forgotPasswordVerifySchema,
    signupSchema,
    loginSchema,
} from '../src'

describe('auth.schema', () => {
    describe('forgot password schemas', () => {
        test('should accept valid forgot-password inputs', () => {
            expect(
                forgotPasswordRequestSchema.safeParse({ email: 'user@example.com' }).success
            ).toBe(true)
            expect(
                forgotPasswordVerifySchema.safeParse({
                    email: 'user@example.com',
                    otp: '123456',
                }).success
            ).toBe(true)
            expect(
                forgotPasswordResetSchema.safeParse({
                    email: 'user@example.com',
                    otp: '123456',
                    newPassword: 'Password123',
                }).success
            ).toBe(true)
        })

        test('should reject malformed reset otp and short passwords', () => {
            expect(
                forgotPasswordVerifySchema.safeParse({
                    email: 'user@example.com',
                    otp: '123',
                }).success
            ).toBe(false)
            expect(
                forgotPasswordResetSchema.safeParse({
                    email: 'user@example.com',
                    otp: '123456',
                    newPassword: '123',
                }).success
            ).toBe(false)
        })
    })

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
