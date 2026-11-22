import { prisma } from '@december/database'

import type { Prisma } from '@december/database'

async function findUserByIdForInfo(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            name: true,
            githubConnected: true,
        },
    })
}

async function findUserByIdForProfile(id: string, selectFields: Prisma.UserSelect) {
    return prisma.user.findUnique({
        where: { id },
        select: selectFields,
    })
}

async function findUserByIdForExistCheck(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
        },
    })
}

async function updateUserName(id: string, name: string) {
    return prisma.user.update({
        where: { id },
        data: { name },
        select: {
            name: true,
        },
    })
}

async function updateNotifications(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({
        where: { id },
        data,
        select: {
            notifyProjectActivity: true,
            notifyProductUpdates: true,
            notifySecurityAlerts: true,
        },
    })
}

async function updateModelSource(id: string, defaultModelSource: 'CREDITS' | 'OWN_KEY') {
    return prisma.user.update({
        where: { id },
        data: { defaultModelSource },
        select: { defaultModelSource: true },
    })
}

async function findOnboardingSource(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            onboardingCompletedAt: true,
            onboardingStep: true,
            creditBalance: true,
            githubAppInstall: true,
            githubConnected: true,
            githubUsername: true,
            githubInstallations: {
                select: { accountLogin: true },
                orderBy: { createdAt: 'asc' },
                take: 1,
            },
            // the key saved last (save sets verifiedAt), so "Change" shows the new key
            providerCredentials: {
                select: { provider: true, keyHint: true },
                orderBy: { verifiedAt: 'desc' },
                take: 1,
            },
        },
    })
}

async function updateOnboardingStep(id: string, onboardingStep: string) {
    return prisma.user.update({
        where: { id },
        data: { onboardingStep },
        select: { id: true },
    })
}

// sets the date only once: a second call keeps the first date
async function markOnboardingCompleted(id: string) {
    return prisma.user.updateMany({
        where: { id, onboardingCompletedAt: null },
        data: { onboardingCompletedAt: new Date() },
    })
}

async function createFeedback(userId: string, rating: string | null, feedback: string) {
    return prisma.feedback.create({
        data: {
            userId,
            rating,
            feedback,
        },
    })
}

async function findUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            name: true,
        },
    })
}

export const settingRepository = {
    findUserByIdForInfo,
    findUserByIdForProfile,
    findUserByIdForExistCheck,
    updateUserName,

    updateNotifications,
    updateModelSource,

    findOnboardingSource,
    updateOnboardingStep,
    markOnboardingCompleted,
    createFeedback,
    findUserByEmail,
}
