import { prisma } from '@december/database'

import type { Prisma } from '@december/database'
import type { PullRequestSettingsValues } from '@december/shared'

async function findUserByIdForInfo(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            name: true,
            githubConnected: true,
            githubAppInstall: true,
            _count: { select: { githubInstallations: true } },
        },
    })
}

async function countGithubInstallations(userId: string) {
    return prisma.githubAppInstallation.count({ where: { userId } })
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
            email: true,
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
            notifyPush: true,
            timezone: true,
        },
    })
}

// a field left out (undefined) keeps its value
async function updateSessionDefaults(
    id: string,
    data: {
        defaultPlanFirst?: boolean
        defaultOpenPullRequest?: boolean
    }
) {
    return prisma.user.update({
        where: { id },
        data,
        select: {
            defaultPlanFirst: true,
            defaultOpenPullRequest: true,
        },
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

async function countProviderCredentials(userId: string) {
    return prisma.providerCredential.count({ where: { userId } })
}

async function updateModelSource(id: string, defaultModelSource: 'CREDITS' | 'OWN_KEY') {
    return prisma.user.update({
        where: { id },
        data: { defaultModelSource },
        select: { defaultModelSource: true },
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

async function findSandboxSettings(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: {
            idleStopMinutes: true,
            archiveAfterDays: true,
            repositorySettings: {
                select: { repoFullName: true, setupCommands: true },
                orderBy: { repoFullName: 'asc' },
            },
        },
    })
}

async function updateSandboxSettings(
    userId: string,
    settings: { idleStopMinutes?: number; archiveAfterDays?: number | null }
) {
    return prisma.user.update({
        where: { id: userId },
        data: settings,
        select: { id: true },
    })
}

async function upsertSetupCommands(userId: string, repoFullName: string, setupCommands: string) {
    return prisma.repositorySetting.upsert({
        where: { userId_repoFullName: { userId, repoFullName } },
        create: { userId, repoFullName, setupCommands },
        update: { setupCommands },
    })
}

async function deleteSetupCommands(userId: string, repoFullName: string) {
    return prisma.repositorySetting.deleteMany({ where: { userId, repoFullName } })
}

/**
 * Archives the sessions of users with archiveAfterDays set that were not updated for that
 * many days, are not pinned and have no sandbox that runs or starts. Returns the ids of
 * the users with a changed session.
 */
async function archiveInactiveSessions(now: Date): Promise<string[]> {
    // raw SQL, like the other archive paths: updatedAt stays, so the list order and the
    // 30 day delete of the daily sweep do not change
    const rows = await prisma.$queryRaw<Array<{ userId: string }>>`
        UPDATE "Session" s
        SET "isArchived" = true
        FROM "User" u
        WHERE s."userId" = u."id"
            AND u."archiveAfterDays" IS NOT NULL
            AND s."isArchived" = false
            AND s."pinnedAt" IS NULL
            AND (s."sandboxStatus" IS NULL OR s."sandboxStatus" NOT IN ('RUNNING', 'STARTING'))
            AND s."updatedAt" < ${now}::timestamp - (u."archiveAfterDays" * INTERVAL '1 day')
        RETURNING s."userId"`
    return Array.from(new Set(rows.map((row) => row.userId)))
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

export const settingRepository = {
    countProviderCredentials,
    disableProductUpdates,
    findUserByIdForInfo,
    countGithubInstallations,
    findUserByIdForProfile,
    findUserByIdForExistCheck,
    updateUserName,

    updateNotifications,
    updateModelSource,
    updateSessionDefaults,
    findToolDenyRules,
    updateToolDenyRules,
    findPreferences,
    updatePreferences,
    findPullRequestSettings,
    upsertPullRequestSettings,
    findSandboxSettings,
    updateSandboxSettings,
    upsertSetupCommands,
    deleteSetupCommands,
    archiveInactiveSessions,

    findOnboardingSource,
    updateOnboardingStep,
    markOnboardingCompleted,
    createFeedback,
    findUserByEmail,
}
