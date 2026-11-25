import { apiRequest } from '@/shared/api/client'

// #624 part 3: the admin page. every route is checked on the server (ADMIN_EMAILS)

export type CreditRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface AdminCreditRequest {
    id: string
    status: CreditRequestStatus
    createdAt: string
    reviewedAt: string | null
    rejectReason: string | null
    buildPlan: string
    heardFrom: string
    normalizedEmail: string
    userId: string | null
    email: string | null
    name: string | null
    signals: {
        accountAgeDays: number | null
        signupMethod: 'github' | 'google' | 'email' | null
        githubUsername: string | null
        disposableEmail: boolean
        accountDeleted: boolean
        otherAccountsSameInbox: number
        otherRequestsSameIp: number
        feedbackCount: number
        ipAddress: string | null
        userAgent: string | null
    }
}

export interface AdminFeedback {
    id: string
    rating: string | null
    feedback: string
    createdAt: string
    userId: string
    email: string
    name: string
    creditRequestStatus: CreditRequestStatus | null
}

export interface AdminUserRow {
    id: string
    name: string
    email: string
    createdAt: string
    accountAgeDays: number
    signupMethod: 'github' | 'google' | 'email'
    githubUsername: string | null
    creditBalance: number
    defaultModelSource: 'CREDITS' | 'OWN_KEY'
    ownKeys: number
    sessions: number
    isDeleted: boolean
    usage: { creditsCents: number; ownKeyCents: number }
}

export interface AdminUserDetail extends AdminUserRow {
    notifyProductUpdates: boolean
    // the user lets support open their sessions until this date (#636)
    supportAccessUntil: string | null
    githubAppInstall: boolean
    providerCredentials: Array<{ provider: string; keyHint: string; verifiedAt: string | null }>
    walletTransactions: Array<{
        id: string
        amountInCents: number
        provider: string
        status: string
        metadata: Record<string, unknown> | null
        createdAt: string
    }>
    creditRequests: Array<{ id: string; status: CreditRequestStatus; createdAt: string }>
}

// support access (#636): the server answers 403 unless the user has it on
export interface AdminUserSession {
    id: string
    title: string | null
    type: string
    status: string
    isArchived: boolean
    githubRepoOwner: string | null
    githubRepoName: string | null
    branch: string | null
    prUrl: string | null
    prState: string | null
    createdAt: string
    updatedAt: string
}

export interface AdminUserSessionDetail extends AdminUserSession {
    messages: Array<{
        id: string
        role: string
        content: string
        status: string | null
        sequence: number
        createdAt: string
    }>
}

export interface AdminRedeemCode {
    id: string
    code: string | null
    amountInCents: number
    maxRedemptions: number | null
    redemptionCount: number
    expiresAt: string | null
    createdAt: string
    claims: Array<{ userId: string; email: string; redeemedAt: string }>
}

export interface AdminInstallation {
    id: string
    installationId: string
    accountLogin: string | null
    accountType: string | null
    createdAt: string
    userId: string | null
    email: string | null
    githubUsername: string | null
}

export interface AdminAnnouncement {
    id: string
    kind: 'ANNOUNCEMENT' | 'FEEDBACK_REQUEST'
    subject: string
    body: string
    signedUpDaysAgo: number | null
    recipientCount: number
    skippedCount: number
    sentAt: string | null
    createdAt: string
}

export interface AdminSandbox {
    sessionId: string
    title: string | null
    sandboxId: string
    sandboxStatus: 'STARTING' | 'RUNNING' | 'PAUSED'
    agentWorking: boolean
    lastActivityAt: string | null
    createdAt: string
    userId: string
    email: string
    userRunningCount: number
}

export interface AdminDailyUsage {
    day: string
    model: string
    billingSource: 'CREDITS' | 'OWN_KEY'
    costInCents: number
    events: number
}

export interface AdminAuditEntry {
    id: string
    adminUserId: string
    action: string
    targetType: string
    targetId: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
}

type Items<T> = { items: T[] }

const post = <T>(path: string, body: object = {}) =>
    apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const adminAPI = {
    getMe: () => apiRequest<{ id: string; email: string }>('/admin/me'),

    listCreditRequests: (status?: CreditRequestStatus) =>
        apiRequest<Items<AdminCreditRequest>>(
            `/admin/credit-requests${status ? `?status=${status}` : ''}`
        ),
    approveCreditRequest: (id: string) => post(`/admin/credit-requests/${id}/approve`),
    rejectCreditRequest: (id: string, reason: string) =>
        post(`/admin/credit-requests/${id}/reject`, { reason }),

    listFeedback: () => apiRequest<Items<AdminFeedback>>('/admin/feedback'),

    listUsers: (q: string) =>
        apiRequest<Items<AdminUserRow>>(`/admin/users?q=${encodeURIComponent(q)}`),
    getUser: (id: string) => apiRequest<AdminUserDetail>(`/admin/users/${id}`),
    adjustCredits: (id: string, amountInCents: number, reason: string) =>
        post(`/admin/users/${id}/credits`, { amountInCents, reason }),
    restoreUser: (id: string) => post(`/admin/users/${id}/restore`),
    listUserSessions: (id: string) =>
        apiRequest<Items<AdminUserSession> & { supportAccessUntil: string }>(
            `/admin/users/${id}/sessions`
        ),
    // each open is written to the audit log on the server
    openUserSession: (id: string, sessionId: string) =>
        apiRequest<AdminUserSessionDetail>(`/admin/users/${id}/sessions/${sessionId}`),

    listRedeemCodes: () => apiRequest<Items<AdminRedeemCode>>('/admin/redeem-codes'),
    createRedeemCode: (data: {
        code?: string
        amountInCents: number
        maxRedemptions?: number
        expiresAt?: string
    }) => post<{ code: string }>('/admin/redeem-codes', data),

    listInstallations: () => apiRequest<Items<AdminInstallation>>('/admin/github-installations'),
    assignInstallation: (id: string, userId: string) =>
        post(`/admin/github-installations/${id}/assign`, { userId }),

    listAnnouncements: () => apiRequest<Items<AdminAnnouncement>>('/admin/announcements'),
    sendTestAnnouncement: (subject: string, body: string) =>
        post<{ sentTo: string }>('/admin/announcements/test', { subject, body }),
    sendAnnouncement: (data: {
        kind: 'ANNOUNCEMENT' | 'FEEDBACK_REQUEST'
        subject: string
        body: string
        signedUpDaysAgo?: number
    }) => post<AdminAnnouncement>('/admin/announcements/send', data),

    listSandboxes: () => apiRequest<Items<AdminSandbox>>('/admin/sandboxes'),
    controlSandbox: (sessionId: string, action: 'pause' | 'stop') =>
        post(`/admin/sandboxes/${sessionId}/${action}`),
    dailyUsage: (days: number) =>
        apiRequest<Items<AdminDailyUsage>>(`/admin/usage/daily?days=${days}`),

    listAuditLog: () => apiRequest<Items<AdminAuditEntry>>('/admin/audit-log'),
}
