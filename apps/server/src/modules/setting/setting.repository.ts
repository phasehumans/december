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
        defaultEffort?: string
        defaultOpenPullRequest?: boolean
        defaultOwnKeyProvider?: string | null
        defaultOwnKeyModel?: string | null
        defaultRepository?: string
        defaultBaseBranch?: string
    }
) {
    return prisma.user.update({
        where: { id },
        data,
        select: {
            defaultPlanFirst: true,
            defaultEffort: true,
            defaultOpenPullRequest: true,
            defaultOwnKeyProvider: true,
            defaultOwnKeyModel: true,
            defaultRepository: true,
            defaultBaseBranch: true,
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

// "create the pull request" on the pull requests page is this value (#637)
async function findOpenPullRequestDefault(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { defaultOpenPullRequest: true },
    })
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
        include: {
            user: { select: { id: true, isDeleted: true } },
        },
    })
}

// an attempt failed and the queue tries again: the row stays PENDING for that next attempt
async function markDataExportRetrying(id: string, error: string) {
    return prisma.dataExport.update({
        where: { id },
        data: { status: 'PENDING', completedAt: null, error: error.slice(0, 500) },
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
    markDataExportRetrying,
    markDataExportFailed,
    findUserForDataExport,
    findSessionIdsForDataExport,
    findSessionForDataExport,
    findStaleDataExports,
    deleteDataExports,
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
    findOpenPullRequestDefault,
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
