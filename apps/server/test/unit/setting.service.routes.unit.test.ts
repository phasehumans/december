import { PULL_REQUEST_SETTING_DEFAULTS } from '@december/shared'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { createUnsubscribeToken } from '../../src/modules/admin/admin.utils'
import { notificationService } from '../../src/modules/notification/notification.service'
import { settingRepository } from '../../src/modules/setting/setting.repository'
import { settingService } from '../../src/modules/setting/setting.service'
import { AppError } from '../../src/shared/appError'
import { appCache } from '../../src/shared/cache'

// the service functions of the setting routes that setting.service.unit.test.ts does not
// cover: unsubscribe, session defaults, preferences, tool deny rules, onboarding step, pull
// request settings, feedback and the profile fields. Only the repository is replaced.

type Repo = typeof settingRepository
const originals = { ...settingRepository }
const originalNotifyAdmins = notificationService.sendNotificationToAdmins
const originalAdminEmails = process.env.ADMIN_EMAILS

const mock = <K extends keyof Repo>(name: K, fn: (...args: any[]) => unknown) => {
    ;(settingRepository as any)[name] = fn
}

const status = async (promise: Promise<unknown>) => {
    try {
        await promise
        return 'ok'
    } catch (error) {
        return error instanceof AppError ? error.statusCode : 'other'
    }
}

beforeEach(async () => {
    await appCache.clearAll()
})

afterEach(() => {
    Object.assign(settingRepository, originals)
    notificationService.sendNotificationToAdmins = originalNotifyAdmins
    if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS
    else process.env.ADMIN_EMAILS = originalAdminEmails
})

describe('setting service: unsubscribe', () => {
    it('checkUnsubscribe takes the token of that user only', async () => {
        const token = createUnsubscribeToken('user-a')
        expect(await settingService.checkUnsubscribe({ userId: 'user-a', token })).toEqual({
            valid: true,
        })
        for (const [userId, bad] of [
            ['user-b', token],
            ['user-a', createUnsubscribeToken('user-b')],
            ['user-a', token.slice(0, -1)],
            ['user-a', `${token}0`],
            ['user-a', token.toUpperCase()],
            ['user-a', ''],
        ] as const) {
            expect(await status(settingService.checkUnsubscribe({ userId, token: bad }))).toBe(400)
        }
    })

    it('unsubscribe turns product emails off for that user, and clears the cached profile', async () => {
        const calls: string[] = []
        mock('disableProductUpdates', async (id: string) => {
            calls.push(id)
            return { count: 1 }
        })
        await appCache.set(appCache.key('setting', 'profile', 'user-a'), { stale: true }, 300)

        const res = await settingService.unsubscribe({
            userId: 'user-a',
            token: createUnsubscribeToken('user-a'),
        })

        expect(res).toEqual({ unsubscribed: true })
        expect(calls).toEqual(['user-a'])
        expect(await appCache.get(appCache.key('setting', 'profile', 'user-a'))).toBeFalsy()
    })

    it('a bad token changes nothing', async () => {
        let called = false
        mock('disableProductUpdates', async () => {
            called = true
            return { count: 1 }
        })
        const forged = createUnsubscribeToken('user-b')
        expect(await status(settingService.unsubscribe({ userId: 'user-a', token: forged }))).toBe(
            400
        )
        expect(called).toBe(false)
    })

    it('a user that is gone gets the same 400 as a bad link', async () => {
        mock('disableProductUpdates', async () => ({ count: 0 }))
        const token = createUnsubscribeToken('gone')
        expect(await status(settingService.unsubscribe({ userId: 'gone', token }))).toBe(400)
    })
})

describe('setting service: session defaults', () => {
    it('404 for a user that is gone, and nothing is saved', async () => {
        let saved = false
        mock('findUserByIdForExistCheck', async () => null)
        mock('updateSessionDefaults', async () => {
            saved = true
        })
        expect(
            await status(
                settingService.updateSessionDefaults({ userId: 'u1', defaultPlanFirst: true })
            )
        ).toBe(404)
        expect(saved).toBe(false)
    })

    it('sends a left-out field as undefined, so it keeps its value', async () => {
        let sent: unknown
        mock('findUserByIdForExistCheck', async () => ({ id: 'u1', email: 'a@example.com' }))
        mock('updateSessionDefaults', async (_id: string, data: unknown) => {
            sent = data
            return { defaultPlanFirst: true, defaultOpenPullRequest: true }
        })
        const res = await settingService.updateSessionDefaults({
            userId: 'u1',
            defaultPlanFirst: true,
        })
        expect(sent).toEqual({ defaultPlanFirst: true, defaultOpenPullRequest: undefined })
        expect(res).toEqual({ defaultPlanFirst: true, defaultOpenPullRequest: true })
    })
})

describe('setting service: preferences', () => {
    it('404 for a user that is gone', async () => {
        mock('findPreferences', async () => null)
        expect(
            await status(
                settingService.updatePreferences({
                    userId: 'u1',
                    preferences: { sendKey: 'enter' },
                })
            )
        ).toBe(404)
    })

    it('merges the sent value into the valid saved ones and drops old values', async () => {
        let written: unknown
        mock('findPreferences', async () => ({
            preferences: { sendKey: 'mod-enter', soundOnFinish: 'loud', theme: 'dark' },
        }))
        mock('updatePreferences', async (_id: string, value: unknown) => {
            written = value
            return { preferences: value }
        })

        const res = await settingService.updatePreferences({
            userId: 'u1',
            preferences: { messageWhileWorking: 'send' },
        })

        expect(written).toEqual({ sendKey: 'mod-enter', messageWhileWorking: 'send' })
        expect(res).toEqual({ preferences: { sendKey: 'mod-enter', messageWhileWorking: 'send' } })
    })

    it('a sent value wins over the saved one', async () => {
        mock('findPreferences', async () => ({ preferences: { sendKey: 'mod-enter' } }))
        mock('updatePreferences', async (_id: string, value: unknown) => ({ preferences: value }))
        const res = await settingService.updatePreferences({
            userId: 'u1',
            preferences: { sendKey: 'enter' },
        })
        expect(res.preferences).toEqual({ sendKey: 'enter' })
    })
})

describe('setting service: tool deny rules', () => {
    it('getToolDenyRules: 404 for a user that is gone, else the saved list', async () => {
        mock('findToolDenyRules', async () => null)
        expect(await status(settingService.getToolDenyRules({ userId: 'u1' }))).toBe(404)

        mock('findToolDenyRules', async () => ({ toolDenyRules: ['rm -rf*'] }))
        expect(await settingService.getToolDenyRules({ userId: 'u1' })).toEqual({
            rules: ['rm -rf*'],
        })
    })

    it('updateToolDenyRules drops duplicates and keeps the order', async () => {
        let written: string[] = []
        mock('findUserByIdForExistCheck', async () => ({ id: 'u1', email: 'a@example.com' }))
        mock('updateToolDenyRules', async (_id: string, rules: string[]) => {
            written = rules
            return { toolDenyRules: rules }
        })
        const res = await settingService.updateToolDenyRules({
            userId: 'u1',
            rules: ['b', 'a', 'b', 'c', 'a'],
        })
        expect(written).toEqual(['b', 'a', 'c'])
        expect(res).toEqual({ rules: ['b', 'a', 'c'] })
    })

    it('updateToolDenyRules: 404 for a user that is gone', async () => {
        mock('findUserByIdForExistCheck', async () => null)
        expect(await status(settingService.updateToolDenyRules({ userId: 'u1', rules: [] }))).toBe(
            404
        )
    })
})

describe('setting service: onboarding step', () => {
    const source = {
        onboardingCompletedAt: null,
        onboardingStep: 'models',
        creditBalance: 0,
        githubAppInstall: false,
        githubConnected: false,
        githubUsername: null,
        githubInstallations: [],
        providerCredentials: [],
        gitConnections: [],
    }

    it('saves the step and answers with the state', async () => {
        const saved: string[] = []
        mock('findUserByIdForExistCheck', async () => ({ id: 'u1', email: 'a@example.com' }))
        mock('updateOnboardingStep', async (_id: string, step: string) => {
            saved.push(step)
            return { id: 'u1' }
        })
        mock('findOnboardingSource', async () => source)

        const state = await settingService.updateOnboarding({ userId: 'u1', step: 'models' })
        expect(saved).toEqual(['models'])
        expect(state.step).toBe('models')
    })

    it('404 for a user that is gone, and nothing is saved', async () => {
        let saved = false
        mock('findUserByIdForExistCheck', async () => null)
        mock('updateOnboardingStep', async () => {
            saved = true
        })
        expect(await status(settingService.updateOnboarding({ userId: 'u1', step: 'start' }))).toBe(
            404
        )
        expect(saved).toBe(false)
    })

    it('shows only the key hint of a saved key, and the github oauth login', async () => {
        mock('findOnboardingSource', async () => ({
            ...source,
            githubConnected: true,
            githubUsername: 'octo',
            providerCredentials: [{ provider: 'anthropic', keyHint: 'sk-…abcd' }],
        }))
        const state = await settingService.getOnboarding({ userId: 'u1' })
        expect(state.ownKey).toEqual({ provider: 'anthropic', keyHint: 'sk-…abcd' })
        expect(state.github).toEqual({ accountLogin: 'octo' })
        expect(state.steps).toEqual({ models: true, github: true })
    })

    it('a gitlab connection counts as the git step', async () => {
        mock('findOnboardingSource', async () => ({
            ...source,
            gitConnections: [{ username: 'lab-user' }],
        }))
        const state = await settingService.getOnboarding({ userId: 'u1' })
        expect(state.steps.github).toBe(true)
        expect(state.gitlab).toEqual({ username: 'lab-user' })
        expect(state.github).toBeNull()
    })

    it('getOnboarding: 404 for a user that is gone', async () => {
        mock('findOnboardingSource', async () => null)
        expect(await status(settingService.getOnboarding({ userId: 'u1' }))).toBe(404)
    })
})

describe('setting service: pull request settings', () => {
    it('a user with no saved row gets every default', async () => {
        mock('findPullRequestSettings', async () => null)
        expect(await settingService.getPullRequestSettings({ userId: 'u1' })).toEqual(
            PULL_REQUEST_SETTING_DEFAULTS
        )
    })

    it('a saved value that is not a choice reads as the default', async () => {
        mock('findPullRequestSettings', async () => ({
            ...PULL_REQUEST_SETTING_DEFAULTS,
            autoReview: 'everything',
            prDraft: true,
        }))
        const res = await settingService.getPullRequestSettings({ userId: 'u1' })
        expect(res.autoReview).toBe(PULL_REQUEST_SETTING_DEFAULTS.autoReview)
        expect(res.prDraft).toBe(true)
    })

    it('an empty change writes nothing; a change writes only the sent fields', async () => {
        const writes: unknown[] = []
        mock('upsertPullRequestSettings', async (_id: string, settings: unknown) => {
            writes.push(settings)
        })
        mock('findPullRequestSettings', async () => null)

        await settingService.updatePullRequestSettings({ userId: 'u1', settings: {} })
        expect(writes).toEqual([])

        await settingService.updatePullRequestSettings({
            userId: 'u1',
            settings: { prDraft: true },
        })
        expect(writes).toEqual([{ prDraft: true }])
    })
})

describe('setting service: feedback', () => {
    it('404 for a user that is gone, and nothing is saved', async () => {
        let saved = false
        mock('findUserByIdForExistCheck', async () => null)
        mock('createFeedback', async () => {
            saved = true
        })
        expect(
            await status(
                settingService.submitFeedback({ userId: 'u1', rating: null, feedback: 'hi' })
            )
        ).toBe(404)
        expect(saved).toBe(false)
    })

    it('tells the admins in one line of at most 200 characters', async () => {
        const notes: Array<{ title: string; message: string }> = []
        mock('findUserByIdForExistCheck', async () => ({ id: 'u1', email: 'a@example.com' }))
        mock('createFeedback', async () => ({ id: 'f1' }))
        notificationService.sendNotificationToAdmins = (async (note: any) => {
            notes.push(note)
        }) as any

        await settingService.submitFeedback({
            userId: 'u1',
            rating: 'sad',
            feedback: `first line\n\nsecond   line ${'x'.repeat(400)}`,
        })

        expect(notes).toHaveLength(1)
        expect(notes[0].title).toBe('Feedback (sad)')
        const text = notes[0].message.slice('a@example.com: '.length)
        expect(notes[0].message.startsWith('a@example.com: first line second line x')).toBe(true)
        expect(text).toHaveLength(200)
        expect(text.endsWith('…')).toBe(true)
    })

    it('the feedback is kept when the admin note fails', async () => {
        mock('findUserByIdForExistCheck', async () => ({ id: 'u1', email: 'a@example.com' }))
        mock('createFeedback', async () => ({ id: 'f1' }))
        notificationService.sendNotificationToAdmins = (async () => {
            throw new Error('inbox down')
        }) as any
        const originalError = console.error
        console.error = () => {
            // Intentionally silenced: the service logs the failed admin note on purpose
        }
        try {
            expect(
                await settingService.submitFeedback({ userId: 'u1', rating: null, feedback: 'hi' })
            ).toEqual({ id: 'f1' })
        } finally {
            console.error = originalError
        }
    })
})

describe('setting service: profile fields', () => {
    it('asks the database for no secret or unused field', async () => {
        let select: Record<string, unknown> = {}
        mock('findUserByIdForProfile', async (_id: string, fields: Record<string, unknown>) => {
            select = fields
            return { id: 'u1', email: 'a@example.com', emailVerified: true, preferences: null }
        })
        mock('countGithubInstallations', async () => 0)

        await settingService.getProfile({ userId: 'u1' })

        for (const field of [
            'githubToken',
            'otpHash',
            'otpExpiresAt',
            'otpAttempts',
            'githubId',
            'googleId',
            'isDeleted',
            'deletedAt',
            'referralCode',
        ]) {
            expect({ field, asked: field in select }).toEqual({ field, asked: false })
        }
    })

    it('only a verified admin email gets the admin flag and the panel path', async () => {
        process.env.ADMIN_EMAILS = 'boss@example.com'
        mock('countGithubInstallations', async () => 0)

        mock('findUserByIdForProfile', async () => ({
            id: 'u1',
            email: 'boss@example.com',
            emailVerified: false,
            preferences: null,
        }))
        const unverified = await settingService.getProfile({ userId: 'u1' })
        expect(unverified.isAdmin).toBe(false)
        expect(unverified).not.toHaveProperty('adminPath')

        mock('findUserByIdForProfile', async () => ({
            id: 'u2',
            email: 'Boss@Example.com',
            emailVerified: true,
            preferences: null,
        }))
        const admin = await settingService.getProfile({ userId: 'u2' })
        expect(admin.isAdmin).toBe(true)
        expect(typeof admin.adminPath).toBe('string')
    })

    it('a linked install counts as the app installed', async () => {
        mock('findUserByIdForProfile', async () => ({
            id: 'u1',
            email: 'a@example.com',
            emailVerified: true,
            githubAppInstall: false,
            preferences: { sendKey: 'enter', old: 1 },
        }))
        mock('countGithubInstallations', async () => 2)
        const profile = await settingService.getProfile({ userId: 'u1' })
        expect(profile.githubAppInstall).toBe(true)
        expect(profile.preferences).toEqual({ sendKey: 'enter' })
    })
})
