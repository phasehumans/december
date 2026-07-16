import bcrypt from 'bcrypt'

import { AppError } from '../../shared/appError'

import { profileRepository } from './profile.repository'

export const profileSelect = {
    id: true,
    name: true,
    username: true,
    email: true,
    createdAt: true,
    updatedAt: true,
    emailVerified: true,
    googleId: true,
    githubConnected: true,
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
    chatSuggestions: true,
    generationSound: true,
    design: true,
    avatarUrl: true,
    creditBalance: true,
    isDeleted: true,
    hasCompletedOnboarding: true,
}

import type {
    GetInfo,
    GetProfileCard,
    GetProfile,
    UpdateName,
    UpdateUsername,
    UpdateAvatarUrl,
    ChangePassword,
    UpdateNotifications,
    ChatSuggestions,
    UpdateGenerationSoundPayload,
    Getdesign,
    Updatedesign,
    Deletedesign,
    CreateFeedback,
    CompleteOnboarding,
} from './profile.types'

const getInfo = async (data: GetInfo) => {
    const { userId } = data
    const profile = await profileRepository.findUserByIdForInfo(userId)

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    const fullName = profile.name || 'Profile'
    const isGithubConnected = profile.githubConnected

    return { fullName, isGithubConnected }
}

const getProfileCard = async (data: GetProfileCard) => {
    const { userId } = data
    const profile = await profileRepository.findUserByIdForCard(userId)

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    return profile
}

const getProfile = async (data: GetProfile) => {
    const { userId } = data
    const profile = await profileRepository.findUserByIdForProfile(userId, profileSelect)

    if (!profile) {
        throw new AppError('user not found', 404)
    }

    const { password, ...rest } = profile
    return {
        ...rest,
        hasPassword: password !== null,
    }
}

const updateName = async (data: UpdateName) => {
    const { name, userId } = data

    const existingUser = await profileRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await profileRepository.updateUserName(userId, name)

    return updatedUser
}

const updateUsername = async (data: UpdateUsername) => {
    const { userId, username } = data

    const existingUser = await profileRepository.findUserByIdForUsernameCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (username === existingUser.username) {
        throw new AppError('new username must be different from the current one', 400)
    }

    const existingUsername = await profileRepository.findUserByUsername(username)

    if (existingUsername) {
        throw new AppError(`${username} is already taken, try another one`, 409)
    }

    try {
        const updatedUser = await profileRepository.updateUsername(userId, username)

        return updatedUser
    } catch (error: any) {
        // race condition safety
        if (error.code === 'P2002') {
            throw new AppError(`${username} is already taken, try another one`, 409)
        }

        throw error
    }
}

const updateAvatarUrl = async (data: UpdateAvatarUrl) => {
    const { userId, avatarUrl } = data

    const existingUser = await profileRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await profileRepository.updateAvatarUrl(userId, avatarUrl)

    return updatedUser
}

const changePassword = async (data: ChangePassword) => {
    const { currentPassword, newPassword, userId } = data

    const existingUser = await profileRepository.findUserPasswordById(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (!existingUser.password) {
        // OAuth only user setting password for the first time
        const hashPassword = await bcrypt.hash(newPassword, 10)

        await profileRepository.updatePassword(userId, hashPassword)

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

    await profileRepository.updatePassword(userId, hashPassword)

    return { success: true }
}

const updateNotifications = async (data: UpdateNotifications) => {
    const { userId, notifyProductUpdates, notifyProjectActivity, notifySecurityAlerts } = data

    const existingUser = await profileRepository.findUserByIdForExistCheck(userId)

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

    const updatedUser = await profileRepository.updateNotifications(userId, updateData)

    return updatedUser
}

const chatSuggestions = async (data: ChatSuggestions) => {
    const { userId, chatSuggestions } = data

    const existingUser = await profileRepository.findUserByIdForChatSuggestions(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.chatSuggestions === chatSuggestions) {
        throw new AppError(
            'new input must be different from the current chat suggestion state',
            400
        )
    }

    const updatedUser = await profileRepository.updateChatSuggestions(userId, chatSuggestions)

    return updatedUser
}

const generationSound = async (data: UpdateGenerationSoundPayload) => {
    const { userId, generationSound } = data

    const existingUser = await profileRepository.findUserByIdForGenerationSound(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    if (existingUser.generationSound === generationSound) {
        throw new AppError(
            'new input must be different from the current generation sound state',
            400
        )
    }

    const updatedUser = await profileRepository.updateGenerationSound(userId, generationSound)

    return updatedUser
}

const getdesign = async (data: Getdesign) => {
    const { userId } = data
    const user = await profileRepository.getUserDesign(userId)

    if (!user) {
        throw new AppError('user not found', 404)
    }

    return { design: user.design }
}

const updatedesign = async (data: Updatedesign) => {
    const { userId, design } = data

    const existingUser = await profileRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await profileRepository.updateUserDesign(userId, design)

    return { design: updatedUser.design }
}

const deletedesign = async (data: Deletedesign) => {
    const { userId } = data
    const existingUser = await profileRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    await profileRepository.deleteUserDesign(userId)
}

const completeOnboarding = async (data: CompleteOnboarding) => {
    const { userId } = data
    const existingUser = await profileRepository.findUserByIdForExistCheck(userId)

    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updatedUser = await profileRepository.updateCompleteOnboarding(userId)

    return updatedUser
}

const createFeedback = async (data: CreateFeedback) => {
    const { userId, rating, feedback } = data
    const ratingStr = rating !== undefined && rating !== null ? String(rating) : null
    return profileRepository.createFeedback({
        userId: userId,
        rating: ratingStr,
        feedback: feedback,
    })
}

export const profileService = {
    getInfo,
    getProfileCard,
    getProfile,
    updateName,
    updateUsername,
    updateAvatarUrl,
    changePassword,
    updateNotifications,
    chatSuggestions,
    generationSound,
    getdesign,
    updatedesign,
    deletedesign,
    completeOnboarding,
    createFeedback,
}
