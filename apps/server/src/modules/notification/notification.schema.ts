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
    category: z.enum(['GENERAL', 'MENTION']).default('GENERAL'),
    link: z.string().nullable(),
    createdAt: z.date(),
})

export const NotificationParamsSchema = z.object({
    id: z.string().uuid('notification ID must be a valid UUID'),
})

export const SessionReadParamsSchema = z.object({
    sessionId: z.string().trim().min(1, 'session ID is required').max(100),
})

export const GetNotificationsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isRead: z
        .preprocess((val) => {
            if (val === 'true' || val === true) return true
            if (val === 'false' || val === false) return false
            return undefined
        }, z.boolean().optional())
        .optional(),
    category: z.enum(['GENERAL', 'MENTION']).optional(),
})

export type Notification = z.infer<typeof NotificationSchema>

// what PushSubscription.toJSON() gives in the browser (#636)
export const pushSubscribeSchema = z.object({
    endpoint: z.string().url('endpoint must be a url').max(1000),
    keys: z.object({
        p256dh: z.string().min(1).max(200),
        auth: z.string().min(1).max(100),
    }),
})

export const pushUnsubscribeSchema = z.object({
    endpoint: z.string().url('endpoint must be a url').max(1000),
})

// the endpoint is in the body, not the url: it is a secret of the browser
export const pushStatusSchema = z.object({
    endpoint: z.string().url('endpoint must be a url').max(1000),
})
