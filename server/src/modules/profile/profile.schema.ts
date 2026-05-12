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

export const chatSuggestionsSchema = z.object({
    chatSuggestions: z.boolean(),
})

export enum GenerationSound {
    FIRST_GENERATION = 'FIRST_GENERATION',
    ALWAYS = 'ALWAYS',
    NEVER = 'NEVER',
}

export const generationSoundSchema = z.object({
    generationSound: z.nativeEnum(GenerationSound),
})

export const memoriesSchema = z.object({
    memories: z.string().max(10000),
})

export const skillsSchema = z.object({
    skills: z.string().max(10000),
})
