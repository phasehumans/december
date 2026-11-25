export type AuditAction =
    | 'member.invited'
    | 'member.invite_revoked'
    | 'member.joined'
    | 'member.role_changed'
    | 'member.removed'
    | 'member.left'
    | 'auth.sign_in'
    | 'secret.created'
    | 'secret.updated'
    | 'secret.deleted'
    | 'key.created'
    | 'key.deleted'
    | 'billing.top_up'
    | 'billing.limits_changed'

export type AuditMetadata = Record<string, string | number | boolean | null>

export type RecordAuditEvent = {
    teamId: string
    actorId?: string | null
    action: AuditAction
    /** who or what the action was done to: an email, a secret name, a provider */
    target?: string | null
    ip?: string | null
    metadata?: AuditMetadata
}

/** an event on the own team of the user who did it (sign-in, secret, key, billing) */
export type RecordUserAuditEvent = Omit<RecordAuditEvent, 'teamId' | 'actorId'> & {
    userId: string
}

/** a sign-in of a user, with the way they signed in */
export type RecordSignIn = {
    userId: string
    method: string
    ip?: string | null
}

export type AuditFilter = {
    action?: string
    actorId?: string
    from?: Date
    to?: Date
}

/** the events of one team that one reader may see */
export type AuditScope = {
    teamId: string
    /** the user who reads: personal events are shown only to the user who did them */
    viewerId: string
    filter: AuditFilter
}

export type FindAuditEvents = AuditScope & {
    skip: number
    take: number
}

export type CreateAuditEvent = {
    teamId: string
    actorId: string | null
    action: string
    target: string | null
    ip: string | null
    metadata?: AuditMetadata
}

export type AuditEventRow = {
    id: string
    action: string
    target: string | null
    ip: string | null
    metadata: unknown
    createdAt: Date
    actor: { id: string; name: string; email: string } | null
}
