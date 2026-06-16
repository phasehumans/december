import { describe, expect, test, mock, beforeEach, beforeAll } from 'bun:test'

const sendMock = mock(async (payload: any) => {
    return { data: { id: 'test-email-id' } }
})

mock.module('resend', () => {
    return {
        Resend: class {
            emails = {
                send: sendMock,
            }
        },
    }
})

let getNameFromEmail: any
let getUsername: any
let sendOTP: any
let sendWelcomeEmail: any
let verifyAccessToken: any
let verifyRefreshToken: any
let generateAccessToken: any
let generateRefreshToken: any

beforeAll(async () => {
    const utils = await import('../../src/modules/auth/auth.utils')
    getNameFromEmail = utils.getNameFromEmail
    getUsername = utils.getUsername
    sendOTP = utils.sendOTP
    sendWelcomeEmail = utils.sendWelcomeEmail
    verifyAccessToken = utils.verifyAccessToken
    verifyRefreshToken = utils.verifyRefreshToken
    generateAccessToken = utils.generateAccessToken
    generateRefreshToken = utils.generateRefreshToken
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

        test('should follow pattern: word_word', () => {
            const username = getUsername()
            const parts = username.split('_')
            expect(parts.length).toBe(2)
            expect(parts[0]!.length).toBeGreaterThan(0)
            expect(parts[1]!.length).toBeGreaterThan(0)
        })

        test('should generate different usernames (probabilistic)', () => {
            const usernames = new Set()
            for (let i = 0; i < 20; i++) {
                usernames.add(getUsername())
            }
            expect(usernames.size).toBeGreaterThan(1)
        })

        test('should only contain lowercase letters and underscores', () => {
            const username = getUsername()
            expect(username).toMatch(/^[a-z]+_[a-z]+$/)
        })
    })

    describe('email templates', () => {
        beforeEach(() => {
            sendMock.mockClear()
            process.env.SENDER_EMAIL = 'test-sender@example.com'
        })

        test('sendOTP should send email without logo and social icons', async () => {
            await sendOTP('test@example.com', '123456')

            expect(sendMock).toHaveBeenCalledTimes(1)
            const [arg] = sendMock.mock.calls[0] as [any]
            expect(arg.from).toBe('December <test-sender@example.com>')
            expect(arg.to).toBe('test@example.com')
            expect(arg.subject).toBe('Your Verification Code')

            const html = arg.html
            // The HTML should have the OTP code
            expect(html).toContain('123456')
            // The HTML should NOT contain logo-img or logoSrc references
            expect(html).not.toContain('logo-img')
            expect(html).not.toContain('December Logo')
            expect(html).not.toContain('maillogo.png')
            // The HTML should NOT contain social icons/links
            expect(html).not.toContain('social-icon')
            expect(html).not.toContain('github.png')
            expect(html).not.toContain('x.png')
            expect(html).not.toContain('GitHub')
            expect(html).not.toContain('X')
            // Check that attachments are empty
            expect(arg.attachments).toEqual([])
        })

        test('sendWelcomeEmail should send email without logo and social icons', async () => {
            await sendWelcomeEmail('welcome@example.com', 'Jane Doe')

            expect(sendMock).toHaveBeenCalledTimes(1)
            const [arg] = sendMock.mock.calls[0] as [any]
            expect(arg.from).toBe('December <test-sender@example.com>')
            expect(arg.to).toBe('welcome@example.com')
            expect(arg.subject).toBe('Welcome to December')

            const html = arg.html
            // The HTML should address the user
            expect(html).toContain('Jane Doe')
            // The HTML should NOT contain logo-img or logoSrc references
            expect(html).not.toContain('logo-img')
            expect(html).not.toContain('December Logo')
            expect(html).not.toContain('maillogo.png')
            // The HTML should NOT contain social icons/links
            expect(html).not.toContain('social-icon')
            expect(html).not.toContain('github.png')
            expect(html).not.toContain('x.png')
            expect(html).not.toContain('GitHub')
            expect(html).not.toContain('X')
            // Check that attachments are empty or undefined
            expect(arg.attachments).toBeUndefined()
        })
    })

    describe('JWT helpers', () => {
        beforeEach(() => {
            process.env.ACCESS_TOKEN_SECRET = 'unit-test-access-secret'
            process.env.REFRESH_TOKEN_SECRET = 'unit-test-refresh-secret'
        })

        test('should generate and verify valid access tokens', () => {
            const payload = { userId: 'user-123', sessionId: 'session-456' }
            const token = generateAccessToken(payload)
            expect(token).toBeString()

            const verified = verifyAccessToken(token)
            expect(verified.userId).toBe('user-123')
            expect(verified.sessionId).toBe('session-456')
        })

        test('should generate and verify valid refresh tokens', () => {
            const payload = { userId: 'user-123', sessionId: 'session-456' }
            const token = generateRefreshToken(payload)
            expect(token).toBeString()

            const verified = verifyRefreshToken(token)
            expect(verified.userId).toBe('user-123')
            expect(verified.sessionId).toBe('session-456')
        })

        test('should throw error on invalid access tokens', () => {
            expect(() => verifyAccessToken('invalid-token')).toThrow()
        })

        test('should throw error on invalid refresh tokens', () => {
            expect(() => verifyRefreshToken('invalid-token')).toThrow()
        })
    })
})
