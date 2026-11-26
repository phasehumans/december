import { Queue } from 'bullmq'
import Redis from 'ioredis'

import { env } from '../../env'

import type { DataExportJobData } from './setting.types'

// tests use their own queue, so the dev server's worker never builds and emails a test export
export const DATA_EXPORT_QUEUE = env.NODE_ENV === 'test' ? 'data_export_test' : 'data_export'

type DataExportQueue = Pick<Queue<DataExportJobData>, 'add'>

let _dataExportQueue: DataExportQueue | null = null

const getDataExportQueue = (): DataExportQueue => {
    if (!_dataExportQueue) {
        const redisConnection = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableOfflineQueue: false,
        })
        redisConnection.on('error', (_err) => {
            // Intentionally swallowed: the request fails with a clear error when Redis is offline
        })
        _dataExportQueue = new Queue<DataExportJobData>(DATA_EXPORT_QUEUE, {
            connection: redisConnection as any,
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: 'exponential', delay: 5000 },
                removeOnComplete: true,
                removeOnFail: 100,
            },
        })
    }
    return _dataExportQueue
}

/**
 * True on the attempt after which the queue gives up (the same rule as BullMQ). A failed
 * attempt before it is tried again, so the user is told only when this one fails.
 */
export const isLastDataExportAttempt = (job: {
    attemptsMade: number
    opts: { attempts?: number }
}): boolean => job.attemptsMade + 1 >= (job.opts.attempts ?? 1)

/** for tests: a queue that records jobs instead of using Redis */
export const setDataExportQueue = (queue: DataExportQueue | null) => {
    _dataExportQueue = queue
}

export const enqueueDataExport = async (data: DataExportJobData) => {
    return getDataExportQueue().add('export', data)
}
