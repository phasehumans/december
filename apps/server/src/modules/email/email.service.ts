import { env } from '../../env'

import { enqueueMessageJob, enqueueOtpJob } from './email.queue'
import { renderMessageEmail } from './message.template'

import type { SendMessageEmailParams, SendOtpEmailParams } from './email.types'

const sendOtpEmail = async (data: SendOtpEmailParams) => {
    const { to, otp, type = 'signup' } = data
    if (env.NODE_ENV === 'development') {
        console.log(
            `\n======================================================\n[DEV OTP Code] Verification code for ${to} is: ${otp}\n======================================================\n`
        )
    }
    try {
        return await enqueueOtpJob({ to, otp, type })
    } catch (error: any) {
        // Intentionally swallowed: fallback logging if Redis is offline during test or local development
        console.warn(
            `[Email Service] Failed to enqueue OTP email to ${to}:`,
            error?.message || error
        )
        return null
    }
}

const sendMessageEmail = async (data: SendMessageEmailParams) => {
    const { to, subject, body, footerLinks } = data
    const rendered = renderMessageEmail({
        subject,
        body,
        footerLinks,
        supportEmail: env.SENDER_EMAIL || 'team@trydecember.com',
    })
    try {
        return await enqueueMessageJob({ to, ...rendered })
    } catch (error: any) {
        // Intentionally swallowed: fallback logging if Redis is offline during test or local development
        console.warn(`[Email Service] Failed to enqueue message email:`, error?.message || error)
        return null
    }
}

export const emailService = {
    sendOtpEmail,
    sendMessageEmail,
}
