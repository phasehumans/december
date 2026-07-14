import Redis from 'ioredis'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'

import { env } from './env'

const redisSubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

let io: Server

export function initSocket(httpServer: any) {
    io = new Server(httpServer, {
        cors: {
            origin: env.WEB_URL,
            credentials: true,
        },
    })

    // Subscribe to all session events from Redis (Worker)
    redisSubClient.psubscribe('session_events:*', (err, count) => {
        if (err) console.error('Failed to psubscribe:', err)
        else console.log(`[Socket] Subscribed to ${count} Redis pattern(s)`)
    })

    redisSubClient.on('pmessage', (pattern, channel, message) => {
        if (pattern === 'session_events:*') {
            const sessionId = channel.replace('session_events:', '')
            try {
                const event = JSON.parse(message)
                io.to(`session:${sessionId}`).emit(event.type, event.data)
            } catch (err) {
                console.error(`[Socket] Failed to parse Redis message on ${channel}`, err)
            }
        }
    })

    io.use((socket, next) => {
        const token = socket.handshake.auth.token
        if (!token) {
            return next(new Error('Authentication error'))
        }
        try {
            const decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET) as any
            socket.data.userId = decoded.userId
            next()
        } catch (err) {
            next(new Error('Authentication error'))
        }
    })

    io.on('connection', (socket: Socket) => {
        console.log(`[Socket] User connected: ${socket.data.userId} (socket: ${socket.id})`)

        socket.on('join_session', (sessionId: string) => {
            console.log(`[Socket] User ${socket.data.userId} joined session ${sessionId}`)
            socket.join(`session:${sessionId}`)
        })

        socket.on('leave_session', (sessionId: string) => {
            socket.leave(`session:${sessionId}`)
        })

        socket.on('disconnect', () => {
            console.log(`[Socket] User disconnected: ${socket.data.userId} (socket: ${socket.id})`)
        })
    })

    return io
}

export function getIO(): Server {
    if (!io) {
        throw new Error('Socket.io is not initialized')
    }
    return io
}
