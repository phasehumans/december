import { describe, test, expect } from 'bun:test'

import {
    NotificationParamsSchema,
    NotificationSchema,
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

        test('should reject missing id parameter', () => {
            const result = NotificationParamsSchema.safeParse({})
            expect(result.success).toBe(false)
        })

        test('should reject non-string id parameter', () => {
            const result = NotificationParamsSchema.safeParse({ id: 12345 })
            expect(result.success).toBe(false)
        })
    })

    describe('NotificationSchema', () => {
        const validNotification = {
            id: '864e432c-687f-4424-aa61-a831518f8e12',
            userId: '864e432c-687f-4424-aa61-a831518f8e13',
            title: 'Test Title',
            message: 'Test Message',
            isRead: false,
            type: 'INFO',
            link: 'https://example.com/test',
            createdAt: new Date(),
        }

        test('should accept a fully valid notification object', () => {
            const result = NotificationSchema.safeParse(validNotification)
            expect(result.success).toBe(true)
        })

        test('should accept a notification with a null link', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                link: null,
            })
            expect(result.success).toBe(true)
        })

        test('should reject notification with invalid notification ID UUID', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                id: 'not-a-uuid',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.id).toContain(
                    'notification ID must be a valid UUID'
                )
            }
        })

        test('should reject notification with invalid user ID UUID', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                userId: 'not-a-uuid',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.userId).toContain(
                    'user ID must be a valid UUID'
                )
            }
        })

        test('should reject empty title', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                title: '',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.title).toContain('title is required')
            }
        })

        test('should reject empty message', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                message: '',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.message).toContain('message is required')
            }
        })

        test('should reject non-boolean isRead', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                isRead: 'false',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.isRead).toContain(
                    'isRead must be a boolean'
                )
            }
        })

        test('should reject invalid type enum value', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                type: 'INVALID_TYPE',
            })
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.type).toContain(
                    "type must be one of 'INFO', 'WARNING', 'SUCCESS', 'ERROR'"
                )
            }
        })

        test('should reject non-date createdAt', () => {
            const result = NotificationSchema.safeParse({
                ...validNotification,
                createdAt: '2026-06-13T12:00:00Z',
            })
            expect(result.success).toBe(false)
        })
    })
})
