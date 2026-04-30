import { z } from 'zod'

export const updateNameSchema = z.object({
    name: z.string().min(3).max(20),
})

export const updateUsernameSchema = z.object({
    username: z
        .string()
        .min(6)
        .max(20)
        .regex(/^[a-z_]+$/, 'username can only contain lowercase letters and underscores'),
})

export const changePasswordSchema = z.object({
    password: z.string().min(6).max(20),
})

export const updateNotificationSchema = z.object({
    notifyProjectActivity: z.boolean().optional(),
    notifyProductUpdates: z.boolean().optional(),
    notifySecurityAlerts: z.boolean().optional(),
})
