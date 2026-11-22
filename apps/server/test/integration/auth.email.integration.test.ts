import { prisma } from '@december/database'
import bcrypt from 'bcrypt'
import { describe, it, expect, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { env } from '../../src/env'
import { cleanupTestUser, getRandomIP } from '../helpers'

const CODE = '246810'

// Replace the emailed code with a known one, as if it was sent 31 s ago (past the resend wait).
const setKnownCode = async (email: string, extra: Record<string, unknown> = {}) => {
    await prisma.user.update({
        where: { email },
        data: {
            otpHash: await bcrypt.hash(CODE, env.BCRYPT_SALT_ROUNDS),
            otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000 - 31 * 1000),
            otpAttempts: 0,
            ...extra,
        },
    })
}

const start = (email: string) =>
    request(app)
        .post('/api/v1/auth/email/start')
        .set('x-forwarded-for', getRandomIP())
        .send({ email })

const verify = (email: string, otp: string) =>
    request(app)
        .post('/api/v1/auth/email/verify')
        .set('x-forwarded-for', getRandomIP())
        .send({ email, otp })

describe('Email code auth (one flow for sign up and log in)', () => {
    const newEmail = `emailauth-new-${Date.now()}@example.com`
    const socialEmail = `emailauth-social-${Date.now()}@example.com`
    const lockEmail = `emailauth-lock-${Date.now()}@example.com`

    afterAll(async () => {
        for (const email of [newEmail, socialEmail, lockEmail]) {
            await cleanupTestUser({ email })
        }
    })

    it('creates an unverified user for a new email and sends a code', async () => {
        const res = await start(newEmail)

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('otp sent to email')

        const user = await prisma.user.findUnique({ where: { email: newEmail } })
        expect(user?.emailVerified).toBe(false)
        expect(user?.otpHash).not.toBeNull()
    })

    it('refuses a second code within 30 seconds', async () => {
        const res = await start(newEmail)
        expect(res.status).toBe(429)
    })

    it('verifies the code, marks the email verified and signs the user in', async () => {
        await setKnownCode(newEmail)

        const res = await verify(newEmail, CODE)

        expect(res.status).toBe(200)
        expect(res.body.data.accessToken).toBeDefined()
        expect(res.body.data.isNewUser).toBe(true)
        expect(res.headers['set-cookie']).toBeDefined()

        const user = await prisma.user.findUnique({ where: { email: newEmail } })
        expect(user?.emailVerified).toBe(true)
        expect(user?.otpHash).toBeNull()
    })

    it('a code works only once', async () => {
        const res = await verify(newEmail, CODE)
        expect(res.status).toBe(401)
    })

    it('logs in an existing verified user with a new code', async () => {
        await prisma.user.update({ where: { email: newEmail }, data: { otpExpiresAt: null } })
        expect((await start(newEmail)).status).toBe(200)
        await setKnownCode(newEmail)

        const res = await verify(newEmail, CODE)

        expect(res.status).toBe(200)
        expect(res.body.data.isNewUser).toBe(false)
    })

    it('signs in an account that was created with google', async () => {
        await prisma.user.create({
            data: { name: 'social', email: socialEmail, emailVerified: true, googleId: 'g-123' },
        })
        expect((await start(socialEmail)).status).toBe(200)
        await setKnownCode(socialEmail)

        const res = await verify(socialEmail, CODE)

        expect(res.status).toBe(200)
        expect(res.body.data.isNewUser).toBe(false)
    })

    it('voids the code after 5 wrong tries, even if the 6th try is right', async () => {
        await prisma.user.create({
            data: { name: 'lock', email: lockEmail, emailVerified: true },
        })
        await setKnownCode(lockEmail)

        for (let i = 0; i < 4; i++) {
            expect((await verify(lockEmail, '000000')).status).toBe(401)
        }
        expect((await verify(lockEmail, '000000')).status).toBe(429)

        const res = await verify(lockEmail, CODE)
        expect(res.status).toBe(401)

        const user = await prisma.user.findUnique({ where: { email: lockEmail } })
        expect(user?.otpHash).toBeNull()
    })

    it('rejects a code for an unknown email', async () => {
        const res = await verify(`nobody-${Date.now()}@example.com`, CODE)
        expect(res.status).toBe(401)
    })

    it('rejects a badly formed code', async () => {
        const res = await verify(newEmail, '12ab')
        expect(res.status).toBe(400)
    })
})
