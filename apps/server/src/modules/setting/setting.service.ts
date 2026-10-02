import bcrypt from 'bcrypt'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'

import { settingRepository } from './setting.repository'

export const settingSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    emailVerified: true,
    googleId: true,
    githubConnected: true,
    githubAppInstall: true,
    githubUsername: true,
    vercelConnected: true,
    vercelTeamId: true,
    vercelConfigurationId: true,
    supabaseConnected: true,
    supabaseUserId: true,
    supabaseConnectedAt: true,
    notionWorkspaceId: true,
    notionWorkspaceName: true,
    notifyProjectActivity: true,
    notifyProductUpdates: true,
    notifySecurityAlerts: true,

    creditBalance: true,
    isDeleted: true,
    hasCompletedOnboarding: true,
    welcomeCardDone: true,
    githubCardDone: true,
    feedbackCardDone: true,
}

import type {
    GetMe,
    GetProfile,
    UpdateName,
    UpdateUsername,
    ChangePassword,
    UpdateNotifications,
    CompleteOnboarding,
    DismissOnboardingCard,
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

        const { password, ...rest } = profile
        return {
            ...rest,
            hasPassword: password !== null,
        }
    })
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

const updateUsername = async (data: UpdateUsername) => {
    const { userId, username } = data

    const existingUser = await settingRepository.findUserByIdForUsernameCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (username === existingUser.username) {
        throw new AppError('new username must be different from the current one', 400)
    }

    const existingUsername = await settingRepository.findUserByUsername(username)

    if (existingUsername) {
        throw new AppError(`${username} is already taken, try another one`, 409)
    }

    try {
        const updatedUser = await settingRepository.updateUsername(userId, username)
        await invalidateUserSettingCache(userId)

        return updatedUser
    } catch (error: any) {
        // race condition safety
        if (error.code === 'P2002') {
            throw new AppError(`${username} is already taken, try another one`, 409)
        }

        throw error
    }
}

const changePassword = async (data: ChangePassword) => {
    const { currentPassword, newPassword, userId } = data

    const existingUser = await settingRepository.findUserPasswordById(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (!existingUser.password) {
        // oauth only user setting password for the first time
        const hashPassword = await bcrypt.hash(newPassword, 10)

        await settingRepository.updatePassword(userId, hashPassword)
        await invalidateUserSettingCache(userId)

        return { success: true }
    }

    if (!currentPassword) {
        throw new AppError('current password is required', 400)
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, existingUser.password)

    if (!isCurrentPasswordValid) {
        throw new AppError('current password is incorrect', 401)
    }

    const isSamePassword = await bcrypt.compare(newPassword, existingUser.password)

    if (isSamePassword) {
        throw new AppError('new password must be different from current password', 400)
    }

    const hashPassword = await bcrypt.hash(newPassword, 10)

    await settingRepository.updatePassword(userId, hashPassword)
    await invalidateUserSettingCache(userId)

    return { success: true }
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

const completeOnboarding = async (data: CompleteOnboarding) => {
    const { userId } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await settingRepository.updateCompleteOnboarding(userId)
    await invalidateUserSettingCache(userId)

    return updatedUser
}

const dismissOnboardingCard = async (data: DismissOnboardingCard) => {
    const { userId, card } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    let updatedUser
    if (card === 'welcome') {
        updatedUser = await settingRepository.updateWelcomeCardDone(userId)
    } else if (card === 'github') {
        updatedUser = await settingRepository.updateGithubCardDone(userId)
    } else if (card === 'feedback') {
        updatedUser = await settingRepository.updateFeedbackCardDone(userId)
    }

    await invalidateUserSettingCache(userId)

    return updatedUser
}

const submitFeedback = async (data: SubmitFeedback) => {
    const { userId, rating, feedback } = data
    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    // Save feedback to DB
    await settingRepository.createFeedback(userId, rating, feedback)

    // Mark feedback card as done
    const updatedUser = await settingRepository.updateFeedbackCardDone(userId)
    await invalidateUserSettingCache(userId)

    return updatedUser
}

export const settingService = {
    getMe,
    getProfile,
    updateName,
    updateUsername,
    changePassword,
    updateNotifications,
    completeOnboarding,
    dismissOnboardingCard,
    submitFeedback,
}
