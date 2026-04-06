import { describe, test, expect } from 'bun:test'

import {
    updateNameSchema,
    changePasswordSchema,
    updateNotificationSchema,
} from '../../src/modules/profile/profile.schema'

describe('profile.schema', () => {
    describe('updateNameSchema', () => {
        test('should accept a valid name', () => {
            const input = {
                name: 'Chaitanya',
            }

            const result = updateNameSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject name shorter tha 3 chars', () => {
            const input = {
                name: 'Ch',
            }

            const result = updateNameSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject name longer than 20 chars', () => {
            const input = {
                name: 'alongernameeeeeeeeeee',
            }

            const result = updateNameSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should accept name with exactly 3 chars', () => {
            const input = {
                name: 'cha',
            }

            const result = updateNameSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject name has number', () => {
            const input = {
                name: 39,
            }

            const result = updateNameSchema.safeParse(input)

            expect(result.success).toBe(false)
        })
    })

    describe('changePasswordSchema', () => {
        test('should accept valid password', () => {
            const input = {
                password: '123456',
            }

            const result = changePasswordSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject password shorter than 6 chars', () => {
            const input = {
                password: '12345',
            }

            const result = changePasswordSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject password longer than 20 chars', () => {
            const input = {
                password: '123456789012345678901',
            }

            const result = changePasswordSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should accept a password with exactly 6 chars', () => {
            const input = {
                password: '123456',
            }

            const result = changePasswordSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should accept a password with exactly 20 chars', () => {
            const input = {
                password: '12345678901234567890',
            }

            const result = changePasswordSchema.safeParse(input)

            expect(result.success).toBe(true)
        })
    })

    describe('updateNotificationSchema', () => {
        test('should accept receiveNotification as true', () => {
            const input = {
                receiveNotification: true,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should accept receiveNotification as false', () => {
            const input = {
                receiveNotification: false,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject receiveNotification as when its string', () => {
            const input = {
                receiveNotification: 'true',
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject receiveNotification as in binary(0,1)', () => {
            const input = {
                receiveNotification: 0,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(false)
        })
    })
})
