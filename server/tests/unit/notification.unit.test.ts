import { describe, test, expect } from 'bun:test'

import {
    NotificationParamsSchema,
    SendNotificationSchema,
    SendNotificationToAllSchema,
} from '../../src/modules/notification/notification.schema'

describe('notification.schema', () => {
    describe('NotificationParamsSchema', () => {
        test('should accept valid uuid for id', () => {
            const result = NotificationParamsSchema.safeParse({
                id: '864e432c-687f-4424-aa61-a831518f8e12',
            })
            expect(result.success).toBe(true)
        })

        test('should reject invalid uuid for id', () => {
            const result = NotificationParamsSchema.safeParse({ id: 'invalid-uuid' })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.id).toContain(
                    'notification ID must be a valid UUID'
                )
            }
        })
    })

    describe('SendNotificationSchema', () => {
        const validPayload = {
            userId: '864e432c-687f-4424-aa61-a831518f8e12',
            title: 'Welcome!',
            message: 'Thanks for signing up.',
            type: 'INFO',
            link: 'https://example.com',
        }

        test('should accept valid payload', () => {
            const result = SendNotificationSchema.safeParse(validPayload)
            expect(result.success).toBe(true)
        })

        test('should reject invalid userId', () => {
            const result = SendNotificationSchema.safeParse({
                ...validPayload,
                userId: 'invalid-uuid',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.userId).toContain(
                    'user ID must be a valid UUID'
                )
            }
        })

        test('should reject empty title', () => {
            const result = SendNotificationSchema.safeParse({
                ...validPayload,
                title: '',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.title).toContain('title is required')
            }
        })

        test('should reject empty message', () => {
            const result = SendNotificationSchema.safeParse({
                ...validPayload,
                message: '',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.message).toContain('message is required')
            }
        })

        test('should reject invalid type', () => {
            const result = SendNotificationSchema.safeParse({
                ...validPayload,
                type: 'INVALID_TYPE',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.type).toContain(
                    "type must be one of 'INFO', 'WARNING', 'SUCCESS', 'ERROR'"
                )
            }
        })
    })

    describe('SendNotificationToAllSchema', () => {
        const validPayload = {
            title: 'System Update',
            message: 'We are scheduled for maintenance.',
            type: 'WARNING',
            link: '/status',
        }

        test('should accept valid payload', () => {
            const result = SendNotificationToAllSchema.safeParse(validPayload)
            expect(result.success).toBe(true)
        })

        test('should reject empty title', () => {
            const result = SendNotificationToAllSchema.safeParse({
                ...validPayload,
                title: '',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.title).toContain('title is required')
            }
        })

        test('should reject empty message', () => {
            const result = SendNotificationToAllSchema.safeParse({
                ...validPayload,
                message: '',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.message).toContain('message is required')
            }
        })

        test('should reject invalid type', () => {
            const result = SendNotificationToAllSchema.safeParse({
                ...validPayload,
                type: 'CRITICAL',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.type).toContain(
                    "type must be one of 'INFO', 'WARNING', 'SUCCESS', 'ERROR'"
                )
            }
        })
    })
})
