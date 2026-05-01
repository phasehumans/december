import { describe, test, expect } from 'bun:test'

import {
    updateNameSchema,
    changePasswordSchema,
    updateNotificationSchema,
} from '../../src/modules/profile/profile.schema'
import { extractFirstName } from '../../src/modules/profile/profile.utils'

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

        test('should reject when name is missing', () => {
            const input = {}

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

        test('should reject when password is missing', () => {
            const input = {}

            const result = changePasswordSchema.safeParse(input)

            expect(result.success).toBe(false)
        })
    })

    describe('updateNotificationSchema', () => {
        test('should accept all fields as true', () => {
            const input = {
                notifyProjectActivity: true,
                notifyProductUpdates: true,
                notifySecurityAlerts: true,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should accept all fields as false', () => {
            const input = {
                notifyProjectActivity: false,
                notifyProductUpdates: false,
                notifySecurityAlerts: false,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should accept partial fields (since all are optional)', () => {
            const input = {
                notifyProjectActivity: true,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should accept empty object (all fields optional)', () => {
            const input = {}

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(true)
        })

        test('should reject when any field is not boolean (string)', () => {
            const input = {
                notifyProjectActivity: 'true',
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject when any field is not boolean (number)', () => {
            const input = {
                notifyProductUpdates: 1,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(false)
        })

        test('should reject multiple invalid fields', () => {
            const input = {
                notifyProjectActivity: 'true',
                notifySecurityAlerts: 0,
            }

            const result = updateNotificationSchema.safeParse(input)

            expect(result.success).toBe(false)
        })
    })
})

describe('profile.utils', () => {
    describe('extractFirstName', () => {
        test('should return the firstname', () => {
            const input = 'Chaitanya Sonawane'

            const result = extractFirstName(input)

            expect(result).toBe('Chaitanya')
        })
    })
})
