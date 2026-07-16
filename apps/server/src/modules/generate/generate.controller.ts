import type { Request, Response } from 'express'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import crypto from 'crypto'
import { env } from '../../env'
import { asyncHandler } from '../../shared/asyncHandler'

const pubClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
})

export const generateProjectStream = asyncHandler(async (req: Request, res: Response) => {
    const { prompt, projectId, model, errorMessage, stack } = req.body
    const userId = req.user?.userId as string | undefined

    if (!userId) {
        res.status(401).json({ success: false, message: 'unauthorized' })
        return
    }

    const sessionId = crypto.randomUUID()

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Send connected event
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`)

    const subClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')
    subClient.subscribe(`session_events:${sessionId}`)

    subClient.on('message', (channel, message) => {
        if (channel === `session_events:${sessionId}`) {
            try {
                const event = JSON.parse(message)
                res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`)

                if (event.type === 'result' || event.type === 'error') {
                    subClient.quit()
                    res.end()
                }
            } catch (err) {
                console.error('[Generate] Failed to parse event', err)
            }
        }
    })

    req.on('close', () => {
        subClient.quit()
    })

    // Enqueue job
    try {
        const agentJobsQueue = new Queue('agent_jobs', { connection: pubClient as any })
        await agentJobsQueue.add('run_agent', {
            sessionId,
            projectId,
            userId,
            prompt: prompt || errorMessage, // fallback for fix route
            model,
            errorMessage,
            stack,
            secrets: [], // empty for now
        })
    } catch (err: any) {
        res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`)
        subClient.quit()
        res.end()
    }
})
