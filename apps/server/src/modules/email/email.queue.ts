import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { env } from '../../env'

import type { EmailJobData, SendMessageJobData, SendOtpEmailParams } from './email.types'

/**
 * tests use their own queue: the dev server shares the same local redis, and its worker
 * (with the real resend key) would otherwise pick up test jobs and send real emails
 */
export const EMAIL_QUEUE_NAME = env.NODE_ENV === 'test' ? 'email_jobs_test' : 'email_jobs'

let _emailQueue: Queue<EmailJobData> | null = null

export const getEmailQueue = (): Queue<EmailJobData> => {
    if (!_emailQueue) {
        const redisConnection = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableOfflineQueue: false,
        })
        redisConnection.on('error', (_err) => {
            // Intentionally swallowed: handles redis connection errors gracefully when offline in test environment
        })

        _emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
            connection: redisConnection as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000,
                },
                removeOnComplete: true,
                removeOnFail: 1000,
            },
        })
    }
    return _emailQueue
}

export const setEmailQueue = (queue: Queue<EmailJobData> | null) => {
    _emailQueue = queue
}

export const enqueueOtpJob = async (data: SendOtpEmailParams) => {
    const queue = getEmailQueue()
    return queue.add(
        'send_otp',
        {
            type: 'otp',
            to: data.to,
            otp: data.otp,
            otpType: data.type || 'signup',
        },
        {
            priority: 1,
        }
    )
}

export const enqueueMessageJob = async (data: Omit<SendMessageJobData, 'type'>) => {
    const queue = getEmailQueue()
    return queue.add('send_message', { type: 'message', ...data }, { priority: 10 })
}
