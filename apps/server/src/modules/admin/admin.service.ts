import { enqueueJob } from '@december/shared/queue'

import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { admintotpService } from '../admintotp/admintotp.service'
import { describeUserAgent } from '../auth/auth.utils'
import { FREE_CREDITS_IN_CENTS } from '../billing/billing.utils'
import { emailService } from '../email/email.service'
import { notificationService } from '../notification/notification.service'

import { adminRepository } from './admin.repository'
import {
    buildUnsubscribeUrl,
    getAdminLimits,
    getAdminPath,
    getSignupMethod,
    isDisposableEmail,
    personalize,
} from './admin.utils'

import type {
    AdjustCredits,
    GetAdminMe,
    GetUser,
    ListCreditLedger,
    ListProductEmailUsers,
    ListUsers,
    RejectCreditRequest,
    ReviewCreditRequest,
    SandboxAction,
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

/**
 * L5: tells every admin about a sensitive action in their December inbox (no email). A
 * failed inbox item never blocks the action.
 */
const alertAdmins = async (data: { title: string; message: string }) => {
    const { title, message } = data
    await notificationService.sendNotificationToAdmins({
        title,
        message,
        type: 'WARNING',
        link: `${getAdminPath()}#system`,
    })
}

/**
 * An admin action that the user hears about (a mail or an inbox item) is also an item in
 * every admin's December inbox, so the admins see what happened. Admins get no email for
 * admin work. A failed item never blocks the action.
 */
const tellAdmins = async (data: {
    title: string
    message: string
    type: 'INFO' | 'SUCCESS' | 'WARNING'
}) => {
    const { title, message, type } = data
    try {
        await notificationService.sendNotificationToAdmins({
            title,
            message,
            type,
            link: `${getAdminPath()}#users`,
        })
    } catch (err) {
        console.error('[admin] admin inbox item failed:', err)
    }
}

const dollars = (cents: number) => `$${(Math.abs(cents) / 100).toFixed(2)}`

const getMe = async (data: GetAdminMe) => {
    const { adminUserId, sessionId } = data
    const [admin, totp] = await Promise.all([
        adminRepository.findAdminUser(adminUserId),
        admintotpService.getStatus({ userId: adminUserId, sessionId }),
    ])
    return {
        id: adminUserId,
        email: admin?.email,
        name: admin?.name,
        adminPath: getAdminPath(),
        totp,
    }
}

// a1

type SignalUser = {
    id: string
    createdAt: Date
    githubId: string | null
    googleId: string | null
    githubUsername: string | null
}

/** M1: what helps decide on a free credit request, shown on the Asked for credits view. */
const requestSignals = async (
    request: { id: string; ipAddress: string | null; normalizedEmail: string },
    user: SignalUser
) => {
    const [otherRequestsSameIp, otherAccountsSameInbox] = await Promise.all([
        request.ipAddress
            ? adminRepository.countRequestsFromIp(request.ipAddress, request.id)
            : Promise.resolve(0),
        adminRepository.countAccountsForNormalizedEmail(request.normalizedEmail, user.id),
    ])
    return {
        accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / DAY_MS),
        signupMethod: getSignupMethod(user),
        githubUsername: user.githubUsername,
        otherAccountsSameInbox,
        otherRequestsSameIp,
    }
}

const approveCreditRequest = async (data: ReviewCreditRequest) => {
    const { adminUserId, requestId } = data
    const limits = getAdminLimits()
    const result = await adminRepository.approveCreditRequest({
        requestId,
        adminUserId,
        amountInCents: FREE_CREDITS_IN_CENTS,
        dailyCapCents: limits.dailyCreditCents,
        userDailyCapCents: limits.userDailyCreditCents,
    })
    if (result && 'overCap' in result) {
        const left = Math.max(0, result.capCents - result.usedCents)
        const scope = result.overCap === 'user' ? 'for this user' : 'for credits you give'
        throw new AppError(
            `Over the 24-hour limit ${scope}. ${dollars(left)} left of ${dollars(result.capCents)}`,
            400
        )
    }
    if (!result) {
        const existing = await adminRepository.findCreditRequest(requestId)
        if (!existing) throw new AppError('credit request not found', 404)
        if (!existing.userId || existing.user?.isDeleted) {
            throw new AppError('the account for this request was deleted', 409)
        }
        throw new AppError(`this request is already ${existing.status.toLowerCase()}`, 409)
    }

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
    // the user gets the mail; the admins get an inbox item, never a mail
    await tellAdmins({
        title: `Free credits approved: ${amount}`,
        message: `${result.user.email} got ${amount} in free credits.`,
        type: 'SUCCESS',
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

    // N1: the user hears back in their inbox, with the reason (no email)
    const request = await adminRepository.findCreditRequest(requestId)
    await tellAdmins({
        title: 'Free credit request declined',
        message: `${request?.user?.email ?? request?.normalizedEmail ?? requestId}: ${reason}`,
        type: 'INFO',
    })
    if (request?.userId && !request.user?.isDeleted) {
        try {
            await notificationService.sendNotificationToUser({
                userId: request.userId,
                title: 'Free credit request declined',
                message: reason,
                type: 'WARNING',
                link: '/settings/billing',
            })
        } catch (err) {
            console.error('[admin] decline notification failed:', err)
        }
    }
    return { id: requestId, status: 'REJECTED' }
}

// a3 and a5

/**
 * The Users tab: newest signups first, a page at a time, with the last time each user did
 * something and their wallet balance. Search matches the name or the email.
 */
const listUsers = async (data: ListUsers) => {
    const { q, page, pageSize, filter } = data
    const [rows, total] = await adminRepository.listUsersPage({ q, page, pageSize, filter })
    const ids = rows.map((row) => row.id)
    const [lastActive, pending, feedback] = await Promise.all([
        adminRepository.findLastActive(ids),
        adminRepository.findPendingRequests(ids),
        adminRepository.findLatestFeedback(ids),
    ])
    const requests = new Map(
        await Promise.all(
            pending.map(
                async (request) =>
                    [
                        request.userId as string,
                        {
                            id: request.id,
                            buildPlan: request.buildPlan,
                            heardFrom: request.heardFrom,
                            createdAt: request.createdAt,
                            signals: await requestSignals(
                                request,
                                rows.find((row) => row.id === request.userId)!
                            ),
                        },
                    ] as const
            )
        )
    )
    const latestFeedback = new Map(feedback.map((row) => [row.userId, row]))
    return {
        page,
        pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / pageSize)),
        items: rows.map((row) => ({
            id: row.id,
            name: row.name,
            email: row.email,
            createdAt: row.createdAt,
            lastActiveAt: lastActive.get(row.id) ?? null,
            creditBalance: row.creditBalance,
            disposable: isDisposableEmail(row.email),
            pendingRequest: requests.get(row.id) ?? null,
            latestFeedback: latestFeedback.has(row.id)
                ? {
                      feedback: latestFeedback.get(row.id)!.feedback,
                      rating: latestFeedback.get(row.id)!.rating,
                      createdAt: latestFeedback.get(row.id)!.createdAt,
                  }
                : null,
        })),
    }
}

/** U1 + D1-D11: the details card of one user. Read only. */
const getUser = async (data: GetUser) => {
    const { userId } = data
    const [details, lastActive] = await Promise.all([
        adminRepository.findUserDetails(userId),
        adminRepository.findLastActive([userId]),
    ])
    if (!details) throw new AppError('user not found', 404)
    const { user, usage, walletSums } = details
    const gitlab = user.gitConnections.find((row) => row.provider === 'GITLAB')
    const sumOf = (providers: string[]) =>
        walletSums
            .filter((row) => providers.includes(row.provider))
            .reduce((total, row) => total + Math.max(0, row._sum.amountInCents ?? 0), 0)

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        disposable: isDisposableEmail(user.email),
        createdAt: user.createdAt,
        lastActiveAt: lastActive.get(user.id) ?? null,
        account: {
            signupMethod: getSignupMethod(user),
            googleLinked: Boolean(user.googleId),
            emailVerified: user.emailVerified,
            onboarding: user.onboardingCompletedAt
                ? 'done'
                : (user.onboardingStep ?? 'not started'),
            onboardingDoneAt: user.onboardingCompletedAt,
            timezone: user.timezone,
            notifyLevel: user.notifyLevel,
            notifyPush: user.notifyPush,
            productEmails: user.notifyProductUpdates,
            securityAlerts: user.notifySecurityAlerts,
        },
        defaults: {
            modelSource: user.defaultModelSource,
            planFirst: user.defaultPlanFirst,
            openPullRequest: user.defaultOpenPullRequest,
            idleStopMinutes: user.idleStopMinutes,
            archiveAfterDays: user.archiveAfterDays,
            lowBalanceAlertCents: user.lowBalanceAlertCents,
            sessionLimitCents: user.sessionLimitCents,
            dayLimitCents: user.dayLimitCents,
            blockedTools: user.toolDenyRules.length,
        },
        connected: {
            github: user.githubConnected
                ? {
                      username: user.githubUsername,
                      appInstalled: user.githubAppInstall,
                      installations: user._count.githubInstallations,
                  }
                : null,
            gitlab: gitlab ? { username: gitlab.username } : null,
            ownKeys: user.providerCredentials.map((row) => ({
                provider: row.provider,
                model: row.defaultModel,
                verifiedAt: row.verifiedAt,
                lastUsedAt: row.lastUsedAt,
            })),
            skills: user._count.skills,
            mcpServers: user._count.mcpServers,
            secrets: user._count.secrets,
            projects: user._count.projects,
            pushBrowsers: user._count.pushSubscriptions,
        },
        devices: details.devices.map((row) => ({
            ...describeUserAgent(row.userAgent),
            signedInAt: row.createdAt,
            lastActiveAt: row.updatedAt,
        })),
        usage: {
            spentCents: Math.round(usage.spentCents),
            spent30Cents: Math.round(usage.spent30Cents),
            spentDayCents: Math.round(usage.spentDayCents),
            calls: usage.calls,
            tokens: usage.tokens,
            cliCalls: usage.cliCalls,
            ownKeyCalls: usage.ownKeyCalls,
            firstAt: usage.firstAt,
            lastAt: usage.lastAt,
            topModels: usage.topModels.map((row) => ({ ...row, cents: Math.round(row.cents) })),
            daily: usage.daily.map((row) => ({ day: row.day, cents: Math.round(row.cents) })),
        },
        sessions: details.sessions,
        prs: details.prs,
        money: {
            balanceCents: user.creditBalance,
            paidCents: sumOf(['RAZORPAY', 'COINBASE']),
            freeCents: sumOf(['GRANT', 'ADJUSTMENT', 'REFERRAL']),
            failedPayments: details.failedPayments,
            wallet: details.wallet,
        },
        referral: {
            code: user.referralCode,
            invitedBy: user.referredBy?.inviter.email ?? null,
            invited: user.referralsMade.map((row) => ({
                email: row.invitee.email,
                status: row.status,
                createdAt: row.createdAt,
            })),
        },
        creditRequest: details.creditRequest,
        feedback: { total: user._count.feedbacks, items: details.feedback },
        adminHistory: details.adminHistory.map((row) => ({
            id: row.id,
            action: row.action,
            amountInCents:
                row.metadata && typeof row.metadata === 'object' && 'amountInCents' in row.metadata
                    ? Number((row.metadata as { amountInCents: unknown }).amountInCents)
                    : null,
            createdAt: row.createdAt,
        })),
    }
}

const adjustCredits = async (data: AdjustCredits) => {
    const { adminUserId, userId, amountInCents } = data
    const limits = getAdminLimits()
    const result = await adminRepository.adjustCredits({
        userId,
        amountInCents,
        adminUserId,
        dailyCapCents: limits.dailyCreditCents,
        userDailyCapCents: limits.userDailyCreditCents,
    })
    if (result === undefined) throw new AppError('user not found', 404)
    if (result === null) throw new AppError('the balance cannot go below $0', 400)
    if ('overCap' in result) {
        const left = Math.max(0, result.capCents - result.usedCents)
        const scope = result.overCap === 'user' ? 'for this user' : 'for credits you give'
        throw new AppError(
            `Over the 24-hour limit ${scope}. ${dollars(left)} left of ${dollars(result.capCents)}`,
            400
        )
    }

    const user = await adminRepository.findAdminUser(userId)
    const amount = dollars(amountInCents)
    // C1: the user sees it in their December inbox (a toast if they are online)
    try {
        await notificationService.sendNotificationToUser({
            userId,
            title: 'Credits added',
            message: `${amount} is in your wallet.`,
            type: 'SUCCESS',
            link: '/settings/billing',
            toast: true,
        })
    } catch (err) {
        console.error('[admin] credits notification failed:', err)
    }
    // C2: and an email, even with product emails off: it is about their own wallet
    if (user?.email) {
        await emailService.sendMessageEmail({
            to: user.email,
            subject: `you got ${amount} in december credits`,
            body: `hi ${personalize('{name}', user.name)},\n\nwe added ${amount} to your december wallet. start a task here: ${appUrl()}\n\nreply to this email if you have any questions.`,
        })
    }

    // B11: every hand-added credit shows in the admin inbox, so many small ones can't hide
    await alertAdmins({
        title: `Credits added: ${amount}`,
        message: `Added ${amount} to ${user?.email ?? userId}. If this was not you, sign out of every device.`,
    })
    return result
}

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

const listCreditLedger = async (data: ListCreditLedger) => {
    const { adminUserId, limit } = data
    const limits = getAdminLimits()
    const [rows, usedCents] = await Promise.all([
        adminRepository.listCreditLedger(limit),
        adminRepository.sumAdminCreditsSince({
            since: new Date(Date.now() - DAY_MS),
            adminUserId,
        }),
    ])
    return {
        cap: {
            usedCents,
            capCents: limits.dailyCreditCents,
            userCapCents: limits.userDailyCreditCents,
        },
        items: rows.map((row) => {
            const metadata = (row.metadata ?? {}) as Record<string, unknown>
            return {
                id: row.id,
                amountInCents: row.amountInCents,
                kind: row.provider === 'GRANT' ? 'free credits' : 'by hand',
                reason: typeof metadata.reason === 'string' ? metadata.reason : null,
                createdAt: row.createdAt,
                // null when the 90-day purge deleted the account; the row stays
                userId: row.user?.id ?? null,
                email: row.user?.email ?? null,
            }
        }),
    }
}

/**
 * A5 + E6: the people who said yes to product emails (live, verified accounts), one line each
 * as "name, email, turn-off link" for scripts/users.txt. Every copy is in the audit log.
 */
const listProductEmailUsers = async (data: ListProductEmailUsers) => {
    const { adminUserId } = data
    const users = await adminRepository.findProductEmailUsers()
    await audit({
        adminUserId,
        action: 'users.product_email_list',
        targetType: 'users',
        metadata: { count: users.length },
    })
    // a comma in a name would split the line in announce.py
    const lines = users.map((user) =>
        [
            (user.name ?? '').replace(/[,\s]+/g, ' ').trim() || 'there',
            user.email,
            buildUnsubscribeUrl(user.id),
        ].join(', ')
    )
    return { count: users.length, text: lines.join('\n') }
}

export const adminService = {
    listProductEmailUsers,
    getMe,
    approveCreditRequest,
    rejectCreditRequest,
    listUsers,
    getUser,
    adjustCredits,
    listCreditLedger,
    listSandboxes,
    controlSandbox,
}
