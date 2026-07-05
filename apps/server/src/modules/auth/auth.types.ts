export type TokenPayload = {
    userId: string
    sessionId: string
    iat?: number
    exp?: number
}

export type VerifyOtp = {
    email: string
    otp: string
    userAgent?: string
    ipAddress?: string
}

export type Login = {
    email: string
    password: string
    userAgent?: string
    ipAddress?: string
}

export type Google = {
    name: string
    email: string
    sub: string
    userAgent?: string
    ipAddress?: string
}

export type Github = {
    name: string
    email: string
    sub: string
    userAgent?: string
    ipAddress?: string
}

export type Signup = {
    email: string
    password: string
}

export type RefreshSession = {
    refreshToken?: string
}

export type RequestPasswordReset = {
    email: string
}

export type VerifyPasswordResetOtp = {
    email: string
    otp: string
}

export type ResetPassword = VerifyPasswordResetOtp & {
    newPassword: string
}
