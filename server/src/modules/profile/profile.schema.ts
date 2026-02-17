import { password } from 'bun'
import { z } from 'zod'

export const updateNameSchema = z.object({
    name: z.string().min(3).max(20),
})

export const changePasswordSchema = z.object({
    password: z.string().min(6).max(20),
})
