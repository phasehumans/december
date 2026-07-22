import { z } from 'zod'

export const ScheduleTaskSchema = z.object({
    name: z.string().min(1),
    cron: z.string().min(1),
})
