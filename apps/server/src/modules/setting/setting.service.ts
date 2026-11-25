import { toPullRequestSettings } from '@december/shared'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { deleteObject, getBinaryFile, putBinaryFile } from '../../shared/project-storage'
import { buildZip, type ZipEntry } from '../../shared/zip'
import { isAdminEmail, isValidUnsubscribeToken } from '../admin/admin.utils'
import { emailService } from '../email/email.service'

import { enqueueDataExport } from './setting.queue'
import { settingRepository } from './setting.repository'
import {
    DATA_EXPORT_COOLDOWN_MS,
    DATA_EXPORT_LINK_MS,
    SUPPORT_ACCESS_MS,
    buildDataExportUrl,
    dataExportFileKey,
    dataExportSessionFileName,
    isValidDataExportToken,
    toDataExportState,
    toOnboardingStep,
    toPreferences,
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
    notifyEmail: true,
    notifyPush: true,
    digestEnabled: true,
    digestTime: true,
    timezone: true,

    creditBalance: true,
    isDeleted: true,
    onboardingCompletedAt: true,
    defaultModelSource: true,
    defaultPlanFirst: true,
    defaultEffort: true,
    defaultOpenPullRequest: true,
    supportAccessUntil: true,
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
    UpdateSupportAccess,
    RequestDataExport,
    GetDataExport,
    ProcessDataExport,
    DownloadDataExport,
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
        return {
            ...profile,
            preferences: toPreferences(profile.preferences),
            isAdmin: profile.emailVerified && isAdminEmail(profile.email),
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
    const { userId, defaultPlanFirst, defaultEffort, defaultOpenPullRequest } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)
    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const updated = await settingRepository.updateSessionDefaults(userId, {
        ...(defaultPlanFirst !== undefined ? { defaultPlanFirst } : {}),
        ...(defaultEffort !== undefined ? { defaultEffort } : {}),
        ...(defaultOpenPullRequest !== undefined ? { defaultOpenPullRequest } : {}),
    })
    await invalidateUserSettingCache(userId)

    return updated
}

// on: the admin page can open this user's sessions for 7 days. off: right away
const updateSupportAccess = async (data: UpdateSupportAccess) => {
    const { userId, enabled } = data

    const existingUser = await settingRepository.findUserByIdForExistCheck(userId)
    if (!existingUser) {
        throw new AppError('user not found', 404)
    }

    const supportAccessUntil = enabled ? new Date(Date.now() + SUPPORT_ACCESS_MS) : null
    const updated = await settingRepository.updateSupportAccess(userId, supportAccessUntil)
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

// the background job: a json file per session in a zip, stored, then emailed as a link
const processDataExport = async (data: ProcessDataExport) => {
    const { exportId } = data

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
        await emailService.sendMessageEmail({
            to: user.email,
            subject: 'Your December data export',
            body: [
                'Your data export is ready. It has your account and every session with its messages, as JSON files in a zip.',
                `Download it here: ${buildDataExportUrl(exportId)}`,
                `The link works until ${until}.`,
            ].join('\n\n'),
        })

        return { status: 'READY', sessions: sessionIds.length, sizeBytes: zip.length }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await settingRepository.markDataExportFailed(exportId, message)
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
const purgeDataExports = async () => {
    const now = new Date()
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

    return { id: created.id }
}

// a user with no saved row gets every default
const getPullRequestSettings = async (data: GetPullRequestSettings) => {
    const { userId } = data
    const row = await settingRepository.findPullRequestSettings(userId)
    return toPullRequestSettings(row)
}

const updatePullRequestSettings = async (data: UpdatePullRequestSettings) => {
    const { userId, settings } = data
    const reviewRepos = settings.reviewRepos
        ? Array.from(new Set(settings.reviewRepos.map((r) => r.toLowerCase())))
        : undefined
    const row = await settingRepository.upsertPullRequestSettings(userId, {
        ...settings,
        ...(reviewRepos ? { reviewRepos } : {}),
    })
    return toPullRequestSettings(row)
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
    updateSupportAccess,
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
}
