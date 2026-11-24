import { z } from 'zod'

export const connectOAuthQuerySchema = z.object({
    code: z.string({ message: 'code is required' }).min(1, 'code cannot be empty'),
    state: z.string({ message: 'state is required' }).min(1, 'state cannot be empty'),
})

export const gitlabStartQuerySchema = z.object({
    redirect: z.string().optional(),
})

export const gitlabCallbackQuerySchema = z.object({
    code: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    error: z.string().optional(),
})
