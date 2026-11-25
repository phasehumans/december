import { createHash, randomBytes } from 'node:crypto'

import { env } from '../../env'

import type { MemberRow, TeamMemberView, TeamRole } from './team.types'
import type { AuditEventRow } from '../audit/audit.types'

export const MAX_TEAM_MEMBERS = 50
export const MAX_PENDING_INVITES = 50
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** a random token for the invite link. only its hash is saved */
export const createInviteToken = (): string => randomBytes(32).toString('base64url')

export const hashInviteToken = (token: string): string =>
    createHash('sha256').update(token).digest('hex')

export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** the link in the invite mail: a page of the web app */
export const buildInviteUrl = (token: string): string =>
    `${(env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')}/invite/${token}`

/** asha@example.com becomes a***@example.com: enough to know which of your addresses it is */
export const maskEmail = (email: string): string => {
    const at = email.lastIndexOf('@')
    if (at < 1) return '***'
    return `${email[0]}***${email.slice(at)}`
}

export const toMemberView = (row: MemberRow): TeamMemberView => ({
    userId: row.userId,
    name: row.user.name,
    email: row.user.email,
    role: row.role,
    joinedAt: row.createdAt,
})

export const AUDIT_EXPORT_MAX_ROWS = 5000

/**
 * one csv cell. a cell that starts with = + - @ (or a tab or a return) gets a leading ',
 * so a spreadsheet shows it as text and does not run it as a formula.
 */
export const csvCell = (value: string | null | undefined): string => {
    const raw = value ?? ''
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

const AUDIT_CSV_HEADER = ['time', 'actor', 'email', 'action', 'target', 'ip', 'details']

export const toAuditCsv = (rows: AuditEventRow[]): string => {
    const lines = rows.map((row) =>
        [
            row.createdAt.toISOString(),
            row.actor?.name,
            row.actor?.email,
            row.action,
            row.target,
            row.ip,
            row.metadata ? JSON.stringify(row.metadata) : '',
        ]
            .map(csvCell)
            .join(',')
    )
    return [AUDIT_CSV_HEADER.join(','), ...lines].join('\r\n') + '\r\n'
}

/** a name on one line, for a mail subject */
export const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const canManageTeam = (role: TeamRole): boolean => role === 'OWNER' || role === 'ADMIN'

export const roleLabel = (role: TeamRole): string =>
    role === 'ADMIN' ? 'an admin' : role === 'OWNER' ? 'the owner' : 'a member'
