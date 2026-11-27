import { toDefaultOpenPullRequest, toPrCreate, toPullRequestSettings } from '@december/shared'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { deleteObject, getBinaryFile, putBinaryFile } from '../../shared/project-storage'
import { buildZip, type ZipEntry } from '../../shared/zip'
import { getAdminPath, isAdminEmail, isValidUnsubscribeToken } from '../admin/admin.utils'
import { byokService } from '../byok/byok.service'
import { notificationService } from '../notification/notification.service'
import { sessionService } from '../session/session.service'

import { enqueueDataExport } from './setting.queue'
import { settingRepository } from './setting.repository'
import {
    DATA_EXPORT_COOLDOWN_MS,
    DATA_EXPORT_LINK_MS,
    buildDataExportUrl,
    dataExportFileKey,
    dataExportSessionFileName,
    isValidDataExportToken,
    toDataExportState,
    toOnboardingStep,
    toPreferences,
    toSandboxSettings,
    cleanSetupCommands,
} from './setting.utils'

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
    notifyProductUpdates: true,
    notifySecurityAlerts: true,
    notifyLevel: true,
    notifyPush: true,
    timezone: true,

    creditBalance: true,
    isDeleted: true,
    onboardingCompletedAt: true,
    defaultModelSource: true,
    defaultPlanFirst: true,
    defaultEffort: true,
    defaultOpenPullRequest: true,
    defaultOwnKeyProvider: true,
    defaultOwnKeyModel: true,
    defaultRepository: true,
    defaultBaseBranch: true,
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
    UpdateModelSource,
    UpdateSessionDefaults,
    GetToolDenyRules,
    UpdateToolDenyRules,
    SubmitFeedback,
    GetPullRequestSettings,
    UpdatePullRequestSettings,
    UpdatePreferences,
    RequestDataExport,
    GetDataExport,
    ProcessDataExport,
    TellDataExportFailed,
    DownloadDataExport,
    PurgeDataExports,
    GetSandboxSettings,
    UpdateSandboxSettings,
    UpdateSetupCommands,
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

const updateSessionDefaults = async (data: UpdateSessionDefaults) => {
    const { userId, defaultOwnKeyProvider, defaultOwnKeyModel, ...otherDefaults } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)
    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    // a default model must be one a saved key of the user serves
    if (defaultOwnKeyProvider && defaultOwnKeyModel) {
        await byokService.assertOwnKeyUsable({
            userId,
            provider: defaultOwnKeyProvider,
            model: defaultOwnKeyModel,
        })
    }

    // a field left out is undefined here, and keeps its value
    const updated = await settingRepository.updateSessionDefaults(userId, {
        ...otherDefaults,
        defaultOwnKeyProvider,
        defaultOwnKeyModel,
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

// data export (#636)

const getDataExport = async (data: GetDataExport) => {
    const { userId } = data
    const latest = await settingRepository.findLatestDataExport(userId)
    return { export: latest ? toDataExportState(latest) : null }
}

// one a day. the zip is built in the background, then a link is emailed
const requestDataExport = async (data: RequestDataExport) => {
    const { userId } = data

    const latest = await settingRepository.findLatestDataExport(userId)
    // a failed export does not count, so the user can ask again right away
    if (
        latest &&
        latest.status !== 'FAILED' &&
        Date.now() - latest.createdAt.getTime() < DATA_EXPORT_COOLDOWN_MS
    ) {
        throw new AppError('you can export your data once a day', 429)
    }

    const created = await settingRepository.createDataExport(userId)
    try {
        await enqueueDataExport({ exportId: created.id })
    } catch (error) {
        // no job means no file: remove the row so the user can try again now
        console.error('[Setting] could not queue the data export:', error)
        await settingRepository.deleteDataExport(created.id)
        throw new AppError('could not start the export, try again in a few minutes', 503)
    }

    return { export: toDataExportState(created) }
}

// the last attempt failed: the inbox tells the user (no email)
const tellDataExportFailed = async (data: TellDataExportFailed) => {
    const { userId } = data
    try {
        await notificationService.sendNotificationToUser({
            userId,
            title: 'Your data export failed',
            message: 'We could not build your data export. You can ask for it again now.',
            type: 'ERROR',
            link: '/settings/account',
        })
    } catch (error) {
        // the export is marked failed in any case, and the user can ask again
        console.error('[Setting] could not tell the user about the failed export:', error)
    }
}

/**
 * The background job: a json file per session in a zip, stored, then a link in the inbox.
 * The queue runs a failed job again. Only when the last attempt fails is the export
 * failed and the user told.
 */
const processDataExport = async (data: ProcessDataExport) => {
    const { exportId, isLastAttempt = true } = data

    const record = await settingRepository.findDataExport(exportId)
    if (!record || record.status !== 'PENDING') return { status: record?.status ?? 'MISSING' }

    try {
        const user = await settingRepository.findUserForDataExport(record.userId)
        if (!user || record.user.isDeleted) {
            await settingRepository.markDataExportFailed(exportId, 'account deleted')
            return { status: 'FAILED' }
        }

        const exportedAt = new Date()
        const entries: ZipEntry[] = [
            {
                name: 'account.json',
                content: JSON.stringify(
                    {
                        ...user,
                        preferences: toPreferences(user.preferences),
                        exportedAt,
                    },
                    null,
                    2
                ),
            },
        ]

        const sessionIds = await settingRepository.findSessionIdsForDataExport(record.userId)
        for (const [index, { id }] of sessionIds.entries()) {
            const session = await settingRepository.findSessionForDataExport(id)
            if (!session) continue
            entries.push({
                name: dataExportSessionFileName(index, session.title),
                content: JSON.stringify(session, null, 2),
            })
        }

        const zip = buildZip(entries, exportedAt)
        const fileKey = dataExportFileKey(record.userId, exportId)
        await putBinaryFile({ key: fileKey, content: zip, contentType: 'application/zip' })

        const expiresAt = new Date(Date.now() + DATA_EXPORT_LINK_MS)
        await settingRepository.markDataExportReady(exportId, {
            fileKey,
            sizeBytes: zip.length,
            expiresAt,
        })

        const until = expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
        const downloadUrl = buildDataExportUrl(exportId)
        // the inbox has the link (no email); the Account page shows it too
        try {
            await notificationService.sendNotificationToUser({
                userId: record.userId,
                title: 'Your data export is ready',
                message: `Download your data as a zip. The link works until ${until}.`,
                type: 'SUCCESS',
                link: downloadUrl,
            })
        } catch (error) {
            // the file is ready: the Account page still shows the download link
            console.error('[Setting] could not write the inbox notice of the export:', error)
        }

        return { status: 'READY', sessions: sessionIds.length, sizeBytes: zip.length }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!isLastAttempt) {
            // the row stays PENDING, so the next attempt of the queue does the work again
            await settingRepository.markDataExportRetrying(exportId, message)
            throw error
        }
        await settingRepository.markDataExportFailed(exportId, message)
        await tellDataExportFailed({ userId: record.userId })
        throw error
    }
}

// the emailed link: no sign in, the token opens only this export until it expires
const downloadDataExport = async (data: DownloadDataExport) => {
    const { exportId, token } = data

    if (!isValidDataExportToken(exportId, token)) {
        throw new AppError('this download link is not valid', 404)
    }
    const record = await settingRepository.findDataExport(exportId)
    if (!record || record.status !== 'READY' || !record.fileKey || record.user.isDeleted) {
        throw new AppError('this download link is not valid', 404)
    }
    if (!record.expiresAt || record.expiresAt.getTime() <= Date.now()) {
        throw new AppError('this download link has expired', 410)
    }

    const file = await getBinaryFile(record.fileKey)
    if (!file) {
        throw new AppError('this download link has expired', 410)
    }

    const day = record.createdAt.toISOString().slice(0, 10)
    return { body: file.body, fileName: `december-export-${day}.zip` }
}

// the daily sweep: files whose link ended, and exports that never finished
const purgeDataExports = async (data: PurgeDataExports) => {
    const { now = new Date() } = data
    const stale = await settingRepository.findStaleDataExports(
        now,
        new Date(now.getTime() - DATA_EXPORT_LINK_MS)
    )
    for (const item of stale) {
        if (!item.fileKey) continue
        await deleteObject(item.fileKey).catch((error: unknown) => {
            // Intentionally swallowed: the row goes anyway; a missing file is the goal
            console.warn('[Setting] could not delete export file', item.fileKey, error)
        })
    }
    if (stale.length > 0) {
        await settingRepository.deleteDataExports(stale.map((item) => item.id))
    }
    return { deleted: stale.length }
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

// a user with no saved row gets every default. "create the pull request" is the user's
// "open pull request" default (#632, #637): one stored value for this page and the prompt box
const getPullRequestSettings = async (data: GetPullRequestSettings) => {
    const { userId } = data
    const [row, user] = await Promise.all([
        settingRepository.findPullRequestSettings(userId),
        settingRepository.findOpenPullRequestDefault(userId),
    ])
    return {
        ...toPullRequestSettings(row),
        prCreate: toPrCreate(user?.defaultOpenPullRequest ?? true),
    }
}

const updatePullRequestSettings = async (data: UpdatePullRequestSettings) => {
    const { userId, settings } = data
    const { prCreate, ...rowSettings } = settings
    const reviewRepos = rowSettings.reviewRepos
        ? Array.from(new Set(rowSettings.reviewRepos.map((r) => r.toLowerCase())))
        : undefined

    // saved on the user, where the session defaults and the profile read it
    if (prCreate !== undefined) {
        await settingRepository.updateSessionDefaults(userId, {
            defaultOpenPullRequest: toDefaultOpenPullRequest(prCreate),
        })
        await invalidateUserSettingCache(userId)
    }

    if (Object.keys(rowSettings).length > 0) {
        await settingRepository.upsertPullRequestSettings(userId, {
            ...rowSettings,
            ...(reviewRepos ? { reviewRepos } : {}),
        })
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

/** the setup commands of one repository (#637). an empty text removes the row */
const updateSetupCommands = async (data: UpdateSetupCommands) => {
    const { userId, repoFullName, commands } = data
    // lower case, so the worker finds the row for any spelling of the repository
    const repo = repoFullName.toLowerCase()
    const text = cleanSetupCommands(commands)
    if (text) {
        await settingRepository.upsertSetupCommands(userId, repo, text)
    } else {
        await settingRepository.deleteSetupCommands(userId, repo)
    }
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
    updateModelSource,
    updateSessionDefaults,
    getToolDenyRules,
    updateToolDenyRules,
    updatePreferences,
    getDataExport,
    requestDataExport,
    processDataExport,
    downloadDataExport,
    purgeDataExports,
    getOnboarding,
    updateOnboarding,
    completeOnboarding,
    submitFeedback,
    getPullRequestSettings,
    updatePullRequestSettings,
    getSandboxSettings,
    updateSandboxSettings,
    updateSetupCommands,
    archiveInactiveSessions,
}
