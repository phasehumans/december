import type { adminRepository } from './admin.repository'

export type AdminContext = {
    adminUserId: string
}

export type GetAdminMe = AdminContext

export type ListCreditRequests = {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
    limit: number
}

export type ReviewCreditRequest = AdminContext & {
    requestId: string
}

export type RejectCreditRequest = ReviewCreditRequest & {
    reason: string
}

export type ListFeedback = {
    userId?: string
    limit: number
}

export type ListUsers = {
    q?: string
    limit: number
}

export type GetUser = {
    userId: string
}

export type ListUserSessions = AdminContext & {
    userId: string
}

export type OpenUserSession = AdminContext & {
    userId: string
    sessionId: string
}

export type AssertSupportAccess = {
    userId: string
}

export type AdjustCredits = AdminContext & {
    userId: string
    amountInCents: number
    reason: string
}

export type RestoreUser = AdminContext & {
    userId: string
}

export type CreateRedeemCode = AdminContext & {
    code?: string
    amountInCents: number
    maxRedemptions?: number
    expiresAt?: Date
}

export type AssignInstallation = AdminContext & {
    installationId: string
    userId: string
}

export type SendTestAnnouncement = AdminContext & {
    subject: string
    body: string
}

export type SendAnnouncement = AdminContext & {
    kind: 'ANNOUNCEMENT' | 'FEEDBACK_REQUEST'
    subject: string
    body: string
    signedUpDaysAgo?: number
}

export type SandboxAction = AdminContext & {
    sessionId: string
    action: 'pause' | 'stop'
}

export type DailyUsage = {
    days: number
}

export type ListAuditLog = {
    limit: number
}

export type WriteAuditLog = AdminContext & {
    action: string
    targetType: string
    targetId?: string | null
    metadata?: Record<string, unknown>
}

export type UserUsage = {
    creditsCents: number
    ownKeyCents: number
}

export type GetUsageByUser = {
    userIds: string[]
}

export type ToUserRow = {
    user: Awaited<ReturnType<typeof adminRepository.searchUsers>>[number]
    usage: Map<string, UserUsage>
}
