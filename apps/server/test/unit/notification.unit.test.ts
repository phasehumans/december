import { describe, expect, test } from 'bun:test'
import {
    NotificationSchema,
    NotificationParamsSchema,
} from '../../src/modules/notification/notification.schema'

describe('notification schemas', () => {
    test('NotificationSchema validation', () => {
        const valid = NotificationSchema.safeParse({
            id: crypto.randomUUID(),
            userId: crypto.randomUUID(),
            title: 'Test Title',
            message: 'Test Message',
            isRead: false,
            type: 'INFO',
            link: null,
            createdAt: new Date(),
        })
        expect(valid.success).toBe(true)

        const invalid = NotificationSchema.safeParse({
            id: 'not-a-uuid',
        })
        expect(invalid.success).toBe(false)
    })

    test('NotificationParamsSchema validation', () => {
        const valid = NotificationParamsSchema.safeParse({
            id: crypto.randomUUID(),
        })
        expect(valid.success).toBe(true)
    })
})
