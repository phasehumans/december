import { Queue } from 'bullmq'
import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

function createRedisClient(): Redis {
    const client = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        enableOfflineQueue: false,
    })
    client.on('error', (_err) => {
        // Intentionally swallowed: handles redis connection errors gracefully when offline in test environment
    })
    return client
}

let _redisClient: Redis | null = null
export function getRedisClient() {
    if (!_redisClient) {
        _redisClient = createRedisClient()
    }
    return _redisClient
}

let _redisSubClient: Redis | null = null
export function getRedisSubClient() {
    if (!_redisSubClient) {
        _redisSubClient = createRedisClient()
    }
    return _redisSubClient
}

let _agentQueue: Queue | null = null
export function getAgentQueue() {
    if (!_agentQueue) {
        _agentQueue = new Queue('agent_jobs', { connection: getRedisClient() as any })
    }
    return _agentQueue
}

export function setAgentQueue(queue: Queue | null) {
    _agentQueue = queue
}

export async function enqueueJob(jobName: string, jobData: any) {
    return await getAgentQueue().add(jobName, jobData)
}

export type EmailJobData =
    | {
          type: 'otp'
          to: string
          otp: string
          otpType?: 'signup' | 'login'
      }
    | {
          type: 'welcome'
          to: string
          name: string
      }

let _emailQueue: Queue<EmailJobData> | null = null
export function getEmailQueue() {
    if (!_emailQueue) {
        _emailQueue = new Queue<EmailJobData>('email_jobs', {
            connection: getRedisClient() as any,
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 2000 },
                removeOnComplete: true,
                removeOnFail: 1000,
            },
        })
    }
    return _emailQueue
}

export async function enqueueEmailJob(jobName: string, jobData: EmailJobData, options?: any) {
    return await getEmailQueue().add(jobName, jobData, options)
}

// the shared client is lazy and has no offline queue: until something opens it, a publish
// fails with "Stream isn't writeable". open it on first use and wait (max 3s) until ready
const waitUntilReady = async (client: Redis) => {
    if (client.status === 'ready') return
    if (client.status === 'wait') {
        client.connect().catch(() => {
            // Intentionally swallowed: the ready wait below times out and the caller handles it
        })
    }
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            client.off('ready', onReady)
            reject(new Error('redis is not ready'))
        }, 3000)
        const onReady = () => {
            clearTimeout(timer)
            resolve()
        }
        client.once('ready', onReady)
    })
}

export async function publishEvent(channel: string, eventData: any) {
    const client = getRedisClient()
    // tests run without redis: fail fast instead of opening a connection that retries forever
    if (process.env.NODE_ENV !== 'test') {
        await waitUntilReady(client)
    }
    await client.publish(channel, JSON.stringify(eventData))
}

export function subscribeToChannel(channel: string, onMessage: (data: any) => void) {
    const subClient = getRedisSubClient()
    subClient.subscribe(channel)
    subClient.on('message', (chan, message) => {
        if (chan === channel) {
            onMessage(JSON.parse(message))
        }
    })
}
