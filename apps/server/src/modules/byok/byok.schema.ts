import { isByokProvider } from '@december/providers'
import { z } from 'zod'

import { MAX_KEY_LENGTH } from './byok.utils'

// the provider in the path must be one of the byok ids exactly ("groq", not "Groq" or " groq")
export const providerParamSchema = z.object({
    provider: z
        .string({ message: 'provider is required' })
        .refine((value) => isByokProvider(value), { message: 'unsupported provider' }),
})

// an API key is printable ascii with no spaces. a newline or another control character would
// end up in a request header, and some header errors repeat the header value (the key)
export const saveCredentialSchema = z
    .object({
        apiKey: z
            .string({ message: 'api key is required' })
            .trim()
            .min(1, 'api key is required')
            .max(MAX_KEY_LENGTH, 'api key is too long')
            .regex(/^[\x21-\x7E]+$/, 'api key has characters that are not allowed'),
    })
    .strict()

// "check again" sends no body
export const refreshCredentialSchema = z.object({}).strict()
