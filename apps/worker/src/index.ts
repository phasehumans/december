import { Agent } from '@december/agent'
import { publishEvent } from '@december/shared'
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const redisConnection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
})

console.log("Worker started, waiting for jobs on 'agent_jobs'...")

const worker = new Worker(
    'agent_jobs',
    async (job: Job) => {
        const { prompt, projectId, sessionId, userId } = job.data
        console.log(`Processing job ${job.id} for session ${sessionId}`)

        try {
            // Placeholder: Call gRPC Runtime here to boot VM

            // Send starting event
            await publishEvent(`session_events:${sessionId}`, {
                type: 'connected',
                data: { ok: true },
            })

            const agent = new Agent({
                userId,
                projectId,
                sessionId,
            } as any) // Replace any with valid Agent config

            const stream = await agent.run(prompt)
            for await (const event of stream) {
                await publishEvent(`session_events:${sessionId}`, event)
            }

            await publishEvent(`session_events:${sessionId}`, { type: 'done' })
        } catch (error: any) {
            console.error(`Error in job ${job.id}:`, error)
            await publishEvent(`session_events:${sessionId}`, {
                type: 'error',
                data: { message: error.message },
            })
            throw error
        }
    },
    { connection: redisConnection }
)

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error ${err.message}`)
})
