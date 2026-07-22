import './env'
import { prisma } from '@december/database'
import { Worker, Job } from 'bullmq'
import Redis from 'ioredis'
import jwt from 'jsonwebtoken'

import { processGrpcStream } from './listener'
import { createVM, startAgentSession } from './runtime'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

const redisConnection: any = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
})

console.log("Worker started, waiting for jobs on 'agent_jobs'...")

const worker = new Worker(
    'agent_jobs',
    async (job: Job) => {
        const { sessionId, userId } = job.data
        console.log(`Processing job ${job.id} for session ${sessionId}`)

        try {
            await prisma.session.update({
                where: { id: sessionId },
                data: { vmStatus: 'RUNNING' },
            })

            // generate short-lived jwt
            const token = jwt.sign(
                { userId, sessionId },
                process.env.AGENT_TOKEN_SECRET || 'secret',
                { expiresIn: '15m' }
            )

            // start the firecracker vm!

            console.log(`Booting Firecracker VM for session ${sessionId}...`)
            await createVM(sessionId, job.data.workspaceZipUrl)
            console.log(`VM booted successfully. Establishing VSOCK Agent session...`)

            const apiHostUrl = process.env.API_URL || 'http://localhost:4000/api/v1'
            const stream = startAgentSession(
                sessionId,
                '/workspace',
                job.data.prompt || 'You are Antigravity, an AI agent.',
                token,
                apiHostUrl
            )

            // start listening in the background without blocking the worker pool
            processGrpcStream(sessionId, stream).catch((e: any) =>
                console.error('Stream failed', e)
            )

            return { status: 'RUNNING', token }
        } catch (e: any) {
            console.error(`Failed to process job ${job.id}`, e)
            await prisma.session.update({
                where: { id: sessionId },
                data: { vmStatus: 'FAILED' },
            })
            throw e
        }
    },
    {
        connection: redisConnection,
        concurrency: 5,
    }
)

worker.on('failed', (job: any, err: any) => {
    console.error(`Job ${job?.id} failed with ${err.message}`)
})
