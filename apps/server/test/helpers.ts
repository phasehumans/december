import { prisma } from '@december/database'
import bcrypt from 'bcrypt'
import request from 'supertest'

import { env } from '../src/env'

import type { Express, Request, Response } from 'express'

/**
 * Clean up test data for a given user email or ID.
 */
export async function cleanupTestUser(identifier: { email?: string; id?: string }) {
    try {
        if (identifier.id) {
            await prisma.deviceCode.deleteMany({ where: { userId: identifier.id } })
            await prisma.authSession.deleteMany({ where: { userId: identifier.id } })
            await prisma.user.delete({ where: { id: identifier.id } })
        } else if (identifier.email) {
            const user = await prisma.user.findUnique({ where: { email: identifier.email } })
            if (user) {
                await prisma.deviceCode.deleteMany({ where: { userId: user.id } })
                await prisma.authSession.deleteMany({ where: { userId: user.id } })
                await prisma.user.delete({ where: { id: user.id } })
            }
        }
    } catch {
        // Intentionally swallowed: test cleanup fallback
    }
}

/**
 * Mock Response object for Express controller/cookie unit tests.
 */
export function createMockResponse(): Response {
    const mockRes: any = {
        cookies: {},
        headers: {},
        statusCode: 200,
        cookie: function (name: string, value: string, options: any) {
            this.cookies[name] = { value, options }
            return this
        },
        clearCookie: function (name: string, options: any) {
            this.cookies[name] = { value: '', options: { ...options, maxAge: 0 } }
            return this
        },
        status: function (code: number) {
            this.statusCode = code
            return this
        },
        json: function (data: any) {
            this.body = data
            return this
        },
        setHeader: function (name: string, value: any) {
            this.headers[name] = value
            return this
        },
    }
    return mockRes as Response
}

/**
 * Mock Request object for Express unit tests.
 */
export function createMockRequest(options: {
    body?: any
    headers?: Record<string, string>
    cookies?: Record<string, string>
    user?: { userId: string; sessionId: string }
    get?: (header: string) => any
}): Request {
    const mockReq: any = {
        body: options.body || {},
        headers: options.headers || {},
        cookies: options.cookies || {},
        user: options.user,
        get: options.get || ((header: string) => options.headers?.[header.toLowerCase()]),
        socket: { remoteAddress: '127.0.0.1' },
    }
    return mockReq as Request
}

/**
 * Generate a random IP address string to prevent rate-limiter collisions in tests.
 */
export function getRandomIP(): string {
    return `${Math.floor(Math.random() * 200 + 1)}.${Math.floor(Math.random() * 200 + 1)}.${Math.floor(Math.random() * 200 + 1)}.${Math.floor(Math.random() * 200 + 1)}`
}

const TEST_OTP = '135790'

/**
 * The token a sign-in or refresh set in the accessToken cookie. Web responses never have the
 * token in the body.
 */
export function authCookieToken(res: { headers: Record<string, any> }): string {
    const raw = res.headers['set-cookie']
    const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : []
    for (const cookie of cookies) {
        const match = /^accessToken=([^;]+)/.exec(cookie)
        if (match?.[1]) return decodeURIComponent(match[1])
    }
    throw new Error('no accessToken cookie in the response')
}

/**
 * Sign an existing user in the way the app does: set a known email code, then verify it.
 * Returns the supertest response. The token is only in the accessToken cookie: read it with
 * authCookieToken.
 */
export async function signInWithEmailCode(app: Express, email: string) {
    await prisma.user.update({
        where: { email },
        data: {
            otpHash: await bcrypt.hash(TEST_OTP, env.BCRYPT_SALT_ROUNDS),
            otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
            otpAttempts: 0,
        },
    })

    return request(app)
        .post('/api/v1/auth/email/verify')
        .set('x-forwarded-for', getRandomIP())
        .send({ email, otp: TEST_OTP })
}

/**
 * Create a user with a live auth session and return its id and a bearer token.
 */
export async function createSignedInUser(data: {
    email: string
    name?: string
    emailVerified?: boolean
    createdAt?: Date
}) {
    const { email, name = 'Test User', emailVerified = true, createdAt } = data
    const user = await prisma.user.create({
        data: { name, email, emailVerified, ...(createdAt ? { createdAt } : {}) },
    })
    const { generateAccessToken } = await import('../src/modules/auth/auth.utils')
    const session = await prisma.authSession.create({
        data: {
            userId: user.id,
            refreshTokenHash: `test-hash-${user.id}`,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    })
    return {
        userId: user.id,
        token: generateAccessToken({ userId: user.id, sessionId: session.id }),
    }
}

/**
 * The admin api takes only the web cookie from the web app's origin, after an
 * authenticator code in the last 12 hours. This marks the code as entered just now and
 * returns request helpers that send the cookie and the origin.
 */
export async function asAdmin(data: { userId: string; token: string }) {
    const { userId, token } = data
    await prisma.authSession.updateMany({
        where: { userId },
        data: { adminVerifiedAt: new Date() },
    })
    const { default: app } = await import('../src/app')
    const withAuth = (req: any) =>
        req
            .set('x-forwarded-for', getRandomIP())
            .set('Origin', 'http://localhost:3000')
            .set('Cookie', `accessToken=${token}`)
    return {
        get: (path: string) => withAuth(request(app).get(`/api/v1${path}`)),
        post: (path: string, body: object = {}) =>
            withAuth(request(app).post(`/api/v1${path}`)).send(body),
    }
}
