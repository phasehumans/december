import { toPullRequestSettings } from '@december/shared'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { getAdminPath, isAdminEmail, isValidUnsubscribeToken } from '../admin/admin.utils'
import { notificationService } from '../notification/notification.service'
import { sessionService } from '../session/session.service'

import { settingRepository } from './setting.repository'
import { toOnboardingStep, toPreferences, toSandboxSettings } from './setting.utils'

const settingSelect = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    emailVerified: true,
    githubConnected: true,
    githubAppInstall: true,
    githubUsername: true,
    notifyProductUpdates: true,
    notifySecurityAlerts: true,
    notifyLevel: true,
    notifyPush: true,
    timezone: true,

    creditBalance: true,
    onboardingCompletedAt: true,
    defaultPlanFirst: true,
    defaultOpenPullRequest: true,
    preferences: true,
}

import type {
    Unsubscribe,
    GetMe,
    GetProfile,
    UpdateName,
    UpdateNotifications,
    GetOnboarding,
    UpdateOnboarding,
    CompleteOnboarding,
    OnboardingState,
    UpdateSessionDefaults,
    GetToolDenyRules,
    UpdateToolDenyRules,
    SubmitFeedback,
    GetPullRequestSettings,
    UpdatePullRequestSettings,
    UpdatePreferences,
    GetSandboxSettings,
    UpdateSandboxSettings,
    ArchiveInactiveSessions,
} from './setting.types'

const invalidateUserSettingCache = async (userId: string) => {
    await Promise.all([
        appCache.del(appCache.key('setting', 'me', userId)),
        appCache.del(appCache.key('setting', 'profile', userId)),
    ])
}

const getMe = async (data: GetMe) => {
    const { userId } = data
    return appCache.wrap(appCache.key('setting', 'me', userId), 300, async () => {
        const profile = await settingRepository.findUserByIdForInfo(userId)

        if (!profile) {
            throw new AppError('user not found', 404)
        }

        const fullName = profile.name || 'Profile'
        // any linked install counts, the same rule as onboarding
        const isGithubConnected =
            profile.githubConnected ||
            profile.githubAppInstall ||
            profile._count.githubInstallations > 0

        return { fullName, isGithubConnected }
    })
}

const getProfile = async (data: GetProfile) => {
    const { userId } = data
    return appCache.wrap(appCache.key('setting', 'profile', userId), 300, async () => {
        const [profile, installations] = await Promise.all([
            settingRepository.findUserByIdForProfile(userId, settingSelect),
            settingRepository.countGithubInstallations(userId),
        ])

        if (!profile) {
            throw new AppError('user not found', 404)
        }

        // for the web app only; every admin api route checks ADMIN_EMAILS again on the server.
        // only the admin is told where the panel is
        const isAdmin = profile.emailVerified && isAdminEmail(profile.email)
        return {
            ...profile,
            // any linked install counts as installed, the same rule as onboarding
            githubAppInstall: Boolean(profile.githubAppInstall) || installations > 0,
            preferences: toPreferences(profile.preferences),
            isAdmin,
            ...(isAdmin ? { adminPath: getAdminPath() } : {}),
        }
    })
}

const checkUnsubscribe = async (data: Unsubscribe) => {
    const { userId, token } = data
    if (!isValidUnsubscribeToken(userId, token)) {
        throw new AppError('this unsubscribe link is not valid', 400)
    }
    return { valid: true }
}

const unsubscribe = async (data: Unsubscribe) => {
    const { userId, token } = data
    if (!isValidUnsubscribeToken(userId, token)) {
        throw new AppError('this unsubscribe link is not valid', 400)
    }
    const updated = await settingRepository.disableProductUpdates(userId)
    if (updated.count === 0) {
        throw new AppError('this unsubscribe link is not valid', 400)
    }
    await invalidateUserSettingCache(userId)
    return { unsubscribed: true }
}

const updateName = async (data: UpdateName) => {
    const { name, userId } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await settingRepository.updateUserName(userId, name)
    await invalidateUserSettingCache(userId)

    return updatedUser
}

const updateSessionDefaults = async (data: UpdateSessionDefaults) => {
    const { userId, defaultPlanFirst, defaultOpenPullRequest } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)
    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    // a field left out is undefined here, and keeps its value
    const updated = await settingRepository.updateSessionDefaults(userId, {
        defaultPlanFirst,
        defaultOpenPullRequest,
    })
    await invalidateUserSettingCache(userId)

    return updated
}

// merges the sent values into the saved ones, so each device can save one value at a time
const updatePreferences = async (data: UpdatePreferences) => {
    const { userId, preferences } = data

    const existing = await settingRepository.findPreferences(userId)
    if (!existing) {
        throw new AppError('user not found', 404)
    }

    const merged = { ...toPreferences(existing.preferences), ...preferences }
    const updated = await settingRepository.updatePreferences(userId, merged)
    await invalidateUserSettingCache(userId)

    return { preferences: toPreferences(updated.preferences) }
}

const getToolDenyRules = async (data: GetToolDenyRules) => {
    const { userId } = data
    const user = await settingRepository.findToolDenyRules(userId)
    if (!user) throw new AppError('user not found', 404)
    return { rules: user.toolDenyRules }
}

/** the whole list is saved at once; duplicates are dropped, the order is kept */
const updateToolDenyRules = async (data: UpdateToolDenyRules) => {
    const { userId, rules } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)
    if (!existingUser) throw new AppError('user not found', 404)
    const updated = await settingRepository.updateToolDenyRules(userId, [...new Set(rules)])
    return { rules: updated.toolDenyRules }
}

const updateNotifications = async (data: UpdateNotifications) => {
    const { userId, settings } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    // only the fields that were sent change
    const updateData = Object.fromEntries(
        Object.entries(settings).filter(([, value]) => value !== undefined)
    )
    if (Object.keys(updateData).length === 0) {
        throw new AppError('at least one notification setting must be provided', 400)
    }

    const updatedUser = await settingRepository.updateNotifications(userId, updateData)
    await invalidateUserSettingCache(userId)

    return updatedUser
}

// not cached: a payment, a saved key or a GitHub install must show right away
const getOnboarding = async (data: GetOnboarding): Promise<OnboardingState> => {
    const { userId } = data
    const source = await settingRepository.findOnboardingSource(userId)

    if (!source) {
        throw new AppError('user not found', 404)
    }

    const installation = source.githubInstallations[0] ?? null
    const ownKey = source.providerCredentials[0] ?? null
    const gitlab = source.gitConnections[0] ?? null

    return {
        completedAt: source.onboardingCompletedAt,
        step: toOnboardingStep(source.onboardingStep),
        steps: {
            models: ownKey !== null || source.creditBalance > 0,
            // the github app install, a github oauth connection or gitlab: all give repo access
            github:
                installation !== null ||
                Boolean(source.githubAppInstall) ||
                Boolean(source.githubConnected) ||
                gitlab !== null,
        },
        github: installation
            ? { accountLogin: installation.accountLogin }
            : source.githubConnected
              ? { accountLogin: source.githubUsername }
              : null,
        gitlab: gitlab ? { username: gitlab.username } : null,
        wallet: { balanceInCents: source.creditBalance },
        ownKey: ownKey ? { provider: ownKey.provider, keyHint: ownKey.keyHint } : null,
    }
}

const updateOnboarding = async (data: UpdateOnboarding) => {
    const { userId, step } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    await settingRepository.updateOnboardingStep(userId, step)

    return getOnboarding({ userId })
}

const completeOnboarding = async (data: CompleteOnboarding) => {
    const { userId } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    await settingRepository.markOnboardingCompleted(userId)
    await invalidateUserSettingCache(userId)

    return getOnboarding({ userId })
}

const submitFeedback = async (data: SubmitFeedback) => {
    const { userId, rating, feedback } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const created = await settingRepository.createFeedback(userId, rating, feedback)

    // A2: the admins see it in their December inbox (no email)
    try {
        const text = feedback.replace(/\s+/g, ' ').trim()
        await notificationService.sendNotificationToAdmins({
            title: rating ? `Feedback (${rating})` : 'Feedback',
            message: `${existingUser.email}: ${text.length > 200 ? `${text.slice(0, 199)}…` : text}`,
            type: 'INFO',
            link: `${getAdminPath()}#users`,
        })
    } catch (error) {
        // the feedback is saved; the admin still sees it on the Users tab
        console.error('[Setting] could not tell the admins about new feedback:', error)
    }

    return { id: created.id }
}

// a user with no saved row gets every default. "open a pull request" is not here: the
// prompt box keeps it ("Set as default")
const getPullRequestSettings = async (data: GetPullRequestSettings) => {
    const { userId } = data
    const row = await settingRepository.findPullRequestSettings(userId)
    return toPullRequestSettings(row)
}

const updatePullRequestSettings = async (data: UpdatePullRequestSettings) => {
    const { userId, settings } = data
    if (Object.keys(settings).length > 0) {
        await settingRepository.upsertPullRequestSettings(userId, settings)
    }
    return getPullRequestSettings({ userId })
}

const getSandboxSettings = async (data: GetSandboxSettings) => {
    const { userId } = data
    const row = await settingRepository.findSandboxSettings(userId)
    if (!row) {
        throw new AppError('user not found', 404)
    }
    return toSandboxSettings(row)
}

const updateSandboxSettings = async (data: UpdateSandboxSettings) => {
    const { userId, settings } = data
    await settingRepository.updateSandboxSettings(userId, settings)
    return getSandboxSettings({ userId })
}

/**
 * The daily archive job (#637): archives the sessions of users with archiveAfterDays set
 * that were not updated for that many days. Pinned sessions and sessions with a running
 * sandbox stay. Nothing is deleted.
 */
const archiveInactiveSessions = async (data: ArchiveInactiveSessions) => {
    const { now = new Date() } = data
    const userIds = await settingRepository.archiveInactiveSessions(now)
    // an archived session leaves the recent list
    await Promise.all(userIds.map((userId) => sessionService.invalidateRecentSessions({ userId })))
    return { users: userIds.length }
}

export const settingService = {
    checkUnsubscribe,
    unsubscribe,
    getMe,
    getProfile,
    updateName,
    updateNotifications,
    updateSessionDefaults,
    getToolDenyRules,
    updateToolDenyRules,
    updatePreferences,
    getOnboarding,
    updateOnboarding,
    completeOnboarding,
    submitFeedback,
    getPullRequestSettings,
    updatePullRequestSettings,
    getSandboxSettings,
    updateSandboxSettings,
    archiveInactiveSessions,
}
