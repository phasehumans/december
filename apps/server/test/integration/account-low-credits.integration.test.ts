import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cliDispatcher } from '../../src/modules/cli/cli.dispatcher'
import { emailService } from '../../src/modules/email/email.service'
import { sessionService } from '../../src/modules/session/session.service'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const authed = (token: string) => ({
    get: (path: string) =>
        request(app)
            .get(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`),
    post: (path: string, body: object) =>
        request(app)
            .post(`/api/v1${path}`)
            .set('x-forwarded-for', getRandomIP())
            .set('Authorization', `Bearer ${token}`)
            .send(body),
})

// #636: credits charged on the server (search, commands, the cli model proxy) raise the low
// credits alert too, not only the worker's run charge. the amount is $1 (100 cents)
describe('low credits alert from charges on the server', () => {
    const stamp = Date.now()
    const savedSendMessage = emailService.sendMessageEmail
    const emails: Array<{ to: string; subject: string; body: string }> = []
    const userIds: string[] = []
    let resolveSpy: { mockRestore: () => void }
    let count = 0

    /** a user with a balance in cents */
    const userWith = async (balanceInCents: number) => {
        count += 1
        const email = `low-credits-${count}-${stamp}@example.com`
        const user = await createSignedInUser({ email })
        userIds.push(user.userId)
        await prisma.user.update({
            where: { id: user.userId },
            data: { creditBalance: balanceInCents },
        })
        return { ...user, email }
    }
    const inboxTitles = async (token: string) =>
        (
            (await authed(token).get('/notification')).body.data.notifications as Array<{
                title: string
            }>
        ).map((row) => row.title)
    const alertMails = (email: string) =>
        emails.filter(
            (sent) => sent.to === email && sent.subject === 'Your December credits are low'
        )
    /** an ai search: the server charges the model call to the user's credits */
    const search = async (token: string, query: string) => {
        const res = await authed(token).get(`/session/smart-search?q=${encodeURIComponent(query)}`)
        expect(res.status).toBe(200)
    }
    const balanceOf = async (userId: string) =>
        (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).creditBalance

    beforeAll(() => {
        emailService.sendMessageEmail = (async (data: {
            to: string
            subject: string
            body: string
        }) => {
            emails.push(data)
            return { id: `email-${emails.length}` }
        }) as any
        // the model is an outside service: it answers with fixed filters and a token count
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

    it('a search charge that takes the balance under $1 tells the user, once', async () => {
        const user = await userWith(100)

        await search(user.token, `stripe one ${stamp}`)
        expect(await balanceOf(user.userId)).toBeLessThan(100)

        expect(await inboxTitles(user.token)).toEqual(['Your credits are low'])
        expect(alertMails(user.email)).toHaveLength(1)
        expect(alertMails(user.email)[0]?.body).toContain('Your balance is $0.99.')

        // the next charge is under $1 too: it is the same drop
        await search(user.token, `stripe two ${stamp}`)
        expect(await inboxTitles(user.token)).toEqual(['Your credits are low'])
        expect(alertMails(user.email)).toHaveLength(1)
    })

    it('a charge that leaves the balance over $1 does not alert', async () => {
        const user = await userWith(500)
        await search(user.token, `stripe three ${stamp}`)
        expect(await balanceOf(user.userId)).toBeLessThan(500)
        expect(await inboxTitles(user.token)).toEqual([])
        expect(alertMails(user.email)).toHaveLength(0)
    })

    it('a charge on a balance that is under $1 already does not alert', async () => {
        const user = await userWith(50)
        await search(user.token, `stripe four ${stamp}`)
        expect(await balanceOf(user.userId)).toBeLessThan(50)
        expect(await inboxTitles(user.token)).toEqual([])
    })

    it('a cli model call that takes the balance under $1 tells the user', async () => {
        const user = await userWith(100)

        const res = await authed(user.token).post('/cli/chat/completions', {
            model: 'gemini-3.6-flash',
            messages: [{ role: 'user', content: 'hi' }],
        })
        expect(res.status).toBe(200)

        // the proxy charges after the stream ends, so give it a moment
        let titles: string[] = []
        for (let tries = 0; tries < 40 && titles.length === 0; tries += 1) {
            await new Promise((resolve) => setTimeout(resolve, 50))
            titles = await inboxTitles(user.token)
        }
        expect(titles).toEqual(['Your credits are low'])
        expect(alertMails(user.email)).toHaveLength(1)
    })

    it('the worker and the server do not both alert for one drop', async () => {
        const user = await userWith(100)
        const session = await prisma.session.create({
            data: { userId: user.userId, title: 'Run on credits' },
        })

        // a charge on the server takes the balance under $1
        await search(user.token, `stripe five ${stamp}`)
        // the worker's alert for the same drop comes in (the event of its run charge)
        await sessionService.handleRunEvent({
            sessionId: session.id,
            event: { type: 'CreditsLow', balanceInCents: 99 },
        })

        expect(await inboxTitles(user.token)).toEqual(['Your credits are low'])
        expect(alertMails(user.email)).toHaveLength(1)
    })
})
