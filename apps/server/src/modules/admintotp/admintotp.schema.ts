import { z } from 'zod'

export const totpCodeSchema = z
    .object({
        // spaces are allowed: some apps show "123 456"
        code: z
            .string()
            .transform((value) => value.replace(/\s+/g, ''))
            .pipe(z.string().regex(/^\d{6}$/, { message: 'enter the 6-digit code' })),
    })
    .strict()
