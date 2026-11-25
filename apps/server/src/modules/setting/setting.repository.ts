import { prisma } from '@december/database'

import type { Prisma } from '@december/database'
import type { PullRequestSettingsValues } from '@december/shared'

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
            notifyProductUpdates: true,
            notifySecurityAlerts: true,
            notifyLevel: true,
            notifyEmail: true,
            notifyPush: true,
            digestEnabled: true,
            digestTime: true,
            timezone: true,
        },
    })
}

async function updateSessionDefaults(
    id: string,
    data: { defaultPlanFirst?: boolean; defaultEffort?: string; defaultOpenPullRequest?: boolean }
) {
    return prisma.user.update({
        where: { id },
        data,
        select: { defaultPlanFirst: true, defaultEffort: true, defaultOpenPullRequest: true },
    })
}

async function findToolDenyRules(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { toolDenyRules: true } })
}

async function updateToolDenyRules(id: string, toolDenyRules: string[]) {
    return prisma.user.update({
        where: { id },
        data: { toolDenyRules },
        select: { toolDenyRules: true },
    })
}

async function updateModelSource(id: string, defaultModelSource: 'CREDITS' | 'OWN_KEY') {
    return prisma.user.update({
        where: { id },
        data: { defaultModelSource },
        select: { defaultModelSource: true },
    })
}

async function updateSupportAccess(id: string, supportAccessUntil: Date | null) {
    return prisma.user.update({
        where: { id },
        data: { supportAccessUntil },
        select: { supportAccessUntil: true },
    })
}

async function findPreferences(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: { preferences: true },
    })
}

async function updatePreferences(id: string, preferences: Prisma.InputJsonValue) {
    return prisma.user.update({
        where: { id },
        data: { preferences },
        select: { preferences: true },
    })
}

async function findPullRequestSettings(userId: string) {
    return prisma.pullRequestSettings.findUnique({ where: { userId } })
}

async function upsertPullRequestSettings(
    userId: string,
    settings: Partial<PullRequestSettingsValues>
) {
    return prisma.pullRequestSettings.upsert({
        where: { userId },
        create: { userId, ...settings },
        update: settings,
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
            gitConnections: {
                where: { provider: 'GITLAB' },
                select: { username: true },
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

async function disableProductUpdates(id: string) {
    return prisma.user.updateMany({
        where: { id },
        data: { notifyProductUpdates: false },
    })
}

// data export (#636)

async function findLatestDataExport(userId: string) {
    return prisma.dataExport.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    })
}

async function createDataExport(userId: string) {
    return prisma.dataExport.create({ data: { userId } })
}

async function deleteDataExport(id: string) {
    return prisma.dataExport.delete({ where: { id } })
}

async function findDataExport(id: string) {
    return prisma.dataExport.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true, isDeleted: true } } },
    })
}

async function markDataExportReady(
    id: string,
    data: { fileKey: string; sizeBytes: number; expiresAt: Date }
) {
    return prisma.dataExport.update({
        where: { id },
        data: { ...data, status: 'READY', completedAt: new Date(), error: null },
    })
}

async function markDataExportFailed(id: string, error: string) {
    return prisma.dataExport.update({
        where: { id },
        data: { status: 'FAILED', completedAt: new Date(), error: error.slice(0, 500) },
    })
}

async function findUserForDataExport(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            githubUsername: true,
            defaultModelSource: true,
            defaultPlanFirst: true,
            defaultEffort: true,
            defaultOpenPullRequest: true,
            notifyProductUpdates: true,
            notifySecurityAlerts: true,
            preferences: true,
        },
    })
}

async function findSessionIdsForDataExport(userId: string) {
    return prisma.session.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    })
}

// what the user made: the session and its messages, not sandbox or billing internals
async function findSessionForDataExport(id: string) {
    return prisma.session.findUnique({
        where: { id },
        select: {
            id: true,
            title: true,
            description: true,
            type: true,
            status: true,
            isArchived: true,
            tags: true,
            gitProvider: true,
            repoUrl: true,
            githubRepoOwner: true,
            githubRepoName: true,
            branch: true,
            prNumber: true,
            prUrl: true,
            prState: true,
            prTitle: true,
            createdAt: true,
            updatedAt: true,
            messages: {
                orderBy: { sequence: 'asc' },
                select: {
                    role: true,
                    content: true,
                    status: true,
                    sequence: true,
                    blocks: true,
                    createdAt: true,
                },
            },
        },
    })
}

// exports whose link ended, and exports that never finished
async function findStaleDataExports(now: Date, staleBefore: Date) {
    return prisma.dataExport.findMany({
        where: {
            OR: [
                { expiresAt: { lt: now } },
                { status: { not: 'READY' }, createdAt: { lt: staleBefore } },
            ],
        },
        select: { id: true, fileKey: true },
    })
}

async function deleteDataExports(ids: string[]) {
    return prisma.dataExport.deleteMany({ where: { id: { in: ids } } })
}

export const settingRepository = {
    findLatestDataExport,
    createDataExport,
    deleteDataExport,
    findDataExport,
    markDataExportReady,
    markDataExportFailed,
    findUserForDataExport,
    findSessionIdsForDataExport,
    findSessionForDataExport,
    findStaleDataExports,
    deleteDataExports,
    disableProductUpdates,
    findUserByIdForInfo,
    findUserByIdForProfile,
    findUserByIdForExistCheck,
    updateUserName,

    updateNotifications,
    updateModelSource,
    updateSessionDefaults,
    findToolDenyRules,
    updateToolDenyRules,
    updateSupportAccess,
    findPreferences,
    updatePreferences,
    findPullRequestSettings,
    upsertPullRequestSettings,

    findOnboardingSource,
    updateOnboardingStep,
    markOnboardingCompleted,
    createFeedback,
    findUserByEmail,
}
