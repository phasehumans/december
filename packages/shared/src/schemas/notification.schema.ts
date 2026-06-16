import { z } from 'zod'

export const NotificationSchema = z.object({
    id: z.string().uuid('notification ID must be a valid UUID'),
    userId: z.string().uuid('user ID must be a valid UUID'),
    title: z.string().min(1, 'title is required'),
    message: z.string().min(1, 'message is required'),
    isRead: z.boolean({ message: 'isRead must be a boolean' }),
    type: z.enum(['INFO', 'WARNING', 'SUCCESS', 'ERROR'], {
        message: "type must be one of 'INFO', 'WARNING', 'SUCCESS', 'ERROR'",
    }),
    link: z.string().nullable(),
    createdAt: z.date(),
})

export const NotificationParamsSchema = z.object({
    id: z.string().uuid('notification ID must be a valid UUID'),
})

export type Notification = z.infer<typeof NotificationSchema>
