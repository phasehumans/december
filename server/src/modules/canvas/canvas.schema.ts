import { z } from 'zod'

export const getWebClipsSchema = z.object({
    url: z.httpUrl(),
})
