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

        const invalidId = NotificationSchema.safeParse({
            id: 'not-a-uuid',
        })
        expect(invalidId.success).toBe(false)

        const missingRequired = NotificationSchema.safeParse({
            id: crypto.randomUUID(),
        })
        expect(missingRequired.success).toBe(false)

        const invalidType = NotificationSchema.safeParse({
            id: crypto.randomUUID(),
            userId: crypto.randomUUID(),
            title: 'Test Title',
            message: 'Test Message',
            isRead: false,
            type: 'INVALID_TYPE',
            link: null,
            createdAt: new Date(),
        })
        expect(invalidType.success).toBe(false)
    })

    test('NotificationParamsSchema validation', () => {
        const valid = NotificationParamsSchema.safeParse({
            id: crypto.randomUUID(),
        })
        expect(valid.success).toBe(true)
    })
})
