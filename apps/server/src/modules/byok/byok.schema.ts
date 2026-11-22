import { isByokProvider } from '@december/providers'
import { z } from 'zod'

export const providerParamSchema = z.object({
    provider: z
        .string({ message: 'provider is required' })
        .trim()
        .refine((value) => isByokProvider(value), { message: 'unsupported provider' }),
})

export const saveCredentialSchema = z.object({
    apiKey: z
        .string({ message: 'api key is required' })
        .trim()
        .min(1, 'api key is required')
        .max(4096, 'api key is too long'),
})

export const billingSourceSchema = z.enum(['CREDITS', 'OWN_KEY'])
