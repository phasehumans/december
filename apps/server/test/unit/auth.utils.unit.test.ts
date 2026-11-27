import { describe, it, expect } from 'bun:test'

import {
    hashRefreshToken,
    getNameFromEmail,
    generateUserCode,
    generateAccessToken,
    verifyAccessToken,
    verifyTokenIgnoringExpiry,
    getTokenIssuedAtMs,
    isTokenReplaced,
    TOKEN_GRACE_PERIOD_MS,
    extractToken,
    sendOTP,
} from '../../src/modules/auth/auth.utils'

describe('Auth Utils - Unit Tests', () => {
    describe('hashRefreshToken', () => {
        it('should return a 64-character SHA-256 hex string', () => {
            const token = 'sample-refresh-token-12345'
            const hash = hashRefreshToken(token)
            expect(hash).toHaveLength(64)
            expect(hash).toMatch(/^[a-f0-9]{64}$/)
        })

        it('should produce identical hashes for identical inputs', () => {
            const token = 'same-token'
            expect(hashRefreshToken(token)).toBe(hashRefreshToken(token))
        })

        it('should produce different hashes for different inputs', () => {
            expect(hashRefreshToken('token1')).not.toBe(hashRefreshToken('token2'))
        })
    })

    describe('getNameFromEmail', () => {
        it('should extract local part of email and strip numbers', () => {
            expect(getNameFromEmail('john123doe456@example.com')).toBe('johndoe')
            expect(getNameFromEmail('alice@domain.org')).toBe('alice')
        })

        it('should return empty string for invalid or empty email inputs', () => {
            expect(getNameFromEmail('')).toBe('')
            expect(getNameFromEmail('invalidemail')).toBe('')
            expect(getNameFromEmail('@domain.com')).toBe('')
        })
    })

    describe('generateUserCode', () => {
        it('should generate a code in the format XXXX-XXXX', () => {
            const code = generateUserCode()
            expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
            expect(code).toHaveLength(9)
        })

        it('should generate unique user codes across multiple calls', () => {
            const code1 = generateUserCode()
            const code2 = generateUserCode()
            expect(code1).not.toBe(code2)
        })
    })

    describe('JWT Access & Refresh Token Generation / Verification', () => {
        const payload = {
            userId: 'user-uuid-123',
            sessionId: 'session-uuid-456',
        }

        it('should generate and verify a valid access token', () => {
            const token = generateAccessToken(payload)
            expect(typeof token).toBe('string')

            const decoded = verifyAccessToken(token)
            expect(decoded.userId).toBe(payload.userId)
            expect(decoded.sessionId).toBe(payload.sessionId)
        })

        it('puts the issue time in ms in the token', () => {
            const issuedAt = new Date('2026-11-26T10:00:00.123Z')
            const decoded = verifyAccessToken(generateAccessToken(payload, { issuedAt }))
            expect(getTokenIssuedAtMs(decoded)).toBe(issuedAt.getTime())
        })

        it('reads the issue time of an older token from iat in seconds', () => {
            expect(getTokenIssuedAtMs({ iat: 1_700_000_000 })).toBe(1_700_000_000_000)
        })

        it('verifyTokenIgnoringExpiry takes an expired token but not a bad signature', () => {
            const expired = generateAccessToken(payload, { expiresIn: -60 })
            expect(() => verifyAccessToken(expired)).toThrow()
            expect(verifyTokenIgnoringExpiry(expired).sessionId).toBe(payload.sessionId)
            expect(() => verifyTokenIgnoringExpiry(`${expired}x`)).toThrow()
        })

        it('should throw error when verifying invalid or tampered access token', () => {
            expect(() => verifyAccessToken('invalid.jwt.token')).toThrow()
        })
    })

    describe('isTokenReplaced', () => {
        const rotatedAt = new Date('2026-11-26T10:00:00.000Z')
        const rotatedAtMs = rotatedAt.getTime()

        it('takes every token of a session with no refresh', () => {
            expect(isTokenReplaced({ issuedAtMs: 0, rotatedAt: null })).toBe(false)
        })

        it('takes a token made at or after the last refresh', () => {
            const now = rotatedAtMs + 60_000
            expect(isTokenReplaced({ issuedAtMs: rotatedAtMs, rotatedAt, now })).toBe(false)
            expect(isTokenReplaced({ issuedAtMs: rotatedAtMs + 1, rotatedAt, now })).toBe(false)
        })

        it('takes an older token only in the grace period', () => {
            const issuedAtMs = rotatedAtMs - 1
            const inGrace = rotatedAtMs + TOKEN_GRACE_PERIOD_MS
            expect(isTokenReplaced({ issuedAtMs, rotatedAt, now: inGrace })).toBe(false)
            expect(isTokenReplaced({ issuedAtMs, rotatedAt, now: inGrace + 1 })).toBe(true)
        })

        it('reads a rotatedAt that came back from the cache as a string', () => {
            const now = rotatedAtMs + 60_000
            expect(
                isTokenReplaced({ issuedAtMs: 0, rotatedAt: rotatedAt.toISOString(), now })
            ).toBe(true)
        })
    })

    describe('extractToken', () => {
        it('should extract token from Bearer authorization header', () => {
            const req = {
                headers: { authorization: 'Bearer header-token-123' },
                cookies: {},
            }
            expect(extractToken(req)).toBe('header-token-123')
        })

        it('should fallback to cookie if authorization header is missing', () => {
            const req = {
                headers: {},
                cookies: { accessToken: 'cookie-token-456' },
            }
            expect(extractToken(req)).toBe('cookie-token-456')
        })

        it('should prioritize Bearer header over cookie if both present', () => {
            const req = {
                headers: { authorization: 'Bearer header-token-789' },
                cookies: { accessToken: 'cookie-token-456' },
            }
            expect(extractToken(req)).toBe('header-token-789')
        })

        it('should return undefined if neither header nor cookie contains token', () => {
            const req = {
                headers: { authorization: 'Basic dXNlcjpwYXNz' },
                cookies: {},
            }
            expect(extractToken(req)).toBeUndefined()
        })
    })

    describe('sendOTP', () => {
        it('should execute sendOTP without throwing', async () => {
            const { emailService } = await import('../../src/modules/email/email.service')
            const originalSendOtp = emailService.sendOtpEmail
            emailService.sendOtpEmail = async () => ({}) as any

            try {
                await expect(sendOTP('test@example.com', '123456')).resolves.toBeUndefined()
                await expect(
                    sendOTP('test@example.com', '123456', 'signup')
                ).resolves.toBeUndefined()
                await expect(
                    sendOTP('test@example.com', '123456', 'login')
                ).resolves.toBeUndefined()
            } finally {
                emailService.sendOtpEmail = originalSendOtp
            }
        })
    })
})
