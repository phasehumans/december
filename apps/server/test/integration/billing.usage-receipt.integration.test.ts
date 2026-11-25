import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import request from 'supertest'

import app from '../../src/app'
import { cleanupTestUser, createSignedInUser, getRandomIP } from '../helpers'

const get = (token: string, path: string) =>
    request(app)
        .get(`/api/v1${path}`)
        .set('x-forwarded-for', getRandomIP())
        .set('Authorization', `Bearer ${token}`)

const stamp = Date.now()
const userIds: string[] = []

const newUser = async (name: string, timezone?: string) => {
    const user = await createSignedInUser({
        email: `usage-receipt-${name}-${stamp}@example.com`,
        name: `Usage Receipt ${name}`,
    })
    userIds.push(user.userId)
    if (timezone) {
        await prisma.user.update({ where: { id: user.userId }, data: { timezone } })
    }
    return user
}

const addEvent = (data: {
    userId: string
    at: string
    costInCents?: number
    totalTokens?: number
    billingSource?: 'CREDITS' | 'OWN_KEY'
    sessionId?: string
}) => {
    const { userId, at, costInCents = 0, totalTokens = 0, billingSource, sessionId } = data
    const createdAt = new Date(at)
    return prisma.usageEvent.create({
        data: {
            userId,
            sessionId,
            model: 'test-model',
            totalTokens,
            costInCents,
            billingSource,
            periodStart: createdAt,
            periodEnd: createdAt,
            createdAt,
        },
    })
}

afterAll(async () => {
    for (const id of userIds) {
        await prisma.usageEvent.deleteMany({ where: { userId: id } })
        await prisma.walletTransaction.deleteMany({ where: { userId: id } })
        await prisma.session.deleteMany({ where: { userId: id } })
        await cleanupTestUser({ id })
    }
})

// #638 section 5: totals, a cost for each day and the source filter
describe('GET /billing/credits/history: totals and days', () => {
    const range = 'periodStart=2026-03-10T00:00:00.000Z&periodEnd=2026-03-12T23:59:59.999Z'

    describe('more rows than one page', () => {
        let token: string

        beforeAll(async () => {
            const user = await newUser('pages')
            token = user.token
            for (let index = 0; index < 12; index++) {
                await addEvent({
                    userId: user.userId,
                    at: `2026-03-11T10:${String(index).padStart(2, '0')}:00.000Z`,
                    costInCents: 10,
                    totalTokens: 100,
                })
            }
        })

        it('totals cover the whole range, not the page', async () => {
            const res = await get(token, `/billing/credits/history?limit=5&offset=0&${range}`)

            expect(res.status).toBe(200)
            expect(res.body.data.events).toHaveLength(5)
            expect(res.body.data.total).toBe(12)
            expect(res.body.data.totals).toEqual({
                costInCents: 120,
                totalTokens: 1200,
                sessions: 0,
            })
        })
    })

    describe('credits, own keys and sessions', () => {
        let token: string

        beforeAll(async () => {
            const user = await newUser('sources')
            token = user.token
            const first = await prisma.session.create({
                data: { userId: user.userId, title: 'same title' },
            })
            const second = await prisma.session.create({
                data: { userId: user.userId, title: 'same title' },
            })
            // two events in the first session, one in the second, one with no session
            await addEvent({
                userId: user.userId,
                at: '2026-03-10T08:00:00.000Z',
                costInCents: 30,
                totalTokens: 1000,
                sessionId: first.id,
            })
            await addEvent({
                userId: user.userId,
                at: '2026-03-10T09:00:00.000Z',
                costInCents: 20,
                totalTokens: 500,
                sessionId: first.id,
            })
            await addEvent({
                userId: user.userId,
                at: '2026-03-12T09:00:00.000Z',
                costInCents: 42,
                totalTokens: 700,
                billingSource: 'OWN_KEY',
                sessionId: second.id,
            })
            await addEvent({
                userId: user.userId,
                at: '2026-03-12T10:00:00.000Z',
                costInCents: 5,
                totalTokens: 50,
            })
            // out of the range
            await addEvent({
                userId: user.userId,
                at: '2026-03-14T10:00:00.000Z',
                costInCents: 900,
                totalTokens: 9000,
                sessionId: second.id,
            })
        })

        it('leaves own-key cost out of the cost and keeps own-key tokens in the tokens', async () => {
            const res = await get(token, `/billing/credits/history?${range}`)

            expect(res.status).toBe(200)
            expect(res.body.data.totals.costInCents).toBe(55)
            expect(res.body.data.totals.totalTokens).toBe(2250)
        })

        it('counts each session one time', async () => {
            const res = await get(token, `/billing/credits/history?${range}`)

            expect(res.body.data.totals.sessions).toBe(2)
        })

        it('filters the events and the totals by billingSource', async () => {
            const credits = await get(
                token,
                `/billing/credits/history?${range}&billingSource=CREDITS`
            )
            expect(credits.status).toBe(200)
            expect(credits.body.data.total).toBe(3)
            expect(
                credits.body.data.events.map((event: { billingSource: string }) => {
                    return event.billingSource
                })
            ).toEqual(['CREDITS', 'CREDITS', 'CREDITS'])
            expect(credits.body.data.totals).toEqual({
                costInCents: 55,
                totalTokens: 1550,
                sessions: 1,
            })

            const ownKey = await get(
                token,
                `/billing/credits/history?${range}&billingSource=OWN_KEY`
            )
            expect(ownKey.status).toBe(200)
            expect(ownKey.body.data.total).toBe(1)
            expect(ownKey.body.data.events).toHaveLength(1)
            expect(ownKey.body.data.totals).toEqual({
                costInCents: 0,
                totalTokens: 700,
                sessions: 1,
            })
        })

        it('rejects a billingSource that is not known', async () => {
            const res = await get(token, `/billing/credits/history?${range}&billingSource=FREE`)

            expect(res.status).toBe(400)
        })

        it('returns one row for each day of the range, with the days that have no usage', async () => {
            const res = await get(token, `/billing/credits/history?${range}`)

            expect(res.body.data.days).toEqual([
                { date: '2026-03-10', costInCents: 50, totalTokens: 1500 },
                { date: '2026-03-11', costInCents: 0, totalTokens: 0 },
                { date: '2026-03-12', costInCents: 5, totalTokens: 750 },
            ])
        })

        it('filters the days by billingSource', async () => {
            const res = await get(token, `/billing/credits/history?${range}&billingSource=OWN_KEY`)

            expect(res.body.data.days).toEqual([
                { date: '2026-03-10', costInCents: 0, totalTokens: 0 },
                { date: '2026-03-11', costInCents: 0, totalTokens: 0 },
                { date: '2026-03-12', costInCents: 0, totalTokens: 700 },
            ])
        })

        it('has no hours for a range of more than one day', async () => {
            const res = await get(token, `/billing/credits/history?${range}`)

            expect(res.body.data.hours).toBeUndefined()
        })
    })

    describe('a time zone that is not UTC', () => {
        let token: string
        let utcToken: string

        // 18:30 UTC is midnight in India: the two events are one minute before and after it
        const addIndiaEvents = async (userId: string) => {
            await addEvent({
                userId,
                at: '2026-03-10T18:29:00.000Z',
                costInCents: 10,
                totalTokens: 100,
            })
            await addEvent({
                userId,
                at: '2026-03-10T18:31:00.000Z',
                costInCents: 7,
                totalTokens: 70,
            })
            await addEvent({
                userId,
                at: '2026-03-11T04:15:00.000Z',
                costInCents: 3,
                totalTokens: 30,
            })
        }

        beforeAll(async () => {
            const india = await newUser('india', 'Asia/Kolkata')
            token = india.token
            await addIndiaEvents(india.userId)
            const utc = await newUser('utc')
            utcToken = utc.token
            await addIndiaEvents(utc.userId)
        })

        const twoDays = 'periodStart=2026-03-10T00:00:00.000Z&periodEnd=2026-03-11T12:00:00.000Z'
        // 11 March in India, from 00:00 to 23:59
        const oneDay = 'periodStart=2026-03-10T18:30:00.000Z&periodEnd=2026-03-11T18:29:59.999Z'

        it('puts an event in the day of the time zone of the user', async () => {
            const res = await get(token, `/billing/credits/history?${twoDays}`)

            expect(res.status).toBe(200)
            expect(res.body.data.days).toEqual([
                { date: '2026-03-10', costInCents: 10, totalTokens: 100 },
                { date: '2026-03-11', costInCents: 10, totalTokens: 100 },
            ])
        })

        it('uses UTC days for a user with no time zone set', async () => {
            const res = await get(utcToken, `/billing/credits/history?${twoDays}`)

            expect(res.body.data.days).toEqual([
                { date: '2026-03-10', costInCents: 17, totalTokens: 170 },
                { date: '2026-03-11', costInCents: 3, totalTokens: 30 },
            ])
        })

        it('uses the timezone of the request in place of the saved one', async () => {
            const res = await get(
                utcToken,
                `/billing/credits/history?${twoDays}&timezone=Asia/Kolkata`
            )

            expect(res.status).toBe(200)
            expect(res.body.data.days).toEqual([
                { date: '2026-03-10', costInCents: 10, totalTokens: 100 },
                { date: '2026-03-11', costInCents: 10, totalTokens: 100 },
            ])
        })

        // a browser can send a zone name the server does not know: the page must still load
        it('uses the saved time zone when the timezone of the request is not known', async () => {
            const res = await get(token, `/billing/credits/history?${twoDays}&timezone=Mars/Base`)

            expect(res.status).toBe(200)
            expect(res.body.data.days).toEqual([
                { date: '2026-03-10', costInCents: 10, totalTokens: 100 },
                { date: '2026-03-11', costInCents: 10, totalTokens: 100 },
            ])
        })

        it('returns 24 hours in the time zone of the user for a one-day range', async () => {
            const res = await get(token, `/billing/credits/history?${oneDay}`)

            expect(res.status).toBe(200)
            const hours = res.body.data.hours as Array<{
                hour: number
                costInCents: number
                totalTokens: number
            }>
            expect(hours.map((row) => row.hour)).toEqual([
                0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
                23,
            ])
            // 00:01 in India
            expect(hours[0]).toEqual({ hour: 0, costInCents: 7, totalTokens: 70 })
            // 09:45 in India
            expect(hours[9]).toEqual({ hour: 9, costInCents: 3, totalTokens: 30 })
            expect(hours.filter((row) => row.costInCents === 0)).toHaveLength(22)
            expect(res.body.data.days).toEqual([
                { date: '2026-03-11', costInCents: 10, totalTokens: 100 },
            ])
        })

        it('ends the hours at the hour of the end of the range', async () => {
            // 14:37 in India, for the 24 hours before it
            const res = await get(
                token,
                '/billing/credits/history?periodStart=2026-03-10T09:07:00.000Z&periodEnd=2026-03-11T09:07:00.000Z'
            )

            const hours = res.body.data.hours as Array<{ hour: number; costInCents: number }>
            expect(hours).toHaveLength(24)
            expect(hours[0]?.hour).toBe(15)
            expect(hours[23]?.hour).toBe(14)
            // 23:59 on 10 March, then 00:01 and 09:45 on 11 March
            expect(hours[8]).toEqual({ hour: 23, costInCents: 10, totalTokens: 100 })
            expect(hours[9]).toEqual({ hour: 0, costInCents: 7, totalTokens: 70 })
            expect(hours[18]).toEqual({ hour: 9, costInCents: 3, totalTokens: 30 })
        })
    })

    it('rejects a periodStart that is not a date', async () => {
        const user = await newUser('bad-date')
        const res = await get(user.token, '/billing/credits/history?periodStart=yesterday')

        expect(res.status).toBe(400)
    })
})

// #638 section 2: a receipt pdf for each successful payment
describe('GET /billing/transactions/:id/receipt', () => {
    let ownerToken: string
    let otherToken: string
    let ownerId: string
    let paidId: string

    /** the response body as bytes: a pdf is not text */
    const getPdf = (token: string, id: string) =>
        get(token, `/billing/transactions/${id}/receipt`)
            .buffer(true)
            .parse((response, callback) => {
                const chunks: Buffer[] = []
                response.on('data', (chunk: Buffer) => chunks.push(chunk))
                response.on('end', () => callback(null, Buffer.concat(chunks)))
            })

    const addTransaction = (data: {
        provider: 'RAZORPAY' | 'COINBASE' | 'GRANT' | 'ADJUSTMENT'
        status: 'PENDING' | 'SUCCESS' | 'FAILED'
        metadata?: object
    }) =>
        prisma.walletTransaction.create({
            data: {
                userId: ownerId,
                amountInCents: 2000,
                currency: 'USD',
                provider: data.provider,
                status: data.status,
                providerOrderId: data.provider === 'RAZORPAY' ? `order_${data.status}_638` : null,
                providerPaymentId: data.status === 'SUCCESS' ? 'pay_Receipt638' : null,
                metadata: data.metadata ?? {},
                createdAt: new Date('2026-03-11T10:00:00.000Z'),
            },
        })

    beforeAll(async () => {
        const owner = await newUser('owner')
        ownerToken = owner.token
        ownerId = owner.userId
        await prisma.user.update({
            where: { id: ownerId },
            data: { name: 'Asha (Receipt) Rao' },
        })
        const other = await newUser('other')
        otherToken = other.token

        const paid = await addTransaction({
            provider: 'RAZORPAY',
            status: 'SUCCESS',
            metadata: { amountInPaise: 190520, usdToInrRate: 95.26 },
        })
        paidId = paid.id
    })

    it('gives the owner a pdf with the payment', async () => {
        const res = await getPdf(ownerToken, paidId)

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toBe('application/pdf')
        expect(res.headers['content-disposition']).toBe(
            `attachment; filename="december-receipt-2026-03-11-${paidId.slice(0, 8)}.pdf"`
        )

        const pdf = (res.body as Buffer).toString('latin1')
        expect(pdf.startsWith('%PDF-')).toBe(true)
        expect(pdf.endsWith('%%EOF')).toBe(true)
        expect(pdf).toContain('(December) Tj')
        expect(pdf).toContain('(Receipt) Tj')
        expect(pdf).toContain('(Date: 11 March 2026) Tj')
        expect(pdf).toContain('(Amount paid: INR 1,905.20) Tj')
        expect(pdf).toContain('(Credits added: USD 20.00) Tj')
        expect(pdf).toContain('(Payment ID: pay_Receipt638) Tj')
        expect(pdf).toContain('(Order ID: order_SUCCESS_638) Tj')
        // the brackets in the name are escaped in a pdf string
        expect(pdf).toContain('(Asha \\(Receipt\\) Rao) Tj')
        expect(pdf).toContain(`(usage-receipt-owner-${stamp}@example.com) Tj`)
        expect(pdf).not.toMatch(/tax|gst/i)
    })

    it('shows the amount in USD when the payment has no INR amount', async () => {
        const paid = await prisma.walletTransaction.create({
            data: {
                userId: ownerId,
                amountInCents: 1250,
                currency: 'USD',
                provider: 'COINBASE',
                status: 'SUCCESS',
                providerPaymentId: 'charge_638',
            },
        })

        const res = await getPdf(ownerToken, paid.id)

        expect(res.status).toBe(200)
        const pdf = (res.body as Buffer).toString('latin1')
        expect(pdf).toContain('(Amount paid: USD 12.50) Tj')
        expect(pdf).not.toContain('Credits added')
        expect(pdf).not.toContain('INR')
        expect(pdf).toContain('(Payment ID: charge_638) Tj')
        expect(pdf).not.toContain('Order ID')
    })

    it('answers 404 to another user', async () => {
        const res = await get(otherToken, `/billing/transactions/${paidId}/receipt`)

        expect(res.status).toBe(404)
        expect(res.headers['content-type']).toContain('application/json')
    })

    it('answers 404 for a pending and for a failed payment', async () => {
        const pending = await addTransaction({ provider: 'RAZORPAY', status: 'PENDING' })
        const failed = await addTransaction({ provider: 'RAZORPAY', status: 'FAILED' })

        const pendingRes = await get(ownerToken, `/billing/transactions/${pending.id}/receipt`)
        const failedRes = await get(ownerToken, `/billing/transactions/${failed.id}/receipt`)

        expect(pendingRes.status).toBe(404)
        expect(failedRes.status).toBe(404)
    })

    it('answers 404 for free credits and for a credit change by an admin', async () => {
        const grant = await addTransaction({ provider: 'GRANT', status: 'SUCCESS' })
        const adjustment = await addTransaction({ provider: 'ADJUSTMENT', status: 'SUCCESS' })

        const grantRes = await get(ownerToken, `/billing/transactions/${grant.id}/receipt`)
        const adjustmentRes = await get(
            ownerToken,
            `/billing/transactions/${adjustment.id}/receipt`
        )

        expect(grantRes.status).toBe(404)
        expect(adjustmentRes.status).toBe(404)
    })

    it('answers 404 for an id that is not a transaction', async () => {
        const res = await get(ownerToken, '/billing/transactions/no-such-id/receipt')

        expect(res.status).toBe(404)
    })

    it('answers 401 with no sign-in', async () => {
        const res = await request(app)
            .get(`/api/v1/billing/transactions/${paidId}/receipt`)
            .set('x-forwarded-for', getRandomIP())

        expect(res.status).toBe(401)
    })
})
