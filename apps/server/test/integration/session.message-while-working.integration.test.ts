import { prisma } from '@december/database'
import { runMarkKey, steeringListKey } from '@december/shared'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'

import { env } from '../../src/env'
import { sessionService } from '../../src/modules/session/session.service'
import { decidePromptRoute, readMessageWhileWorking } from '../../src/modules/session/session.utils'
import { cleanupTestUser, createSignedInUser } from '../helpers'

// #637 section 7: a new message while December works
describe('a new message while December works', () => {
    describe('the decision', () => {
        it('starts a run when no run is active, in both modes', () => {
            expect(decidePromptRoute({ runActive: false, mode: 'queue' })).toBe('run')
            expect(decidePromptRoute({ runActive: false, mode: 'send' })).toBe('run')
        })

        it('queues the message during a run on "queue"', () => {
            expect(decidePromptRoute({ runActive: true, mode: 'queue' })).toBe('queued')
        })

        it('sends the message to the running agent on "send"', () => {
            expect(decidePromptRoute({ runActive: true, mode: 'send' })).toBe('steer')
        })

        it('reads "queue" for an account with no saved preference', () => {
            expect(readMessageWhileWorking(null)).toBe('queue')
            expect(readMessageWhileWorking({ sendKey: 'enter' })).toBe('queue')
            expect(readMessageWhileWorking({ messageWhileWorking: 'send' })).toBe('send')
            expect(readMessageWhileWorking({ messageWhileWorking: 'other' })).toBe('queue')
        })
    })

    describe('one run for a session', () => {
        const stamp = Date.now()
        const sessionIds: string[] = []
        const redis = new Redis(env.REDIS_URL || 'redis://localhost:6379')
        const route = async (data: { userId?: string; sessionId: string }) =>
            (await sessionService.routePrompt(data)).route
        const deliver = async (data: Parameters<typeof sessionService.deliverSteering>[0]) =>
            (await sessionService.deliverSteering(data)).delivery
        /** what the worker does when the run ends */
        const endRun = (sessionId: string) => redis.del(runMarkKey(sessionId))
        let queueUser: { userId: string; token: string }
        let sendUser: { userId: string; token: string }

        const newSession = async (userId: string, title: string) => {
            const session = await prisma.session.create({ data: { userId, title } })
            sessionIds.push(session.id)
            return session.id
        }

        beforeAll(async () => {
            queueUser = await createSignedInUser({ email: `while-working-q-${stamp}@example.com` })
            sendUser = await createSignedInUser({ email: `while-working-s-${stamp}@example.com` })
            await prisma.user.update({
                where: { id: sendUser.userId },
                data: { preferences: { messageWhileWorking: 'send' } },
            })
        })

        afterAll(async () => {
            for (const sessionId of sessionIds) {
                await redis.del(runMarkKey(sessionId), steeringListKey(sessionId))
            }
            await redis.quit()
            const ids = [queueUser.userId, sendUser.userId]
            await prisma.session.deleteMany({ where: { userId: { in: ids } } })
            for (const id of ids) {
                await cleanupTestUser({ id })
            }
        })

        it('the first prompt starts the run, the second one during the run is queued', async () => {
            const sessionId = await newSession(queueUser.userId, 'queue')

            expect(await route({ userId: queueUser.userId, sessionId })).toBe('run')
            expect(await route({ userId: queueUser.userId, sessionId })).toBe('queued')
            // still one run: a third prompt is queued too
            expect(await route({ userId: queueUser.userId, sessionId })).toBe('queued')
        })

        it('a prompt with no signed-in user during a run is queued', async () => {
            const sessionId = await newSession(queueUser.userId, 'anonymous')
            expect(await route({ sessionId })).toBe('run')
            expect(await route({ sessionId })).toBe('queued')
        })

        it('on "send" the second prompt goes to the running agent, with no new run', async () => {
            const sessionId = await newSession(sendUser.userId, 'send')

            expect(await route({ userId: sendUser.userId, sessionId })).toBe('run')
            expect(await route({ userId: sendUser.userId, sessionId })).toBe('steer')
            expect(
                await deliver({
                    sessionId,
                    message: { prompt: 'use bun', userMessageSequence: 2 },
                })
            ).toBe('steered')
        })

        it('a message for a run that ended in between starts a normal run, once', async () => {
            const sessionId = await newSession(sendUser.userId, 'gap')
            expect(await route({ userId: sendUser.userId, sessionId })).toBe('run')
            // the worker clears the mark when the run ends
            await endRun(sessionId)

            expect(
                await deliver({
                    sessionId,
                    message: { prompt: 'too late for the run' },
                })
            ).toBe('run')
            // that run is now the active one: the next message reaches it
            expect(
                await deliver({
                    sessionId,
                    message: { prompt: 'one more' },
                })
            ).toBe('steered')
        })

        it('a session whose run ended takes a new run', async () => {
            const sessionId = await newSession(queueUser.userId, 'ended')
            expect(await route({ userId: queueUser.userId, sessionId })).toBe('run')
            await endRun(sessionId)

            expect(await route({ userId: queueUser.userId, sessionId })).toBe('run')
        })
    })
})
