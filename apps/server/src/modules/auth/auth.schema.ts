import { z } from 'zod'

// the code of an invite link (#638), sent by a sign-up. a value that cannot be a code is
// dropped: a sign-up never fails for it
const referralCodeSchema = z.string().trim().min(1).max(64).optional().catch(undefined)

export const emailAuthStartSchema = z.object({
    email: z
        .string({ message: 'email is required' })
        .trim()
        .toLowerCase()
        .email('please enter a valid email address'),
})

export const emailAuthVerifySchema = z.object({
    email: z
        .string({ message: 'email is required' })
        .trim()
        .toLowerCase()
        .email('please enter a valid email address'),
    otp: z.string({ message: 'otp is required' }).regex(/^\d{6}$/, 'otp must be exactly 6 digits'),
    referralCode: referralCodeSchema,
})

export const googleAuthSchema = z
    .object({
        code: z.string().min(1).optional(),
        credential: z.string().min(1).optional(),
        referralCode: referralCodeSchema,
    })
    .refine((data) => data.code || data.credential, {
        message: 'either code or credential must be provided',
    })

export const githubAuthSchema = z.object({
    code: z
        .string({ message: 'authorization code is required' })
        .min(1, 'authorization code is required'),
    referralCode: referralCodeSchema,
})

export const pollDeviceTokenSchema = z.object({
    deviceCode: z.string({ message: 'device code is required' }).min(1, 'device code is required'),
})

export const verifyUserCodeSchema = z.object({
    userCode: z.string({ message: 'user code is required' }).min(1, 'user code is required'),
})

export const getDeviceStatusSchema = z.object({
    code: z.string().optional(),
})

export const signedInSessionParamSchema = z.object({
    id: z.string({ message: 'session id is required' }).uuid('session id is not valid'),
})
