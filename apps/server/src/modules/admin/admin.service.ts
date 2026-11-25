import crypto from 'crypto'

import { enqueueJob } from '@december/shared/queue'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { FREE_CREDITS_IN_CENTS } from '../billing/billing.utils'
import { emailService } from '../email/email.service'
import { notificationService } from '../notification/notification.service'

import { adminRepository } from './admin.repository'
import { buildUnsubscribeUrl, getSignupMethod, isDisposableEmail, personalize } from './admin.utils'

import type {
    AdjustCredits,
    AssertSupportAccess,
    AssignInstallation,
    CreateRedeemCode,
    DailyUsage,
    GetAdminMe,
    GetUsageByUser,
    GetUser,
    ListAuditLog,
    ListCreditRequests,
    ListFeedback,
    ListUsers,
    ListUserSessions,
    OpenUserSession,
    RejectCreditRequest,
    RestoreUser,
    ReviewCreditRequest,
    SandboxAction,
    SendAnnouncement,
    SendTestAnnouncement,
    ToUserRow,
    UserUsage,
    WriteAuditLog,
} from './admin.types'

const DAY_MS = 24 * 60 * 60 * 1000

const appUrl = () => (env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')

const audit = async (data: WriteAuditLog) => {
    const { adminUserId, action, targetType, targetId, metadata } = data
    await adminRepository.writeAuditLog({
        adminUserId,
        action,
        targetType,
        targetId: targetId ?? null,
        metadata: (metadata ?? {}) as any,
    })
}

const getMe = async (data: GetAdminMe) => {
    const { adminUserId } = data
    const admin = await adminRepository.findAdminUser(adminUserId)
    return { id: adminUserId, email: admin?.email, name: admin?.name }
}

// a1

const listCreditRequests = async (data: ListCreditRequests) => {
    const { status, limit } = data
    const requests = await adminRepository.listCreditRequests({ status, limit })

    const items = await Promise.all(
        requests.map(async (request) => {
            const [sameIpRequests, sameInboxAccounts] = await Promise.all([
                request.ipAddress
                    ? adminRepository.countRequestsFromIp(request.ipAddress, request.id)
                    : Promise.resolve(0),
                adminRepository.countAccountsForNormalizedEmail(
                    request.normalizedEmail,
                    request.userId ?? undefined
                ),
            ])
            const user = request.user
            return {
                id: request.id,
                status: request.status,
                createdAt: request.createdAt,
                reviewedAt: request.reviewedAt,
                rejectReason: request.rejectReason,
                buildPlan: request.buildPlan,
                heardFrom: request.heardFrom,
                agreedToFeedback: request.agreedToFeedback,
                normalizedEmail: request.normalizedEmail,
                userId: request.userId,
                email: user?.email ?? null,
                name: user?.name ?? null,
                signals: {
                    accountAgeDays: user
                        ? Math.floor((Date.now() - user.createdAt.getTime()) / DAY_MS)
                        : null,
                    signupMethod: user ? getSignupMethod(user) : null,
                    githubUsername: user?.githubUsername ?? null,
                    disposableEmail: user ? isDisposableEmail(user.email) : false,
                    accountDeleted: user?.isDeleted ?? true,
                    otherAccountsSameInbox: sameInboxAccounts,
                    otherRequestsSameIp: sameIpRequests,
                    feedbackCount: user?._count.feedbacks ?? 0,
                    ipAddress: request.ipAddress,
                    userAgent: request.userAgent,
                },
            }
        })
    )

    return { items }
}

const approveCreditRequest = async (data: ReviewCreditRequest) => {
    const { adminUserId, requestId } = data
    const result = await adminRepository.approveCreditRequest({
        requestId,
        adminUserId,
        amountInCents: FREE_CREDITS_IN_CENTS,
    })
    if (!result) {
        const existing = await adminRepository.findCreditRequest(requestId)
        if (!existing) throw new AppError('credit request not found', 404)
        if (!existing.userId) throw new AppError('the account for this request was deleted', 409)
        throw new AppError(`this request is already ${existing.status.toLowerCase()}`, 409)
    }

    await audit({
        adminUserId,
        action: 'credit_request.approve',
        targetType: 'credit_request',
        targetId: requestId,
        metadata: { userId: result.user.id, amountInCents: FREE_CREDITS_IN_CENTS },
    })

    const amount = `$${(FREE_CREDITS_IN_CENTS / 100).toFixed(2)}`
    try {
        await notificationService.sendNotificationToUser({
            userId: result.user.id,
            title: 'Free credits added',
            message: `${amount} in free credits is in your wallet.`,
            type: 'SUCCESS',
            link: '/settings/billing',
            toast: true,
        })
    } catch (err) {
        console.error('[admin] approval notification failed:', err)
    }
    await emailService.sendMessageEmail({
        to: result.user.email,
        subject: 'your free december credits are ready',
        body: `hi ${personalize('{name}', result.user.name)},\n\nwe added ${amount} in free credits to your december wallet. start a task here: ${appUrl()}\n\nwe would love your feedback when you have tried it: just reply to this email.`,
    })

    return { id: requestId, status: 'APPROVED', creditBalance: result.user.creditBalance }
}

const rejectCreditRequest = async (data: RejectCreditRequest) => {
    const { adminUserId, requestId, reason } = data
    const updated = await adminRepository.rejectCreditRequest({ requestId, adminUserId, reason })
    if (updated === 0) {
        const existing = await adminRepository.findCreditRequest(requestId)
        if (!existing) throw new AppError('credit request not found', 404)
        throw new AppError(`this request is already ${existing.status.toLowerCase()}`, 409)
    }

    await audit({
        adminUserId,
        action: 'credit_request.reject',
        targetType: 'credit_request',
        targetId: requestId,
        metadata: { reason },
    })
    return { id: requestId, status: 'REJECTED' }
}

// a2

const listFeedback = async (data: ListFeedback) => {
    const { userId, limit } = data
    const rows = await adminRepository.listFeedback({ userId, limit })
    return {
        items: rows.map((row) => ({
            id: row.id,
            rating: row.rating,
            feedback: row.feedback,
            createdAt: row.createdAt,
            userId: row.userId,
            email: row.user.email,
            name: row.user.name,
            creditRequestStatus: row.user.creditRequests[0]?.status ?? null,
        })),
    }
}

// a3 and a5

const toUserRow = (data: ToUserRow) => {
    const { user, usage } = data
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / DAY_MS),
        signupMethod: getSignupMethod(user),
        githubUsername: user.githubUsername,
        creditBalance: user.creditBalance,
        defaultModelSource: user.defaultModelSource,
        ownKeys: user._count.providerCredentials,
        sessions: user._count.sessions,
        isDeleted: user.isDeleted,
        deletedAt: user.deletedAt,
        usage: usage.get(user.id) ?? { creditsCents: 0, ownKeyCents: 0 },
    }
}

const getUsageByUser = async (data: GetUsageByUser) => {
    const { userIds } = data
    const groups = await adminRepository.sumUsageByUser(userIds)
    const map = new Map<string, UserUsage>()
    for (const group of groups) {
        const entry = map.get(group.userId) ?? { creditsCents: 0, ownKeyCents: 0 }
        const cents = group._sum.costInCents ?? 0
        if (group.billingSource === 'OWN_KEY') entry.ownKeyCents += cents
        else entry.creditsCents += cents
        map.set(group.userId, entry)
    }
    return map
}

const listUsers = async (data: ListUsers) => {
    const { q, limit } = data
    const users = await adminRepository.searchUsers({ q, limit })
    const usage = await getUsageByUser({ userIds: users.map((user) => user.id) })
    return { items: users.map((user) => toUserRow({ user, usage })) }
}

const getUser = async (data: GetUser) => {
    const { userId } = data
    const user = await adminRepository.findUserDetail(userId)
    if (!user) throw new AppError('user not found', 404)
    const usage = await getUsageByUser({ userIds: [userId] })
    return {
        ...toUserRow({ user, usage }),
        notifyProductUpdates: user.notifyProductUpdates,
        supportAccessUntil: user.supportAccessUntil,
        githubAppInstall: user.githubAppInstall,
        onboardingCompletedAt: user.onboardingCompletedAt,
        providerCredentials: user.providerCredentials,
        walletTransactions: user.walletTransactions,
        creditRequests: user.creditRequests,
        unsubscribeUrl: buildUnsubscribeUrl(userId),
    }
}

// support access (#636)

// the user turns this on from the account page; it ends 7 days later
const assertSupportAccess = async (data: AssertSupportAccess) => {
    const { userId } = data
    const user = await adminRepository.findSupportAccess(userId)
    if (!user) throw new AppError('user not found', 404)
    if (!user.supportAccessUntil || user.supportAccessUntil.getTime() <= Date.now()) {
        throw new AppError('this user has not turned on support access', 403)
    }
    return user.supportAccessUntil
}

// the list shows the titles of the user's sessions, so it is logged too: who looked at
// which user's list, and when (the log row's date)
const listUserSessions = async (data: ListUserSessions) => {
    const { adminUserId, userId } = data
    const supportAccessUntil = await assertSupportAccess({ userId })
    const items = await adminRepository.listUserSessions(userId)

    await audit({
        adminUserId,
        action: 'support.session.list',
        targetType: 'user',
        targetId: userId,
        metadata: { sessions: items.length },
    })
    return { supportAccessUntil, items }
}

// every open is logged: who opened which session, and when (the log row's date)
const openUserSession = async (data: OpenUserSession) => {
    const { adminUserId, userId, sessionId } = data
    await assertSupportAccess({ userId })
    const session = await adminRepository.findUserSessionWithMessages({ userId, sessionId })
    if (!session) throw new AppError('session not found', 404)

    await audit({
        adminUserId,
        action: 'support.session.open',
        targetType: 'session',
        targetId: sessionId,
        metadata: { userId },
    })
    return session
}

const adjustCredits = async (data: AdjustCredits) => {
    const { adminUserId, userId, amountInCents, reason } = data
    const result = await adminRepository.adjustCredits({
        userId,
        amountInCents,
        reason,
        adminUserId,
    })
    if (result === undefined) throw new AppError('user not found', 404)
    if (result === null) throw new AppError('the balance cannot go below $0', 400)

    await audit({
        adminUserId,
        action: 'credits.adjust',
        targetType: 'user',
        targetId: userId,
        metadata: { amountInCents, reason },
    })
    return result
}

const restoreUser = async (data: RestoreUser) => {
    const { adminUserId, userId } = data
    const restored = await adminRepository.restoreUser(userId)
    if (restored.count === 0) throw new AppError('no deleted account with this id', 404)

    await audit({ adminUserId, action: 'user.restore', targetType: 'user', targetId: userId })
    return { id: userId, isDeleted: false }
}

// a4

const listRedeemCodes = async () => {
    const codes = await adminRepository.listRedeemCodes()
    return {
        items: codes.map((code) => ({
            id: code.id,
            code: (code.metadata as any)?.code ?? null,
            amountInCents: code.creditAmount,
            maxRedemptions: code.maxRedemptions,
            redemptionCount: code.redemptionCount,
            expiresAt: code.expiresAt,
            createdAt: code.createdAt,
            claims: code.claims.map((claim) => ({
                userId: claim.userId,
                email: claim.user.email,
                redeemedAt: claim.redeemedAt,
            })),
        })),
    }
}

const createRedeemCode = async (data: CreateRedeemCode) => {
    const { adminUserId, code, amountInCents, maxRedemptions, expiresAt } = data
    // same normalization as billingService.redeemCode
    const finalCode = (code ?? crypto.randomBytes(6).toString('hex')).trim().toUpperCase()
    const codeHash = crypto.createHash('sha256').update(finalCode).digest('hex')
    if (await adminRepository.findRedeemCodeByHash(codeHash)) {
        throw new AppError('this code already exists', 409)
    }

    const created = await adminRepository.createRedeemCode({
        codeHash,
        code: finalCode,
        creditAmount: amountInCents,
        maxRedemptions,
        expiresAt,
        adminUserId,
    })
    await audit({
        adminUserId,
        action: 'redeem_code.create',
        targetType: 'redeem_code',
        targetId: created.id,
        metadata: { code: finalCode, amountInCents, maxRedemptions, expiresAt },
    })
    return {
        id: created.id,
        code: finalCode,
        amountInCents,
        maxRedemptions: created.maxRedemptions,
        expiresAt: created.expiresAt,
    }
}

// a6

const listInstallations = async () => {
    const rows = await adminRepository.listInstallations()
    return {
        items: rows.map((row) => ({
            id: row.id,
            installationId: row.installationId,
            accountLogin: row.accountLogin,
            accountType: row.accountType,
            createdAt: row.createdAt,
            userId: row.userId,
            email: row.user?.email ?? null,
            githubUsername: row.user?.githubUsername ?? null,
        })),
    }
}

const assignInstallation = async (data: AssignInstallation) => {
    const { adminUserId, installationId, userId } = data
    const result = await adminRepository.assignInstallation({ installationId, userId })
    if (!result) throw new AppError('installation or user not found', 404)

    await audit({
        adminUserId,
        action: 'github_installation.assign',
        targetType: 'github_installation',
        targetId: installationId,
        metadata: { userId, previousUserId: result.previousUserId },
    })
    return { id: installationId, userId }
}

// a7 and a8

const sendTestAnnouncement = async (data: SendTestAnnouncement) => {
    const { adminUserId, subject, body } = data
    const admin = await adminRepository.findAdminUser(adminUserId)
    if (!admin) throw new AppError('admin not found', 404)

    await emailService.sendMessageEmail({
        to: admin.email,
        subject: `[test] ${subject}`.slice(0, 200),
        body: personalize(body, admin.name),
        footerLinks: [{ label: 'Unsubscribe', url: buildUnsubscribeUrl(adminUserId) }],
    })
    await audit({
        adminUserId,
        action: 'announcement.test',
        targetType: 'announcement',
        metadata: { subject },
    })
    return { sentTo: admin.email }
}

const sendAnnouncement = async (data: SendAnnouncement) => {
    const { adminUserId, kind, subject, body, signedUpDaysAgo } = data

    // feedback requests go to users who signed up that day (n days ago)
    let signedUpFrom: Date | undefined
    let signedUpTo: Date | undefined
    if (kind === 'FEEDBACK_REQUEST' && signedUpDaysAgo !== undefined) {
        const today = new Date()
        today.setUTCHours(0, 0, 0, 0)
        signedUpFrom = new Date(today.getTime() - signedUpDaysAgo * DAY_MS)
        signedUpTo = new Date(signedUpFrom.getTime() + DAY_MS)
    }

    const audience = await adminRepository.findAnnouncementAudience({ signedUpFrom, signedUpTo })
    const recipients = audience.filter((user) => user.notifyProductUpdates)
    const skippedCount = audience.length - recipients.length

    // only emails that reached the queue count as sent
    let sentCount = 0
    for (const user of recipients) {
        const queued = await emailService.sendMessageEmail({
            to: user.email,
            subject,
            body: personalize(body, user.name),
            footerLinks: [{ label: 'Unsubscribe', url: buildUnsubscribeUrl(user.id) }],
        })
        if (queued) sentCount++
    }
    const failedCount = recipients.length - sentCount

    const announcement = await adminRepository.createAnnouncement({
        kind,
        subject,
        body,
        signedUpDaysAgo: signedUpDaysAgo ?? null,
        createdBy: adminUserId,
        recipientCount: sentCount,
        skippedCount,
        sentAt: new Date(),
    })
    await audit({
        adminUserId,
        action: 'announcement.send',
        targetType: 'announcement',
        targetId: announcement.id,
        metadata: { kind, subject, recipientCount: sentCount, skippedCount, failedCount },
    })
    return announcement
}

const listAnnouncements = async () => ({ items: await adminRepository.listAnnouncements() })

// a9

const listSandboxes = async () => {
    const rows = await adminRepository.listSandboxes()
    const perUser = new Map<string, number>()
    for (const row of rows) {
        if (row.sandboxStatus === 'RUNNING' || row.sandboxStatus === 'STARTING') {
            perUser.set(row.user.id, (perUser.get(row.user.id) ?? 0) + 1)
        }
    }
    return {
        items: rows.map((row) => ({
            sessionId: row.id,
            title: row.title,
            sandboxId: row.vmId,
            sandboxStatus: row.sandboxStatus,
            agentWorking: row.vmStatus === 'RUNNING' || row.vmStatus === 'PROVISIONING',
            lastActivityAt: row.vmLastActivityAt,
            createdAt: row.createdAt,
            userId: row.user.id,
            email: row.user.email,
            userRunningCount: perUser.get(row.user.id) ?? 0,
        })),
    }
}

const controlSandbox = async (data: SandboxAction) => {
    const { adminUserId, sessionId, action } = data
    const session = await adminRepository.findSandboxSession(sessionId)
    if (!session?.vmId) throw new AppError('no sandbox for this session', 404)

    // the worker that owns it, or any worker through the E2B api, does the pause or stop
    await enqueueJob('sandbox_control', {
        taskType: 'sandbox_control',
        action,
        sessionId,
        sandboxId: session.vmId,
    })
    await audit({
        adminUserId,
        action: `sandbox.${action}`,
        targetType: 'session',
        targetId: sessionId,
        metadata: { sandboxId: session.vmId, userId: session.userId },
    })
    return { sessionId, action }
}

const dailyUsage = async (data: DailyUsage) => {
    const { days } = data
    const since = new Date(Date.now() - days * DAY_MS)
    const rows = await adminRepository.dailyUsageByModel(since)
    return {
        items: rows.map((row) => ({
            day: row.day,
            model: row.model,
            billingSource: row.billingSource,
            costInCents: Number(row.costInCents),
            events: Number(row.events),
        })),
    }
}

const listAuditLog = async (data: ListAuditLog) => {
    const { limit } = data
    return { items: await adminRepository.listAuditLog(limit) }
}

export const adminService = {
    getMe,
    listCreditRequests,
    approveCreditRequest,
    rejectCreditRequest,
    listFeedback,
    listUsers,
    getUser,
    listUserSessions,
    openUserSession,
    adjustCredits,
    restoreUser,
    listRedeemCodes,
    createRedeemCode,
    listInstallations,
    assignInstallation,
    sendTestAnnouncement,
    sendAnnouncement,
    listAnnouncements,
    listSandboxes,
    controlSandbox,
    dailyUsage,
    listAuditLog,
}
