import { z } from 'zod'

export const updateNameSchema = z.object({
    name: z
        .string({ message: 'name is required' })
        .min(3, 'name must be at least 3 characters')
        .max(20, 'name must be at most 20 characters'),
})

export const updateUsernameSchema = z.object({
    username: z
        .string({ message: 'username is required' })
        .min(6, 'username must be at least 6 characters')
        .max(20, 'username must be at most 20 characters')
        .regex(/^[a-z_]+$/, 'username can only contain lowercase letters and underscores'),
})

export const updateAvatarUrlSchema = z.object({
    avatarUrl: z
        .string({ message: 'avatar URL is required' })
        .url('avatar must be a valid URL')
        .max(500, 'avatar URL must be at most 500 characters'),
})

export const changePasswordSchema = z.object({
    currentPassword: z
        .string()
        .max(20, 'current password must be at most 20 characters')
        .optional()
        .or(z.literal('')),
    newPassword: z
        .string({ message: 'new password is required' })
        .min(6, 'new password must be at least 6 characters')
        .max(20, 'new password must be at most 20 characters'),
})

export const updateNotificationSchema = z.object({
    notifyProjectActivity: z
        .boolean({ message: 'notifyProjectActivity must be a boolean' })
        .optional(),
    notifyProductUpdates: z
        .boolean({ message: 'notifyProductUpdates must be a boolean' })
        .optional(),
    notifySecurityAlerts: z
        .boolean({ message: 'notifySecurityAlerts must be a boolean' })
        .optional(),
})

export const chatSuggestionsSchema = z.object({
    chatSuggestions: z.boolean({ message: 'chatSuggestions must be a boolean' }),
})

export enum GenerationSound {
    FIRST_GENERATION = 'FIRST_GENERATION',
    ALWAYS = 'ALWAYS',
    NEVER = 'NEVER',
}

export const generationSoundSchema = z.object({
    generationSound: z.nativeEnum(GenerationSound, { message: 'invalid generation sound option' }),
})

export const designSchema = z.object({
    design: z
        .string({ message: 'design content is required' })
        .max(10000, 'design must be at most 10000 characters'),
})

export const submitFeedbackSchema = z.object({
    rating: z.union([z.number(), z.string()]).nullable().optional(),
    feedback: z
        .string({ message: 'feedback content is required' })
        .min(1, 'feedback cannot be empty')
        .max(2000, 'feedback must be at most 2000 characters'),
})
