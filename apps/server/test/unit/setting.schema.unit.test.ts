import { describe, it, expect } from 'bun:test'

import {
    updateNameSchema,
    updateNotificationSchema,
    updateOnboardingSchema,
    submitFeedbackSchema,
} from '../../src/modules/setting/setting.schema'

describe('Setting Schema - Unit Tests', () => {
    describe('updateNameSchema', () => {
        it('should pass with valid name between 3 and 20 chars', () => {
            expect(updateNameSchema.safeParse({ name: 'Alice' }).success).toBe(true)
            expect(updateNameSchema.safeParse({ name: 'Bob Smith' }).success).toBe(true)
        })

        it('should fail with name < 3 or > 20 chars or non-string', () => {
            expect(updateNameSchema.safeParse({ name: 'Al' }).success).toBe(false)
            expect(updateNameSchema.safeParse({ name: 'A'.repeat(21) }).success).toBe(false)
            expect(updateNameSchema.safeParse({ name: 123 }).success).toBe(false)
            expect(updateNameSchema.safeParse({}).success).toBe(false)
        })
    })

    describe('updateNotificationSchema', () => {
        it('should pass with any combination of optional boolean fields', () => {
            expect(
                updateNotificationSchema.safeParse({
                    notifyProjectActivity: true,
                    notifyProductUpdates: false,
                    notifySecurityAlerts: true,
                }).success
            ).toBe(true)

            expect(
                updateNotificationSchema.safeParse({
                    notifyProjectActivity: true,
                }).success
            ).toBe(true)

            expect(updateNotificationSchema.safeParse({}).success).toBe(true)
        })

        it('should fail if fields are not booleans', () => {
            expect(
                updateNotificationSchema.safeParse({
                    notifyProjectActivity: 'true',
                }).success
            ).toBe(false)
        })
    })

    describe('updateOnboardingSchema', () => {
        it('should accept a known step', () => {
            expect(updateOnboardingSchema.safeParse({ step: 'github' }).success).toBe(true)
            expect(updateOnboardingSchema.safeParse({ step: 'start' }).success).toBe(true)
            expect(updateOnboardingSchema.safeParse({ step: 'models' }).success).toBe(true)
        })

        it('should reject an unknown step or an empty body', () => {
            expect(updateOnboardingSchema.safeParse({ step: 'welcome' }).success).toBe(false)
            expect(updateOnboardingSchema.safeParse({}).success).toBe(false)
        })
    })

    describe('submitFeedbackSchema', () => {
        it('should pass with valid rating and non-empty feedback', () => {
            expect(
                submitFeedbackSchema.safeParse({
                    rating: 'happy',
                    feedback: 'Great app!',
                }).success
            ).toBe(true)

            expect(
                submitFeedbackSchema.safeParse({
                    rating: null,
                    feedback: 'Could be better',
                }).success
            ).toBe(true)
        })

        it('should fail with invalid rating or empty feedback', () => {
            expect(
                submitFeedbackSchema.safeParse({
                    rating: 'awesome',
                    feedback: 'Great app!',
                }).success
            ).toBe(false)

            expect(
                submitFeedbackSchema.safeParse({
                    rating: 'happy',
                    feedback: '',
                }).success
            ).toBe(false)
        })
    })
})
