import { describe, it, expect } from 'bun:test'

import {
    emailAuthStartSchema,
    emailAuthVerifySchema,
    googleAuthSchema,
    githubAuthSchema,
    pollDeviceTokenSchema,
    verifyUserCodeSchema,
} from '../../src/modules/auth/auth.schema'

describe('Auth Schema - Unit Tests', () => {
    describe('emailAuthStartSchema', () => {
        it('should pass with a valid email and normalize it', () => {
            const result = emailAuthStartSchema.safeParse({ email: '  Test@Example.com ' })
            expect(result.success).toBe(true)
            expect(result.data?.email).toBe('test@example.com')
        })

        it('should fail with an invalid email', () => {
            expect(emailAuthStartSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
            expect(emailAuthStartSchema.safeParse({}).success).toBe(false)
        })
    })

    describe('emailAuthVerifySchema', () => {
        it('should pass with a valid email and 6-digit code', () => {
            const valid = { email: 'test@example.com', otp: '123456' }
            expect(emailAuthVerifySchema.safeParse(valid).success).toBe(true)
        })

        it('should fail if the code is not exactly 6 digits', () => {
            for (const otp of ['12345', '1234567', '12ab56', '']) {
                expect(
                    emailAuthVerifySchema.safeParse({ email: 'test@example.com', otp }).success
                ).toBe(false)
            }
        })
    })

    describe('googleAuthSchema', () => {
        it('should pass if code is provided', () => {
            expect(googleAuthSchema.safeParse({ code: 'google-code-123' }).success).toBe(true)
        })

        it('should pass if credential is provided', () => {
            expect(
                googleAuthSchema.safeParse({ credential: 'google-jwt-credential' }).success
            ).toBe(true)
        })

        it('should fail if neither code nor credential is provided', () => {
            expect(googleAuthSchema.safeParse({}).success).toBe(false)
        })
    })

    describe('githubAuthSchema', () => {
        it('should pass if code is provided', () => {
            expect(githubAuthSchema.safeParse({ code: 'github-code-123' }).success).toBe(true)
        })

        it('should fail if code is missing or empty', () => {
            expect(githubAuthSchema.safeParse({ code: '' }).success).toBe(false)
            expect(githubAuthSchema.safeParse({}).success).toBe(false)
        })
    })

    describe('pollDeviceTokenSchema & verifyUserCodeSchema', () => {
        it('pollDeviceTokenSchema requires non-empty deviceCode', () => {
            expect(pollDeviceTokenSchema.safeParse({ deviceCode: 'dev-123' }).success).toBe(true)
            expect(pollDeviceTokenSchema.safeParse({ deviceCode: '' }).success).toBe(false)
        })

        it('verifyUserCodeSchema requires non-empty userCode', () => {
            expect(verifyUserCodeSchema.safeParse({ userCode: 'ABCD-1234' }).success).toBe(true)
            expect(verifyUserCodeSchema.safeParse({ userCode: '' }).success).toBe(false)
        })
    })
})
