import type { JobsOptions } from 'bullmq'

export type OtpType = 'signup' | 'login'

export type SendOtpEmailParams = {
    to: string
    otp: string
    type?: OtpType
}

export type SendWelcomeEmailParams = {
    to: string
    name: string
}

export type SendOtpJobData = {
    type: 'otp'
    to: string
    otp: string
    otpType?: OtpType
}

export type SendWelcomeJobData = {
    type: 'welcome'
    to: string
    name: string
}

export type SendMessageEmailParams = {
    to: string
    subject: string
    // plain text, rendered into the december email layout
    body: string
    footerLinks?: Array<{ label: string; url: string }>
}

export type SendMessageJobData = {
    type: 'message'
    to: string
    subject: string
    html: string
    text: string
}

export type EmailJobData = SendOtpJobData | SendWelcomeJobData | SendMessageJobData

export type ProcessEmailJobResult = {
    success: boolean
    messageId?: string
    error?: string
}

export type EmailQueueOptions = JobsOptions
