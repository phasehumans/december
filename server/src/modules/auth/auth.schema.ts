import { z } from 'zod'

export const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6).max(20),
})

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6).max(20),
})

export const forgotPasswordRequestSchema = z.object({
    email: z.string().email(),
})

export const forgotPasswordVerifySchema = z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/, 'otp must be 6 digits'),
})

export const forgotPasswordResetSchema = z.object({
    email: z.string().email(),
    otp: z.string().regex(/^\d{6}$/, 'otp must be 6 digits'),
    newPassword: z.string().min(6).max(20),
})
