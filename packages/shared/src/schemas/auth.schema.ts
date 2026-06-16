import { z } from 'zod'

export const signupSchema = z.object({
    email: z.string({ message: 'email is required' }).email('please enter a valid email address'),
    password: z
        .string({ message: 'password is required' })
        .min(6, 'password must be at least 6 characters')
        .max(20, 'password must be at most 20 characters'),
})

export const loginSchema = z.object({
    email: z.string({ message: 'email is required' }).email('please enter a valid email address'),
    password: z
        .string({ message: 'password is required' })
        .min(6, 'password must be at least 6 characters')
        .max(20, 'password must be at most 20 characters'),
})

export const forgotPasswordRequestSchema = z.object({
    email: z.string({ message: 'email is required' }).email('please enter a valid email address'),
})

export const forgotPasswordVerifySchema = z.object({
    email: z.string({ message: 'email is required' }).email('please enter a valid email address'),
    otp: z.string({ message: 'OTP is required' }).regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
})

export const forgotPasswordResetSchema = z.object({
    email: z.string({ message: 'email is required' }).email('please enter a valid email address'),
    otp: z.string({ message: 'OTP is required' }).regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
    newPassword: z
        .string({ message: 'new password is required' })
        .min(6, 'new password must be at least 6 characters')
        .max(20, 'new password must be at most 20 characters'),
})
