import { apiRequest } from '@/shared/api/client'

type SignupInput = {
    email: string
    password: string
}

type LoginInput = {
    email: string
    password: string
}

type VerifyOtpInput = {
    email: string
    otp: string
}

type GoogleInput = {
    code: string
}

const signup = (data: SignupInput) => {
    return apiRequest<{ message: string }>('/auth/signup', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const verifyOtp = (data: VerifyOtpInput) => {
    return apiRequest<string>('/auth/verify', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const login = (data: LoginInput) => {
    return apiRequest<string>('/auth/login', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

const google = (data: GoogleInput) => {
    return apiRequest<string>('/auth/google', {
        method: 'POST',
        includeAuth: false,
        body: JSON.stringify(data),
    })
}

export const authAPI = {
    signup,
    verifyOtp,
    login,
    google,
}
