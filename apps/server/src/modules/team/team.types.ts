import type { AuditFilter } from '../audit/audit.types'

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER'

/** an invite never makes an owner */
export type InviteRole = 'ADMIN' | 'MEMBER'

export type TeamRecord = {
    id: string
    name: string
    ownerId: string
    createdAt: Date
}

export type EnsureTeam = {
    userId: string
}

/** teamId is empty for the user's own team */
export type TeamScope = {
    userId: string
    teamId?: string
}

export type GetTeam = TeamScope

export type TeamMemberView = {
    userId: string
    name: string
    email: string
    role: TeamRole
    joinedAt: Date
}

export type TeamInviteView = {
    id: string
    email: string
    role: TeamRole
    invitedBy: string
    expiresAt: Date
    createdAt: Date
}

export type MemberOfView = {
    teamId: string
    name: string
    ownerName: string
    role: TeamRole
}

export type CreateInvite = TeamScope & {
    email: string
    role: InviteRole
    ip?: string
}

export type RevokeInvite = TeamScope & {
    inviteId: string
    ip?: string
}

export type PreviewInvite = {
    token: string
    /** the signed-in user that reads the invite page, when there is one */
    viewerId?: string
}

export type InvitePreview = {
    teamName: string
    inviterName: string
    role: TeamRole
    /** masked: the page is open to anyone with the link */
    email: string
    expired: boolean
    /** only for a signed-in reader: is the invite for the email of this account */
    emailMatches?: boolean
}

export type AcceptInvite = {
    userId: string
    token: string
    ip?: string
}

export type ChangeMemberRole = TeamScope & {
    memberUserId: string
    role: InviteRole
    ip?: string
}

export type RemoveMember = TeamScope & {
    memberUserId: string
    ip?: string
}

export type ListAuditEvents = TeamScope &
    AuditFilter & {
        page: number
        limit: number
    }

export type ExportAuditEvents = TeamScope & AuditFilter

export type MemberRow = {
    userId: string
    role: TeamRole
    createdAt: Date
    user: { name: string; email: string }
}
