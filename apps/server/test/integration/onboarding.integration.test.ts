import { prisma } from '@december/database'
import { describe, it, expect, afterAll } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { authService } from '../../src/modules/auth/auth.service'
import { cleanupTestUser, getRandomIP, signInWithEmailCode } from '../helpers'

// Every new user must go through /onboarding once: no sign-up path may set the completion date.
describe('Onboarding: every new user starts not done', () => {
    const stamp = Date.now()
    const emailUser = `onboarding-email-${stamp}@example.com`
    const googleUser = `onboarding-google-${stamp}@example.com`
    const githubUser = `onboarding-github-${stamp}@example.com`

    afterAll(async () => {
        for (const email of [emailUser, googleUser, githubUser]) {
            await cleanupTestUser({ email })
        }
    })

    const completedAtFor = async (email: string) => {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { onboardingCompletedAt: true, onboardingStep: true },
        })
        return user
    }

    it('email code sign-up', async () => {
        const startRes = await request(app)
            .post('/api/v1/auth/email/start')
            .set('x-forwarded-for', getRandomIP())
            .send({ email: emailUser })
        expect(startRes.status).toBe(200)

        const verifyRes = await signInWithEmailCode(app, emailUser)
        expect(verifyRes.status).toBe(200)

        const user = await completedAtFor(emailUser)
        expect(user?.onboardingCompletedAt).toBeNull()
        expect(user?.onboardingStep).toBeNull()
    })

    it('Google sign-up', async () => {
        await authService.google({
            name: 'Onboarding Google',
            email: googleUser,
            sub: `google-${stamp}`,
        })

        const user = await completedAtFor(googleUser)
        expect(user).not.toBeNull()
        expect(user?.onboardingCompletedAt).toBeNull()
    })

    it('GitHub sign-up', async () => {
        await authService.github({
            name: 'Onboarding GitHub',
            email: githubUser,
            sub: `github-${stamp}`,
            username: `onboarding-${stamp}`,
        })

        const user = await completedAtFor(githubUser)
        expect(user).not.toBeNull()
        expect(user?.onboardingCompletedAt).toBeNull()
    })
})
