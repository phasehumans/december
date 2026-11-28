import { Worker, Queue } from 'bullmq'
import Redis from 'ioredis'

import { env } from './env'
import { authService } from './modules/auth/auth.service'
import { createEmailWorker } from './modules/email/email.worker'
import { sessionService } from './modules/session/session.service'
import { settingService } from './modules/setting/setting.service'
import { fetchLiveModelRates } from './modules/usage/usage.rates'
import { deletePrefix } from './shared/project-storage'

// Initialize live model rates catalog
fetchLiveModelRates().catch((err) => {
    // Intentionally swallowed: fallback to embedded official catalog if offline
    console.warn(
        '[Background] Live model rates initial fetch failed, using official catalog:',
        err?.message || err
    )
})

const redisConnection = new Redis(env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
})
redisConnection.on('error', (err) => {
    console.error('[Background Redis Error]', err?.message || err)
})

// setup minio_wipe worker
const minioWipeWorker = new Worker(
    'minio_wipe',
    async (job) => {
        const { prefix } = job.data
        console.log(`[Background] Executing minio_wipe for prefix: ${prefix}`)
        await deletePrefix(prefix)
    },
    { connection: redisConnection as any }
)

minioWipeWorker.on('failed', (job, err) => {
    console.error(`[Background] Job ${job?.id} failed with error ${err.message}`)
})

// setup sweep_cron worker
const sweepQueue = new Queue('sweep_jobs', { connection: redisConnection as any })
// add repeatable jobs
sweepQueue.add('daily_sweep', {}, { repeat: { pattern: '0 0 * * *' } })
sweepQueue.add('refresh_model_rates', {}, { repeat: { pattern: '0 */6 * * *' } })
// the daily summary mail was removed (inbox review, round 2): take its repeat out of redis,
// where it stays after the code that added it is gone
sweepQueue.removeRepeatable('daily_digest', { pattern: '*/15 * * * *' }).catch((err) => {
    console.warn('[Background] could not remove the old daily summary job:', err?.message || err)
})

const sweepWorker = new Worker(
    'sweep_jobs',
    async (job) => {
        if (job.name === 'daily_sweep') {
            console.log(`[Background] Running daily garbage collection sweep`)
            await authService.purgeExpiredAndRevokedSessions().catch((err) => {
                console.error('[Background] Failed to purge expired sessions:', err)
            })
            // accounts deleted more than 90 days ago go for good; payment rows stay
            await authService
                .purgeDeletedAccounts({})
                .then((result) => {
                    if (result.purged > 0) {
                        console.log(`[Background] Purged ${result.purged} deleted accounts`)
                    }
                })
                .catch((err) => {
                    console.error('[Background] Failed to purge deleted accounts:', err)
                })
            // zips left from the removed data export. their links no longer work, so they go.
            // remove this after 2026-12-31, when the bucket has no exports/ files
            await deletePrefix('exports/').catch((err) => {
                console.error('[Background] Failed to delete old data export files:', err)
            })
            // archive (not delete) the old sessions of users who set "archive after" (#637).
            // it keeps updatedAt, so the delete below still counts from the last real update
            await settingService
                .archiveInactiveSessions({})
                .then((result) => {
                    if (result.users > 0) {
                        console.log(`[Background] Archived old sessions of ${result.users} users`)
                    }
                })
                .catch((err) => {
                    console.error('[Background] Failed to archive old sessions:', err)
                })
            // sessions not changed for 30 days go, with all their stored files
            await sessionService
                .purgeExpiredSessions({ before: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
                .then((result) => {
                    if (result.deleted > 0) {
                        console.log(`[Background] Deleted ${result.deleted} old sessions`)
                    }
                })
                .catch((err) => {
                    console.error('[Background] Failed to delete old sessions:', err)
                })
        } else if (job.name === 'refresh_model_rates') {
            console.log(`[Background] Refreshing live OpenRouter model rates catalog`)
            await fetchLiveModelRates(true).catch((err) => {
                // Intentionally swallowed: fallback to embedded official catalog if offline
                console.warn(
                    '[Background] Failed to refresh live model rates:',
                    err?.message || err
                )
            })
        }
    },
    { connection: redisConnection as any }
)

// setup email worker
const emailWorker = createEmailWorker(redisConnection as any)

console.log('[Background] Background workers initialized.')
