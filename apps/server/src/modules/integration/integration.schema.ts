import { z } from 'zod'

export const connectVercelQuerySchema = z.object({
    code: z.string({ message: 'code is required' }).min(1, 'code cannot be empty'),
    state: z.string({ message: 'state is required' }).min(1, 'state cannot be empty'),
    teamId: z.string().optional(),
    configurationId: z.string().optional(),
})

export const connectOAuthQuerySchema = z.object({
    code: z.string({ message: 'code is required' }).min(1, 'code cannot be empty'),
    state: z.string({ message: 'state is required' }).min(1, 'state cannot be empty'),
})
