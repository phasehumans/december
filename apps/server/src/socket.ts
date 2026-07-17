import Redis from 'ioredis'
import jwt from 'jsonwebtoken'
import { Server, Socket } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Queue } from 'bullmq'

import { env } from './env'

const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
})
const subClient = pubClient.duplicate()

// This one is specifically for subscribing to worker session events
const redisSubClient = pubClient.duplicate()

let io: Server

export function initSocket(httpServer: any) {
    io = new Server(httpServer, {
        cors: {
            origin: env.WEB_URL,
            credentials: true,
        },
        perMessageDeflate: {
            threshold: 1024, // only compress payloads larger than 1KB
        },
        adapter: createAdapter(pubClient, subClient),
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

        // Custom application-level heartbeat
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() })
        })

        socket.on(
            'send_prompt',
            async (data: { sessionId: string; prompt: string; projectId: string }) => {
                try {
                    // Fetch user secrets (Phase 3.6 Secrets Management)
                    // We'll mock decryption here since decryption logic belongs to secret service
                    const secrets: any[] = [] // Secret model doesn't exist yet, passing empty secrets
                    const decryptedSecrets = secrets.map((s: any) => ({
                        key: s.key,
                        value: s.value, // Assuming decrypted or decryption utility here
                    }))

                    // Enqueue to worker
                    const agentJobsQueue = new Queue('agent_jobs', { connection: pubClient as any })
                    await agentJobsQueue.add('run_agent', {
                        sessionId: data.sessionId,
                        projectId: data.projectId,
                        userId: socket.data.userId,
                        prompt: data.prompt,
                        secrets: decryptedSecrets, // Injecting decrypted secrets into payload
                    })
                } catch (err: any) {
                    console.error('[Socket] Failed to enqueue agent job:', err)
                    socket.emit('error', { message: 'Failed to start agent: ' + err.message })
                }
            }
        )

        socket.on('stop_session', async (data: { sessionId: string }) => {
            console.log(`[Socket] Received STOP signal for session ${data.sessionId}`)
            await pubClient.publish(
                `session_interrupts:${data.sessionId}`,
                JSON.stringify({ type: 'INTERRUPT' })
            )
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
