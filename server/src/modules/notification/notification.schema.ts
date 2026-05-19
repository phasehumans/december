import { z } from 'zod'

export const NotificationSchema = z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    title: z.string(),
    message: z.string(),
    isRead: z.boolean(),
    type: z.enum(['INFO', 'WARNING', 'SUCCESS', 'ERROR']),
    link: z.string().nullable(),
    createdAt: z.date(),
})

export const NotificationParamsSchema = z.object({
    id: z.string().uuid(),
})

export const SendNotificationSchema = z.object({
    userId: z.string().uuid(),
    title: z.string().min(1),
    message: z.string().min(1),
    type: z.enum(['INFO', 'WARNING', 'SUCCESS', 'ERROR']).optional(),
    link: z.string().optional(),
})

export const SendNotificationToAllSchema = z.object({
    title: z.string().min(1),
    message: z.string().min(1),
    type: z.enum(['INFO', 'WARNING', 'SUCCESS', 'ERROR']).optional(),
    link: z.string().optional(),
})

export type Notification = z.infer<typeof NotificationSchema>
