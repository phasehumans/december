import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'

import resend from '../../config/email'
import { env } from '../../env'
import { claimOnce } from '../../shared/claim-once'
import { getAdminPath } from '../admin/admin.utils'
import { renderOtpEmail } from '../auth/templates/otp.template'
import { notificationService } from '../notification/notification.service'

import { EMAIL_QUEUE_NAME } from './email.queue'

import type { EmailJobData, ProcessEmailJobResult } from './email.types'

export const processEmailJob = async (job: Job<EmailJobData>): Promise<ProcessEmailJobResult> => {
    const data = job.data
    const fromEmail = env.SENDER_EMAIL || 'onboarding@resend.dev'
    const appUrl = (env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')

    if (data.type === 'otp') {
        const { to, otp, otpType = 'signup' } = data
        const { subject, html, text } = renderOtpEmail({
            otp,
            type: otpType,
            supportEmail: fromEmail,
            webUrl: appUrl,
        })

        try {
            let result = await resend.emails.send({
                from: `December <${fromEmail}>`,
                to,
                subject,
                html,
                text,
            })

            // If the custom domain is not verified on Resend (403), fallback to onboarding@resend.dev in dev
            if (
                result?.error &&
                fromEmail !== 'onboarding@resend.dev' &&
                (env.NODE_ENV === 'development' || !env.RESEND_API_KEY)
            ) {
                console.warn(
                    `[Email Worker] Failed with sender ${fromEmail} (${result.error.message}), retrying with onboarding@resend.dev`
                )
                result = await resend.emails.send({
                    from: `December <onboarding@resend.dev>`,
                    to,
                    subject,
                    html,
                    text,
                })
            }

            if (result?.error) {
                throw new Error(result.error.message || `Resend error: ${result.error.name}`)
            }

            return { success: true, messageId: result?.data?.id || 'email-delivered' }
        } catch (error: any) {
            console.error(
                `[Email Worker] Failed to send OTP email to ${to}:`,
                error?.message || error
            )
            if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test' || !env.RESEND_API_KEY) {
                console.log(
                    `\n======================================================\n[DEV OTP Code] Verification code for ${to} is: ${otp}\n======================================================\n`
                )
                return { success: true, messageId: 'dev-fallback' }
            }
            throw error
        }
    }

    // the welcome mail was removed (inbox review): a job queued before the deploy is dropped
    if ((data as { type?: string }).type === 'welcome') {
        return { success: true, messageId: 'welcome-removed' }
    }

    if (data.type === 'message') {
        const { to, subject, html, text } = data
        try {
            const result = await resend.emails.send({
                from: `December <${fromEmail}>`,
                to,
                subject,
                html,
                text,
            })
            if (result?.error) {
                throw new Error(result.error.message || `Resend error: ${result.error.name}`)
            }
            return { success: true, messageId: result?.data?.id || 'email-delivered' }
        } catch (error: any) {
            console.error(`[Email Worker] Failed to send message email:`, error?.message || error)
            if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test' || !env.RESEND_API_KEY) {
                return { success: true, messageId: 'dev-fallback' }
            }
            throw error
        }
    }

    throw new Error(`Unknown email job type: ${(data as any)?.type}`)
}

/**
 * A mail that failed every try goes to the admins' December inbox, at most once an hour, so
 * a Resend outage or a used-up daily quota is one item and not one per mail. The address is
 * left out: the admin finds the user from the time if needed.
 */
export const alertAdminsOfFailedMail = async (data: { type?: string; error: string }) => {
    const { type, error } = data
    if (!(await claimOnce('email:failed-alert', 60 * 60))) return false
    const kind = type === 'otp' ? 'A sign-in code' : 'A mail'
    await notificationService.sendNotificationToAdmins({
        title: 'Mail not sent',
        message: `${kind} failed after every try: ${error.slice(0, 200)}. More failures in the next hour are not listed.`,
        type: 'ERROR',
        link: `${getAdminPath()}#system`,
    })
    return true
}

export const createEmailWorker = (connection?: Redis): Worker<EmailJobData> => {
    const redisConnection =
        connection ||
        new Redis(env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null,
            lazyConnect: true,
            enableOfflineQueue: false,
        })

    redisConnection.on('error', (_err) => {
        // Intentionally swallowed: handles redis connection errors gracefully in test/offline environment
    })

    const worker = new Worker<EmailJobData>(
        EMAIL_QUEUE_NAME,
        async (job) => {
            return processEmailJob(job)
        },
        {
            connection: redisConnection as any,
            concurrency: 5,
        }
    )

    worker.on('error', (_err) => {
        // Intentionally swallowed: handles redis worker connection errors gracefully in test/offline environment
    })

    worker.on('failed', (job, err) => {
        console.error(
            `[Email Worker] Job ${job?.id} (type: ${job?.data?.type}) failed:`,
            err.message
        )
        // A3: the last try failed (a sign-in code, a credits mail): tell the admins
        if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
            alertAdminsOfFailedMail({ type: job.data?.type, error: err.message }).catch(
                (alertError) => {
                    console.error('[Email Worker] admin alert failed:', alertError)
                }
            )
        }
    })

    return worker
}
