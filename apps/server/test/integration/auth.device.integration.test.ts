import { prisma } from '@december/database'
import { describe, it, expect, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { authCookieToken, cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

describe('Auth Device CLI Flow Integration Tests', () => {
    const testEmail = `devicetest-${Date.now()}@example.com`
    let testUserId: string
    let userAccessToken: string
    let deviceCode: string
    let userCode: string

    afterAll(async () => {
        if (testUserId) {
            await cleanupTestUser({ id: testUserId })
        }
    })

    it('setup: create authenticated user for device verification', async () => {
        const user = await prisma.user.create({
            data: {
                email: testEmail,
                name: 'Device Test User',
                emailVerified: true,
            },
        })
        testUserId = user.id

        const loginRes = await signInWithEmailCode(app, testEmail)

        userAccessToken = authCookieToken(loginRes)
    })

    it('1. POST /api/v1/auth/device/code - generates deviceCode & userCode', async () => {
        const res = await request(app)
            .post('/api/v1/auth/device/code')
            .set('x-forwarded-for', getRandomIP())
            .send({})

        expect(res.status).toBe(200)
        expect(res.body.data.deviceCode).toBeDefined()
        expect(res.body.data.userCode).toBeDefined()
        expect(res.body.data.verificationUri).toBeDefined()

        deviceCode = res.body.data.deviceCode
        userCode = res.body.data.userCode
    })

    it('2. POST /api/v1/auth/device/token - returns authorization_pending when pending', async () => {
        const res = await request(app)
            .post('/api/v1/auth/device/token')
            .set('x-forwarded-for', getRandomIP())
            .send({ deviceCode })

        expect(res.status).toBe(400)
        expect(res.body.message).toBe('authorization_pending')
    })

    it('3. POST /api/v1/auth/device/verify - authorizes device code with logged-in user', async () => {
        const res = await request(app)
            .post('/api/v1/auth/device/verify')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${userAccessToken}`)
            .send({ userCode })

        expect(res.status).toBe(200)
        expect(res.body.message).toBe('device successfully authorized')

        // Re-verifying an already approved code should succeed with already_activated
        const repeatRes = await request(app)
            .post('/api/v1/auth/device/verify')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${userAccessToken}`)
            .send({ userCode })

        expect(repeatRes.status).toBe(200)
        expect(repeatRes.body.data.status).toBe('already_activated')
    })

    it('4. POST /api/v1/auth/device/token - returns access token once approved', async () => {
        const res = await request(app)
            .post('/api/v1/auth/device/token')
            .set('x-forwarded-for', getRandomIP())
            .send({ deviceCode })

        expect(res.status).toBe(200)
        expect(res.body.data.token).toBeDefined()
        expect(res.body.data.email).toBe(testEmail)
    })

    it('5. GET /api/v1/auth/device/status - checks active device status and code status', async () => {
        const statusRes = await request(app)
            .get('/api/v1/auth/device/status')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${userAccessToken}`)

        expect(statusRes.status).toBe(200)
        expect(statusRes.body.data.activated).toBe(true)
        expect(statusRes.body.data.status).toBe('already_activated')

        const codeStatusRes = await request(app)
            .get(`/api/v1/auth/device/status?code=${userCode}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${userAccessToken}`)

        expect(codeStatusRes.status).toBe(200)
        expect(codeStatusRes.body.data.activated).toBe(true)
        expect(codeStatusRes.body.data.status).toBe('already_activated')
    })

    // #636: the devices list on the account page
    it('6. GET /api/v1/auth/sessions - a cli sign-in shows in the devices list with kind cli', async () => {
        // the whole device flow again, with the user agent the cli sends (apps/cli auth/device.ts)
        const codeRes = await request(app)
            .post('/api/v1/auth/device/code')
            .set('x-forwarded-for', getRandomIP())
            .send({})
        await request(app)
            .post('/api/v1/auth/device/verify')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${userAccessToken}`)
            .send({ userCode: codeRes.body.data.userCode })
        const tokenRes = await request(app)
            .post('/api/v1/auth/device/token')
            .set('x-forwarded-for', getRandomIP())
            .set('User-Agent', 'december-cli/0.4.22 (linux; x64)')
            .send({ deviceCode: codeRes.body.data.deviceCode })
        expect(tokenRes.status).toBe(200)
        const cliToken = tokenRes.body.data.token as string

        const fromWeb = await request(app)
            .get('/api/v1/auth/sessions')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${userAccessToken}`)
        expect(fromWeb.status).toBe(200)
        const rows = fromWeb.body.data as Array<{
            label: string
            kind: string
            isCurrent: boolean
        }>
        // the web sign-in of the setup, the cli of step 4 (no user agent of its own) and this cli
        expect(rows).toHaveLength(3)
        expect(rows[0]).toMatchObject({ kind: 'web', isCurrent: true })
        expect(
            rows
                .filter((row) => row.kind === 'cli')
                .map((row) => row.label)
                .sort()
        ).toEqual(['December CLI', 'December CLI on Linux'])
        expect(rows.filter((row) => row.kind === 'cli').every((row) => !row.isCurrent)).toBe(true)

        // the cli's own token is a working sign-in: for it, its row is "this device"
        const fromCli = await request(app)
            .get('/api/v1/auth/sessions')
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${cliToken}`)
        expect(fromCli.status).toBe(200)
        expect(fromCli.body.data[0]).toMatchObject({
            label: 'December CLI on Linux',
            kind: 'cli',
            isCurrent: true,
        })
    })

    it('gives no token to an account deleted after it approved the code', async () => {
        const deletedEmail = `devicedeleted-${Date.now()}@example.com`
        const deletedUser = await prisma.user.create({
            data: { email: deletedEmail, name: 'Deleted Device User', emailVerified: true },
        })

        try {
            const codeRes = await request(app)
                .post('/api/v1/auth/device/code')
                .set('x-forwarded-for', getRandomIP())
            const { deviceCode, userCode } = codeRes.body.data

            await prisma.deviceCode.update({
                where: { userCode },
                data: { status: 'APPROVED', userId: deletedUser.id },
            })
            await prisma.user.update({
                where: { id: deletedUser.id },
                data: { isDeleted: true, deletedAt: new Date() },
            })

            const tokenRes = await request(app)
                .post('/api/v1/auth/device/token')
                .set('x-forwarded-for', getRandomIP())
                .send({ deviceCode })

            expect(tokenRes.status).toBe(403)
            expect(tokenRes.body.data?.token).toBeUndefined()
            expect(await prisma.authSession.count({ where: { userId: deletedUser.id } })).toBe(0)
        } finally {
            await cleanupTestUser({ id: deletedUser.id })
        }
    })
})
