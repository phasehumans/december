import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { isAdminEmail, isValidUnsubscribeToken } from '../admin/admin.utils'

import { settingRepository } from './setting.repository'
import { toOnboardingStep } from './setting.utils'

export const settingSelect = {
    id: true,
    name: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    emailVerified: true,
    googleId: true,
    githubConnected: true,
    githubAppInstall: true,
    githubUsername: true,
    notifyProjectActivity: true,
    notifyProductUpdates: true,
    notifySecurityAlerts: true,

    creditBalance: true,
    isDeleted: true,
    onboardingCompletedAt: true,
    defaultModelSource: true,
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
    UpdateModelSource,
    SubmitFeedback,
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
        const isGithubConnected = profile.githubConnected

        return { fullName, isGithubConnected }
    })
}

const getProfile = async (data: GetProfile) => {
    const { userId } = data
    return appCache.wrap(appCache.key('setting', 'profile', userId), 300, async () => {
        const profile = await settingRepository.findUserByIdForProfile(userId, settingSelect)

        if (!profile) {
            throw new AppError('user not found', 404)
        }

        // for the web app only; every /admin route checks ADMIN_EMAILS again on the server
        return { ...profile, isAdmin: profile.emailVerified && isAdminEmail(profile.email) }
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

const updateModelSource = async (data: UpdateModelSource) => {
    const { userId, defaultModelSource } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)
    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await settingRepository.updateModelSource(userId, defaultModelSource)
    await invalidateUserSettingCache(userId)

    return updatedUser
}

const updateNotifications = async (data: UpdateNotifications) => {
    const { userId, notifyProductUpdates, notifyProjectActivity, notifySecurityAlerts } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updateData: {
        notifyProjectActivity?: boolean
        notifyProductUpdates?: boolean
        notifySecurityAlerts?: boolean
    } = {}

    if (notifyProjectActivity !== undefined) {
        updateData.notifyProjectActivity = notifyProjectActivity
    }

    if (notifyProductUpdates !== undefined) {
        updateData.notifyProductUpdates = notifyProductUpdates
    }

    if (notifySecurityAlerts !== undefined) {
        updateData.notifySecurityAlerts = notifySecurityAlerts
    }

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

    return { id: created.id }
}

export const settingService = {
    checkUnsubscribe,
    unsubscribe,
    getMe,
    getProfile,
    updateName,
    updateNotifications,
    updateModelSource,
    getOnboarding,
    updateOnboarding,
    completeOnboarding,
    submitFeedback,
}
