import { createServer } from 'http'

import { prisma } from '@december/database'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { io as connect } from 'socket.io-client'

import { sessionService } from '../../src/modules/session/session.service'
import { getIO, initSocket } from '../../src/socket'
import { cleanupTestUser, createSignedInUser } from '../helpers'

import type { AddressInfo } from 'net'
import type { Socket } from 'socket.io-client'

// a delete takes the sockets out of that session only: the same browser tab keeps its
// connection, its notifications and its other sessions
describe('socket rooms when a session is deleted', () => {
    const stamp = Date.now()
    const httpServer = createServer()

    let owner: { userId: string; token: string }
    let socket: Socket

    const open = (token: string) =>
        new Promise<Socket>((resolve, reject) => {
            const { port } = httpServer.address() as AddressInfo
            const client = connect(`http://127.0.0.1:${port}`, {
                auth: { token },
                transports: ['websocket'],
                forceNew: true,
                reconnection: false,
            })
            client.once('connect', () => resolve(client))
            client.once('connect_error', reject)
        })

    /** the server has read every event this socket sent before; then a short wait */
    const settle = async () => {
        const pong = new Promise((resolve) => socket.once('pong', resolve))
        socket.emit('ping')
        await pong
        await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const roomSize = async (room: string) => (await getIO().in(room).fetchSockets()).length

    beforeAll(async () => {
        owner = await createSignedInUser({ email: `socket-delete-${stamp}@example.com` })
        initSocket(httpServer)
        await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve))
        await new Promise((resolve) => setTimeout(resolve, 300))
        socket = await open(owner.token)
    })

    afterAll(async () => {
        socket?.disconnect()
        httpServer.close()
        await prisma.session.deleteMany({ where: { userId: owner.userId } })
        await cleanupTestUser({ id: owner.userId })
    })

    it('keeps the tab connected and in its other rooms', async () => {
        const deleted = await prisma.session.create({
            data: { userId: owner.userId, title: 'to delete' },
        })
        const kept = await prisma.session.create({
            data: { userId: owner.userId, title: 'kept open' },
        })
        socket.emit('join_session', deleted.id)
        socket.emit('join_session', kept.id)
        await settle()
        expect(await roomSize(`session:${deleted.id}`)).toBe(1)
        expect(await roomSize(`session:${kept.id}`)).toBe(1)

        await sessionService.deleteSession({ userId: owner.userId, sessionId: deleted.id })
        await settle()

        expect(socket.connected).toBe(true)
        expect(await roomSize(`session:${deleted.id}`)).toBe(0)
        expect(await roomSize(`session:${kept.id}`)).toBe(1)
        expect(await roomSize(`user:${owner.userId}`)).toBe(1)

        // the kept session still gets its live events
        const event = new Promise<{ type: string }>((resolve) =>
            socket.once('agent_event', resolve)
        )
        getIO().to(`session:${kept.id}`).emit('agent_event', { type: 'Ping' })
        expect((await event).type).toBe('Ping')
    })
})
