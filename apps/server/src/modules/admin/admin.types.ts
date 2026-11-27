export type AdminContext = {
    adminUserId: string
}

export type GetAdminMe = AdminContext & {
    sessionId: string
}

export type ReviewCreditRequest = AdminContext & {
    requestId: string
}

export type RejectCreditRequest = ReviewCreditRequest & {
    reason: string
}

export type UserFilter = 'all' | 'active' | 'asked' | 'feedback'

export type ListUsers = {
    q?: string
    page: number
    pageSize: number
    filter: UserFilter
}

export type GetUser = {
    userId: string
}

export type AdjustCredits = AdminContext & {
    userId: string
    amountInCents: number
}

export type SandboxAction = AdminContext & {
    sessionId: string
    action: 'pause' | 'stop'
}

export type ListCreditLedger = AdminContext & {
    limit: number
}

export type WriteAuditLog = AdminContext & {
    action: string
    targetType: string
    targetId?: string | null
    metadata?: Record<string, unknown>
}

export type ListProductEmailUsers = {
    adminUserId: string
}
