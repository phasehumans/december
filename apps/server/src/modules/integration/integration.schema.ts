import { z } from 'zod'

export const connectOAuthQuerySchema = z.object({
    code: z.string({ message: 'code is required' }).min(1, 'code cannot be empty'),
    state: z.string({ message: 'state is required' }).min(1, 'state cannot be empty'),
})
