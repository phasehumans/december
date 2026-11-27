import { Worker } from 'bullmq'
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import Redis from 'ioredis'

import { env } from '../../src/env'
import { getEmailQueue, enqueueOtpJob } from '../../src/modules/email/email.queue'

import type { EmailJobData } from '../../src/modules/email/email.types'

describe('Email Queue & Worker - Integration Tests', () => {
    let isRedisAvailable = false
    let redisClient: Redis | null = null
    const worker: Worker<EmailJobData> | null = null

    beforeAll(async () => {
        try {
            redisClient = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
                maxRetriesPerRequest: null,
                lazyConnect: true,
                enableOfflineQueue: false,
                connectTimeout: 1000,
            })
            await redisClient.ping()
            isRedisAvailable = true
        } catch {
            // Intentionally swallowed: Redis is offline in test environment
            isRedisAvailable = false
        }
    })

    afterAll(async () => {
        if (worker) {
            await worker.close().catch(() => {
                // Intentionally swallowed: worker close cleanup
            })
        }
        if (redisClient) {
            redisClient.disconnect()
        }
    })

    it('should verify email queue and job enqueuing against Redis if live', async () => {
        if (!isRedisAvailable) {
            console.log('Redis is offline. Skipping live email queue integration test.')
            return
        }

        const queue = getEmailQueue()
        expect(queue).toBeDefined()

        const otpJob = await enqueueOtpJob({
            to: 'integration-test@example.com',
            otp: '778899',
            type: 'signup',
        })

        expect(otpJob).toBeDefined()
        expect(otpJob.id).toBeDefined()

        const retrievedJob = await queue.getJob(otpJob.id!)
        expect(retrievedJob).not.toBeNull()
        expect(retrievedJob?.data.type).toBe('otp')
        expect(retrievedJob?.data.to).toBe('integration-test@example.com')
        expect(retrievedJob?.opts.priority).toBe(1)

        // Cleanup
        await retrievedJob?.remove()
    })
})
