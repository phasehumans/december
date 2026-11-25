import { createServer } from 'http'

import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import Redis from 'ioredis'
import { io as connect } from 'socket.io-client'

import { env } from '../../src/env'
import { sessionService } from '../../src/modules/session/session.service'
import { initSocket } from '../../src/socket'
import { cleanupTestUser, createSignedInUser } from '../helpers'

import type { AddressInfo } from 'net'
import type { Socket } from 'socket.io-client'

// a signed-in user reaches only their own sessions over the socket
describe('socket session ownership', () => {
    const stamp = Date.now()
    const httpServer = createServer()
    const redisUrl = env.REDIS_URL || 'redis://localhost:6379'
    const publisher = new Redis(redisUrl)
    const subscriber = new Redis(redisUrl)
    const received: Array<{ channel: string; message: string }> = []

    let owner: { userId: string; token: string }
    let stranger: { userId: string; token: string }
    let sessionId: string
    let ownerSocket: Socket
    let strangerSocket: Socket

    const open = (token: string) =>
        new Promise<Socket>((resolve, reject) => {
            const { port } = httpServer.address() as AddressInfo
            const socket = connect(`http://127.0.0.1:${port}`, {
                auth: { token },
                transports: ['websocket'],
                forceNew: true,
                reconnection: false,
            })
            socket.once('connect', () => resolve(socket))
            socket.once('connect_error', reject)
        })

    const once = <T>(socket: Socket, event: string) =>
        new Promise<T>((resolve) => socket.once(event, (payload: T) => resolve(payload)))

    /** the server has read every event this socket sent before; then a short wait for its work */
    const settle = async (socket: Socket) => {
        const pong = once(socket, 'pong')
        socket.emit('ping')
        await pong
        await new Promise((resolve) => setTimeout(resolve, 300))
    }

    const waitFor = async (check: () => boolean) => {
        const end = Date.now() + 5000
        while (!check() && Date.now() < end) {
            await new Promise((resolve) => setTimeout(resolve, 25))
        }
    }

    const on = (channel: string) =>
        received.filter((entry) => entry.channel === channel).map((entry) => entry.message)

    beforeAll(async () => {
        owner = await createSignedInUser({ email: `socket-owner-${stamp}@example.com` })
        stranger = await createSignedInUser({ email: `socket-stranger-${stamp}@example.com` })
        const session = await prisma.session.create({
            data: { userId: owner.userId, title: 'socket ownership' },
        })
        sessionId = session.id

        initSocket(httpServer)
        await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
        // the server subscribes to redis when it starts: give that a moment
        await new Promise((resolve) => setTimeout(resolve, 300))

        subscriber.on('message', (channel, message) => received.push({ channel, message }))
        await subscriber.subscribe(
            `session_question_answer:${sessionId}`,
            `session_terminal_input:${sessionId}`,
            `session_terminal_resize:${sessionId}`,
            `session_terminal_attach:${sessionId}`,
            `session_terminal_detach:${sessionId}`
        )

        ownerSocket = await open(owner.token)
        strangerSocket = await open(stranger.token)
    })

    afterAll(async () => {
        ownerSocket?.disconnect()
        strangerSocket?.disconnect()
        subscriber.disconnect()
        publisher.disconnect()
        httpServer.close()
        await cleanupTestUser({ id: owner.userId })
        await cleanupTestUser({ id: stranger.userId })
    })

    it('ownsSession is true only for the owner of the session', async () => {
        expect(await sessionService.ownsSession({ userId: owner.userId, sessionId })).toBe(true)
        expect(await sessionService.ownsSession({ userId: stranger.userId, sessionId })).toBe(false)
        expect(
            await sessionService.ownsSession({ userId: owner.userId, sessionId: 'no-such-session' })
        ).toBe(false)
        expect(await sessionService.ownsSession({ userId: undefined, sessionId })).toBe(false)
        expect(
            await sessionService.ownsSession({ userId: owner.userId, sessionId: { id: 1 } })
        ).toBe(false)
    })

    it('send_prompt to a session of another user is refused', async () => {
        const error = once<{ message: string }>(strangerSocket, 'error')
        strangerSocket.emit('send_prompt', { sessionId, prompt: 'delete everything' })

        expect((await error).message).toBe('Session not found')
        expect(await prisma.message.count({ where: { sessionId } })).toBe(0)
    })

    it('send_prompt with no text is refused: no message is saved and no run is claimed', async () => {
        for (const prompt of ['', '   \n ']) {
            const error = once<{ message: string }>(ownerSocket, 'error')
            ownerSocket.emit('send_prompt', { sessionId, prompt })
            expect((await error).message).toBe('prompt is required')
        }

        expect(await prisma.message.count({ where: { sessionId } })).toBe(0)
        // the session is free: a real prompt can still start a run
        const runId = await sessionService.claimSessionRun({ sessionId })
        expect(typeof runId).toBe('string')
        await sessionService.releaseRun({ sessionId, runId: runId! })
    })

    it('join_session gives the events of a session only to its owner', async () => {
        const strangerEvents: unknown[] = []
        strangerSocket.on('agent_event', (event) => strangerEvents.push(event))
        const ownerEvent = once<{ type: string }>(ownerSocket, 'agent_event')

        strangerSocket.emit('join_session', sessionId)
        ownerSocket.emit('join_session', sessionId)
        await settle(strangerSocket)
        await settle(ownerSocket)
        await publisher.publish(`session_events:${sessionId}`, JSON.stringify({ type: 'Probe' }))

        expect((await ownerEvent).type).toBe('Probe')
        await settle(strangerSocket)
        expect(strangerEvents).toEqual([])
    })

    it('QUESTION_ANSWER reaches the agent only from the owner', async () => {
        const channel = `session_question_answer:${sessionId}`

        strangerSocket.emit('QUESTION_ANSWER', { sessionId, questionId: 'q1', answer: 'no' })
        await settle(strangerSocket)
        ownerSocket.emit('QUESTION_ANSWER', { sessionId, questionId: 'q1', answer: 'yes' })
        await waitFor(() => on(channel).length > 0)

        expect(on(channel).map((message) => JSON.parse(message).answer)).toEqual(['yes'])
    })

    it('terminal events reach the sandbox only from the owner', async () => {
        const input = `session_terminal_input:${sessionId}`
        const resize = `session_terminal_resize:${sessionId}`
        const attach = `session_terminal_attach:${sessionId}`
        const detach = `session_terminal_detach:${sessionId}`

        strangerSocket.emit('join_session_terminal', { sessionId })
        strangerSocket.emit('TERMINAL_INPUT', { sessionId, data: 'rm -rf /\n' })
        strangerSocket.emit('TERMINAL_RESIZE', { sessionId, cols: 1, rows: 1 })
        strangerSocket.emit('leave_session_terminal', { sessionId })
        await settle(strangerSocket)

        ownerSocket.emit('join_session_terminal', { sessionId })
        ownerSocket.emit('TERMINAL_INPUT', { sessionId, data: 'ls\n' })
        ownerSocket.emit('TERMINAL_RESIZE', { sessionId, cols: 120, rows: 30 })
        await waitFor(() => on(resize).length > 0 && on(input).length > 0)
        ownerSocket.emit('leave_session_terminal', { sessionId })
        await waitFor(() => on(detach).length > 0)

        expect(on(input)).toEqual(['ls\n'])
        expect(on(resize).map((message) => JSON.parse(message))).toEqual([{ cols: 120, rows: 30 }])
        expect(on(attach).map((message) => JSON.parse(message))).toEqual([{ userId: owner.userId }])
        expect(on(detach).map((message) => JSON.parse(message))).toEqual([{ userId: owner.userId }])
    })

    it('terminal output of a session goes only to its owner', async () => {
        const strangerData: unknown[] = []
        strangerSocket.on('TERMINAL_DATA', (data) => strangerData.push(data))
        const ownerData = once<string>(ownerSocket, 'TERMINAL_DATA')

        strangerSocket.emit('join_session_terminal', { sessionId })
        ownerSocket.emit('join_session_terminal', { sessionId })
        await settle(strangerSocket)
        await settle(ownerSocket)
        await publisher.publish(`session_terminal_data:${sessionId}`, 'secret output')

        expect(await ownerData).toBe('secret output')
        await settle(strangerSocket)
        expect(strangerData).toEqual([])
    })
})
