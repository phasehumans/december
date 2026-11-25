import { referralCode } from '@/features/auth/referral'
import { apiRequest } from '@/shared/api/client'

type EmailAuthStartInput = {
    email: string
}

type EmailAuthVerifyInput = {
    email: string
    otp: string
}

type GoogleInput = {
    code?: string
    credential?: string
}

type GithubInput = {
    code: string
}

type AuthResult = {
    isNewUser?: boolean
}

/**
 * The three calls that can make an account send the code of an invite link (/r/<code>),
 * when this browser has one. The server uses it for a new account only. After a sign-in
 * that worked the code is removed: an account that exists can never use it.
 */
const postWithReferral = async <T>(path: string, data: object) => {
    const code = referralCode.read()
    const result = await apiRequest<T>(path, {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(code ? { ...data, referralCode: code } : data),
    })
    if (code) referralCode.clear()
    return result
}

// Email sign-up and log-in are one flow: send a code, then verify it.
const startEmailAuth = (data: EmailAuthStartInput) => {
    return apiRequest<{ message: string }>('/auth/email/start', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const verifyEmailAuth = (data: EmailAuthVerifyInput) => {
    return postWithReferral<AuthResult>('/auth/email/verify', data)
}

const google = (data: GoogleInput) => {
    return postWithReferral<void>('/auth/google', data)
}

const github = (data: GithubInput) => {
    return postWithReferral<AuthResult>('/auth/github', data)
}

export const authAPI = {
    startEmailAuth,
    verifyEmailAuth,
    google,
    github,
}
