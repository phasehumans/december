import { describe, it, expect } from 'bun:test'

import {
    FEEDBACK_MAX_LENGTH,
    updateNameSchema,
    updateNotificationSchema,
    updateOnboardingSchema,
    submitFeedbackSchema,
    updateSessionDefaultsSchema,
    updateToolDenyRulesSchema,
    updatePullRequestSettingsSchema,
    unsubscribeQuerySchema,
    updatePreferencesSchema,
    preferencesSchema,
} from '../../src/modules/setting/setting.schema'

const ok = (schema: { safeParse: (value: unknown) => { success: boolean } }, value: unknown) =>
    schema.safeParse(value).success

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
        it('should pass with any combination of the optional fields', () => {
            expect(
                updateNotificationSchema.safeParse({
                    notifyProductUpdates: false,
                    notifySecurityAlerts: true,
                    notifyLevel: 'ALL',
                    notifyPush: false,
                    timezone: 'Asia/Kolkata',
                }).success
            ).toBe(true)

            expect(updateNotificationSchema.safeParse({ notifyLevel: 'NONE' }).success).toBe(true)
        })

        it('should fail on an empty body, a wrong type or an old field', () => {
            expect(updateNotificationSchema.safeParse({}).success).toBe(false)
            expect(updateNotificationSchema.safeParse({ notifyLevel: 'SOME' }).success).toBe(false)
            // email and the daily summary were removed (inbox review S1, S2)
            expect(updateNotificationSchema.safeParse({ notifyEmail: false }).success).toBe(false)
            expect(updateNotificationSchema.safeParse({ digestEnabled: true }).success).toBe(false)
            expect(updateNotificationSchema.safeParse({ digestTime: '09:00' }).success).toBe(false)
            expect(
                updateNotificationSchema.safeParse({ notifyProjectActivity: true }).success
            ).toBe(false)
        })

        it('should keep security alerts on and push on only from the browser', () => {
            expect(
                updateNotificationSchema.safeParse({ notifySecurityAlerts: false }).success
            ).toBe(false)
            expect(updateNotificationSchema.safeParse({ notifyPush: true }).success).toBe(false)
        })

        it('should check the time zone', () => {
            expect(updateNotificationSchema.safeParse({ timezone: 'Mars/Base' }).success).toBe(
                false
            )
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

    describe('strict bodies: an unknown key is refused', () => {
        it('name, onboarding, feedback and tool deny rules', () => {
            expect(ok(updateNameSchema, { name: 'Alice', userId: 'u2' })).toBe(false)
            expect(ok(updateOnboardingSchema, { step: 'start', completedAt: null })).toBe(false)
            expect(ok(submitFeedbackSchema, { rating: null, feedback: 'hi', userId: 'u2' })).toBe(
                false
            )
            expect(ok(updateToolDenyRulesSchema, { rules: [], extra: true })).toBe(false)
        })

        it('a body that is not an object is refused', () => {
            for (const schema of [
                updateNameSchema,
                updateOnboardingSchema,
                submitFeedbackSchema,
                updateToolDenyRulesSchema,
                updateSessionDefaultsSchema,
                updatePullRequestSettingsSchema,
                updatePreferencesSchema,
                updateNotificationSchema,
            ]) {
                for (const value of [null, 'text', 42, [], true]) {
                    expect(ok(schema, value)).toBe(false)
                }
            }
        })
    })

    describe('updateNameSchema: more edges', () => {
        it('trims first, then counts', () => {
            expect(updateNameSchema.parse({ name: '   Ada   ' })).toEqual({ name: 'Ada' })
            expect(ok(updateNameSchema, { name: '  Al  ' })).toBe(false)
            expect(ok(updateNameSchema, { name: 'A'.repeat(20) })).toBe(true)
        })

        it('refuses control characters: a new line, a tab, NUL', () => {
            for (const name of ['Ada\nLovelace', 'Ada\tL', 'Ada\u0000L', 'Ada\u007fL']) {
                expect(ok(updateNameSchema, { name })).toBe(false)
            }
        })

        it('takes letters of any language and emoji', () => {
            expect(ok(updateNameSchema, { name: 'José Ñúñez' })).toBe(true)
            expect(ok(updateNameSchema, { name: 'चैतन्य' })).toBe(true)
            expect(ok(updateNameSchema, { name: 'Ada 🚀' })).toBe(true)
        })
    })

    describe('submitFeedbackSchema: more edges', () => {
        it('needs the rating key, which may be null', () => {
            expect(ok(submitFeedbackSchema, { feedback: 'hi' })).toBe(false)
            expect(ok(submitFeedbackSchema, { rating: 'neutral', feedback: 'hi' })).toBe(true)
            expect(ok(submitFeedbackSchema, { rating: 'sad', feedback: 'hi' })).toBe(true)
        })

        it('takes the limit after the trim, and not one more', () => {
            const atLimit = submitFeedbackSchema.parse({
                rating: null,
                feedback: `  ${'a'.repeat(FEEDBACK_MAX_LENGTH)}  `,
            })
            expect(atLimit.feedback).toHaveLength(FEEDBACK_MAX_LENGTH)
            expect(
                ok(submitFeedbackSchema, {
                    rating: null,
                    feedback: 'a'.repeat(FEEDBACK_MAX_LENGTH + 1),
                })
            ).toBe(false)
            expect(ok(submitFeedbackSchema, { rating: null, feedback: '   ' })).toBe(false)
        })
    })

    describe('updateSessionDefaultsSchema', () => {
        it('takes one or both booleans', () => {
            expect(ok(updateSessionDefaultsSchema, { defaultPlanFirst: true })).toBe(true)
            expect(ok(updateSessionDefaultsSchema, { defaultOpenPullRequest: false })).toBe(true)
            expect(
                ok(updateSessionDefaultsSchema, {
                    defaultPlanFirst: false,
                    defaultOpenPullRequest: true,
                })
            ).toBe(true)
        })

        it('refuses an empty body, other types and the removed defaults', () => {
            expect(ok(updateSessionDefaultsSchema, {})).toBe(false)
            expect(ok(updateSessionDefaultsSchema, { defaultPlanFirst: 'true' })).toBe(false)
            expect(ok(updateSessionDefaultsSchema, { defaultOpenPullRequest: 1 })).toBe(false)
            for (const removed of [
                'defaultModelSource',
                'defaultEffort',
                'defaultRepository',
                'defaultBaseBranch',
                'defaultOwnKeyProvider',
                'defaultOwnKeyModel',
            ]) {
                expect(ok(updateSessionDefaultsSchema, { [removed]: 'x' })).toBe(false)
            }
        })
    })

    describe('updateToolDenyRulesSchema', () => {
        it('takes an empty list and trims each rule', () => {
            expect(updateToolDenyRulesSchema.parse({ rules: [] })).toEqual({ rules: [] })
            expect(updateToolDenyRulesSchema.parse({ rules: ['  git push*  '] })).toEqual({
                rules: ['git push*'],
            })
        })

        it('takes 100 rules of 300 characters, and not more', () => {
            const many = Array.from({ length: 100 }, (_, i) => `${i}`.padEnd(300, 'x'))
            expect(ok(updateToolDenyRulesSchema, { rules: many })).toBe(true)
            expect(ok(updateToolDenyRulesSchema, { rules: [...many, 'one more'] })).toBe(false)
            expect(ok(updateToolDenyRulesSchema, { rules: ['x'.repeat(301)] })).toBe(false)
        })

        it('refuses a missing list, a string, empty rules and other types', () => {
            for (const body of [
                {},
                { rules: 'git push*' },
                { rules: [''] },
                { rules: ['  '] },
                { rules: [42] },
                { rules: [null] },
                { rules: [['nested']] },
            ]) {
                expect(ok(updateToolDenyRulesSchema, body)).toBe(false)
            }
        })
    })

    describe('updatePullRequestSettingsSchema', () => {
        it('takes each setting alone', () => {
            for (const body of [
                { branchPrefix: 'december/' },
                { branchPrefix: '' },
                { prDraft: true },
                { prAuthor: 'user' },
                { commitAuthor: 'december' },
                { githubCommentsEnabled: false },
                { reviewReplies: 'mention' },
                { fixFailedChecks: true },
                { autoReview: 'all' },
            ]) {
                expect(ok(updatePullRequestSettingsSchema, body)).toBe(true)
            }
        })

        it('refuses an empty body, bad values, a long or bad prefix and unknown keys', () => {
            for (const body of [
                {},
                { branchPrefix: 'a'.repeat(41) },
                { branchPrefix: 'bad prefix' },
                { branchPrefix: 'a..b/' },
                { branchPrefix: '/lead' },
                { prDraft: 'yes' },
                { prAuthor: 'bot' },
                { commitAuthor: 'user' },
                { reviewReplies: 'some' },
                { autoReview: 'none' },
                { openPullRequest: true },
                { userId: 'u2', prDraft: true },
            ]) {
                expect(ok(updatePullRequestSettingsSchema, body)).toBe(false)
            }
        })
    })

    describe('unsubscribeQuerySchema', () => {
        it('needs both values as short strings', () => {
            expect(ok(unsubscribeQuerySchema, { u: 'user-1', t: 'f'.repeat(64) })).toBe(true)
            for (const query of [
                {},
                { u: 'user-1' },
                { t: 'f'.repeat(64) },
                { u: '', t: 'x' },
                { u: 'user-1', t: '   ' },
                { u: 'u'.repeat(101), t: 'x' },
                { u: 'user-1', t: 'x'.repeat(201) },
                { u: ['a', 'b'], t: 'x' },
                { u: 'user-1', t: { $ne: '' } },
            ]) {
                expect(ok(unsubscribeQuerySchema, query)).toBe(false)
            }
        })
    })

    describe('updatePreferencesSchema', () => {
        it('takes each preference alone', () => {
            for (const body of [
                { sendKey: 'enter' },
                { sendKey: 'mod-enter' },
                { soundOnFinish: true },
                { messageWhileWorking: 'queue' },
                { messageWhileWorking: 'send' },
            ]) {
                expect(ok(updatePreferencesSchema, body)).toBe(true)
            }
        })

        it('refuses an empty body, bad values and unknown keys', () => {
            for (const body of [
                {},
                { sendKey: 'space' },
                { soundOnFinish: 'on' },
                { messageWhileWorking: 'later' },
                { theme: 'dark' },
            ]) {
                expect(ok(updatePreferencesSchema, body)).toBe(false)
            }
        })

        it('the base schema (used to read saved values) takes an empty object', () => {
            expect(ok(preferencesSchema, {})).toBe(true)
        })
    })
})
