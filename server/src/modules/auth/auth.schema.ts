import { z } from 'zod'

export const signupSchema = z.object({
    name: z.string().min(3).max(20),
    email: z.string().email(),
    password: z.string().min(6).max(20)
})

const loginSchema = z.object({})

