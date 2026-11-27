import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cliDispatcher } from '../../src/modules/cli/cli.dispatcher'
import { emailService } from '../../src/modules/email/email.service'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const as = (token?: string) => {
    const withAuth = (call: request.Test) =>
        token ? call.set('Authorization', `Bearer ${token}`) : call
    return {
        get: (path: string) =>
            withAuth(request(app).get(`/api/v1${path}`).set('x-forwarded-for', getRandomIP())),
        patch: (path: string, body: object) =>
            withAuth(
                request(app).patch(`/api/v1${path}`).set('x-forwarded-for', getRandomIP())
            ).send(body),
    }
}

// #638 section 1: the limits routes and the low balance alert with the user's amount
describe('billing limits', () => {
    const stamp = Date.now()
    const savedSendMessage = emailService.sendMessageEmail
    const emails: Array<{ to: string; subject: string; body: string }> = []
    const userIds: string[] = []
    let resolveSpy: { mockRestore: () => void }
    let count = 0

    const newUser = async () => {
        count += 1
        const email = `billing-limits-${count}-${stamp}@example.com`
        const user = await createSignedInUser({ email })
        userIds.push(user.userId)
        return { ...user, email }
    }
    const setBalance = (userId: string, creditBalance: number) =>
        prisma.user.update({ where: { id: userId }, data: { creditBalance } })
    const inboxTitles = async (userId: string) =>
        (
            await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
        ).map((row) => row.title)
    // low credits is an inbox item only: no mail (inbox review, round 2)
    const alertMails = (email: string) =>
        emails.filter(
            (sent) => sent.to === email && sent.subject === 'Your December credits are low'
        )
    /** an ai search: the server charges a small model call (under one cent) */
    const search = async (token: string, query: string) => {
        const res = await as(token).get(`/session/smart-search?q=${encodeURIComponent(query)}`)
        expect(res.status).toBe(200)
    }

    beforeAll(() => {
        emailService.sendMessageEmail = (async (data: {
            to: string
            subject: string
            body: string
        }) => {
            emails.push(data)
            return { id: `email-${emails.length}` }
        }) as any
        const mockProvider = {
            id: 'gemini',
            name: 'Gemini',
            stream: async function* () {
                yield { type: 'text', text: '{"topic":["stripe"]}' }
                yield { type: 'usage', promptTokens: 400, completionTokens: 30 }
            },
        }
        resolveSpy = spyOn(cliDispatcher, 'resolveServerProvider').mockReturnValue({
            provider: mockProvider as any,
            providerName: 'gemini',
            model: 'gemini-3.5-flash-lite',
        })
    })

    afterAll(async () => {
        resolveSpy.mockRestore()
        emailService.sendMessageEmail = savedSendMessage
        await prisma.usageEvent.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.session.deleteMany({ where: { userId: { in: userIds } } })
        await prisma.notification.deleteMany({ where: { userId: { in: userIds } } })
        for (const id of userIds) {
            await cleanupTestUser({ id })
        }
    })

    describe('GET and PATCH /billing/limits', () => {
        it('needs a signed-in user', async () => {
            expect((await as().get('/billing/limits')).status).toBe(401)
            expect((await as().patch('/billing/limits', { dayLimitCents: 500 })).status).toBe(401)
        })

        it('a new user has the $1 low balance alert and no spend limit', async () => {
            const user = await newUser()
            const res = await as(user.token).get('/billing/limits')
            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                lowBalanceAlertCents: 100,
                sessionLimitCents: null,
                dayLimitCents: null,
            })
        })

        it('saves the amounts that are sent and keeps the others', async () => {
            const user = await newUser()

            const first = await as(user.token).patch('/billing/limits', {
                sessionLimitCents: 500,
                dayLimitCents: 2000,
            })
            expect(first.status).toBe(200)
            expect(first.body.data).toEqual({
                lowBalanceAlertCents: 100,
                sessionLimitCents: 500,
                dayLimitCents: 2000,
            })

            const second = await as(user.token).patch('/billing/limits', {
                lowBalanceAlertCents: 300,
            })
            expect(second.body.data).toEqual({
                lowBalanceAlertCents: 300,
                sessionLimitCents: 500,
                dayLimitCents: 2000,
            })
            expect((await as(user.token).get('/billing/limits')).body.data).toEqual({
                lowBalanceAlertCents: 300,
                sessionLimitCents: 500,
                dayLimitCents: 2000,
            })
        })

        it('null turns one off', async () => {
            const user = await newUser()
            await as(user.token).patch('/billing/limits', { sessionLimitCents: 500 })

            const res = await as(user.token).patch('/billing/limits', {
                sessionLimitCents: null,
                lowBalanceAlertCents: null,
            })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual({
                lowBalanceAlertCents: null,
                sessionLimitCents: null,
                dayLimitCents: null,
            })
        })

        it('refuses amounts that are not whole cents from $1 to $1000', async () => {
            const user = await newUser()
            const bodies = [
                { sessionLimitCents: 99 },
                { dayLimitCents: 100001 },
                { lowBalanceAlertCents: 150.5 },
                { sessionLimitCents: '500' },
                { sessionLimitCents: -500 },
                { otherField: 500 },
                {},
            ]
            for (const body of bodies) {
                const res = await as(user.token).patch('/billing/limits', body)
                expect(res.status).toBe(400)
            }
            expect((await as(user.token).get('/billing/limits')).body.data).toEqual({
                lowBalanceAlertCents: 100,
                sessionLimitCents: null,
                dayLimitCents: null,
            })
        })
    })

    describe('the low balance alert', () => {
        it('uses the amount of the user, once for each drop under it', async () => {
            const user = await newUser()
            await as(user.token).patch('/billing/limits', { lowBalanceAlertCents: 500 })
            await setBalance(user.userId, 500)

            // the charge takes the balance under $5
            await search(user.token, `limits one ${stamp}`)
            expect(await inboxTitles(user.userId)).toEqual(['Your credits are low'])
            expect(alertMails(user.email)).toHaveLength(0)

            // more charges under the amount, and the worker's event for the same drop
            await search(user.token, `limits two ${stamp}`)
            const session = await prisma.session.create({
                data: { userId: user.userId, title: 'Run on credits' },
            })
            await sessionService.handleRunEvent({
                sessionId: session.id,
                event: { type: 'CreditsLow', balanceInCents: 499 },
            })
            expect(await inboxTitles(user.userId)).toEqual(['Your credits are low'])
            expect(alertMails(user.email)).toHaveLength(0)
        })

        it('alerts again only after a top-up took the balance over the amount', async () => {
            const user = await newUser()
            await setBalance(user.userId, 100)
            await search(user.token, `limits three ${stamp}`)
            expect(await inboxTitles(user.userId)).toEqual(['Your credits are low'])

            // a top-up that stays under $1: the same drop
            await setBalance(user.userId, 90)
            await search(user.token, `limits four ${stamp}`)
            expect(await inboxTitles(user.userId)).toEqual(['Your credits are low'])

            // a top-up over $1: no alert while the balance stays over it
            await setBalance(user.userId, 600)
            await search(user.token, `limits five ${stamp}`)
            expect(await inboxTitles(user.userId)).toEqual(['Your credits are low'])

            // and under it again: the second alert
            await setBalance(user.userId, 100)
            await search(user.token, `limits six ${stamp}`)
            expect(await inboxTitles(user.userId)).toEqual([
                'Your credits are low',
                'Your credits are low',
            ])
            expect(alertMails(user.email)).toHaveLength(0)
        })

        it('is off when the user turned it off', async () => {
            const user = await newUser()
            await as(user.token).patch('/billing/limits', { lowBalanceAlertCents: null })
            await setBalance(user.userId, 100)

            await search(user.token, `limits seven ${stamp}`)
            const session = await prisma.session.create({
                data: { userId: user.userId, title: 'Run on credits' },
            })
            await sessionService.handleRunEvent({
                sessionId: session.id,
                event: { type: 'CreditsLow', balanceInCents: 99 },
            })

            expect(await inboxTitles(user.userId)).toEqual([])
            expect(alertMails(user.email)).toHaveLength(0)
        })
    })
})
