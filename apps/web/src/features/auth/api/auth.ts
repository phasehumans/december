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

// Email sign-up and log-in are one flow: send a code, then verify it.
const startEmailAuth = (data: EmailAuthStartInput) => {
    return apiRequest<{ message: string }>('/auth/email/start', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const verifyEmailAuth = (data: EmailAuthVerifyInput) => {
    return apiRequest<AuthResult>('/auth/email/verify', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const google = (data: GoogleInput) => {
    return apiRequest<void>('/auth/google', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const github = (data: GithubInput) => {
    return apiRequest<AuthResult>('/auth/github', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

export const authAPI = {
    startEmailAuth,
    verifyEmailAuth,
    google,
    github,
}
