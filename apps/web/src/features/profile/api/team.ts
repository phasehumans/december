import { API_BASE_URL, apiRequest } from '@/shared/api/client'

// team accounts, the base (#640): members, invites, roles and the audit log. every call is
// about the user's own team; teamId names another team the user is in.

export type TeamRole = 'OWNER' | 'ADMIN' | 'MEMBER'
export type InviteRole = 'ADMIN' | 'MEMBER'

export type TeamMember = {
    userId: string
    name: string
    email: string
    role: TeamRole
    joinedAt: string
}

export type TeamInvite = {
    id: string
    email: string
    role: TeamRole
    invitedBy: string
    expiresAt: string
    createdAt: string
}

/** a team of another person that the user joined */
export type JoinedTeam = {
    teamId: string
    name: string
    ownerName: string
    role: TeamRole
}

export type Team = {
    team: { id: string; name: string; createdAt: string }
    role: TeamRole
    members: TeamMember[]
    invites: TeamInvite[]
    memberOf: JoinedTeam[]
}

/** what the invite page shows. the email is masked */
export type InvitePreview = {
    teamName: string
    inviterName: string
    role: TeamRole
    email: string
    expired: boolean
    /** only for a signed-in reader: is the invite for the email of this account */
    emailMatches?: boolean
}

export type AuditEvent = {
    id: string
    action: string
    target: string | null
    ip: string | null
    metadata: Record<string, string | number | boolean | null> | null
    createdAt: string
    actor: { id: string; name: string; email: string } | null
}

export type AuditPage = {
    events: AuditEvent[]
    pagination: { total: number; page: number; limit: number; totalPages: number }
}

const scope = (teamId?: string) => (teamId ? `?teamId=${encodeURIComponent(teamId)}` : '')

const getTeam = () => apiRequest<Team>('/team')

const invite = (data: { email: string; role: InviteRole }) =>
    apiRequest<{ invite: TeamInvite }>('/team/invites', {
        method: 'POST',
        body: JSON.stringify(data),
    })

const revokeInvite = (inviteId: string) =>
    apiRequest<{ id: string }>(`/team/invites/${encodeURIComponent(inviteId)}`, {
        method: 'DELETE',
    })

const previewInvite = (token: string) =>
    apiRequest<InvitePreview>(`/team/invites/${encodeURIComponent(token)}`)

const acceptInvite = (token: string) =>
    apiRequest<{ team: { id: string; name: string }; role: TeamRole }>('/team/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
    })

const changeRole = (userId: string, role: InviteRole) =>
    apiRequest<{ member: TeamMember }>(`/team/members/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
    })

/** removes a member of the own team. with teamId and the own user id: leaves that team */
const removeMember = (userId: string, teamId?: string) =>
    apiRequest<{ userId: string }>(`/team/members/${encodeURIComponent(userId)}${scope(teamId)}`, {
        method: 'DELETE',
    })

const getAudit = (page = 1) => apiRequest<AuditPage>(`/team/audit?page=${page}&limit=50`)

/** the csv file of the audit log. the browser opens it with the sign-in cookie */
const auditExportUrl = () => `${API_BASE_URL}/team/audit/export`

/** the team of the user: members, invites and the teams the user joined */
export const TEAM_QUERY_KEY = ['team'] as const

export const teamAPI = {
    getTeam,
    invite,
    revokeInvite,
    previewInvite,
    acceptInvite,
    changeRole,
    removeMember,
    getAudit,
    auditExportUrl,
}
