import { env } from '../../env'
import { AppError } from '../../shared/appError'
import { auditService } from '../audit/audit.service'
import { emailService } from '../email/email.service'

import { teamRepository } from './team.repository'
import {
    AUDIT_EXPORT_MAX_ROWS,
    INVITE_TTL_MS,
    MAX_PENDING_INVITES,
    MAX_TEAM_MEMBERS,
    buildInviteUrl,
    canManageTeam,
    createInviteToken,
    hashInviteToken,
    maskEmail,
    normalizeEmail,
    oneLine,
    roleLabel,
    toAuditCsv,
    toMemberView,
} from './team.utils'

import type {
    AcceptInvite,
    ChangeMemberRole,
    CreateInvite,
    EnsureTeam,
    ExportAuditEvents,
    GetTeam,
    InvitePreview,
    ListAuditEvents,
    MemberOfView,
    PreviewInvite,
    RemoveMember,
    RevokeInvite,
    TeamInviteView,
    TeamMemberView,
    TeamRecord,
    TeamRole,
    TeamScope,
} from './team.types'

// every user owns one team. a new user has none until it is first needed, so it is made here
const ensureTeam = async (data: EnsureTeam): Promise<TeamRecord> => {
    const { userId } = data
    const team = await teamRepository.ensureOwnTeam(userId)
    if (!team) throw new AppError('user not found', 404)
    return team
}

// the team a request is about and the role of the user in it. a team where the user has
// no role looks like a team that does not exist
const resolveTeam = async (data: TeamScope): Promise<{ team: TeamRecord; role: TeamRole }> => {
    const { userId, teamId } = data
    if (!teamId) {
        return { team: await ensureTeam({ userId }), role: 'OWNER' }
    }
    const membership = await teamRepository.findMembership(teamId, userId)
    if (!membership) throw new AppError('team not found', 404)
    return { team: membership.team, role: membership.role }
}

const getTeam = async (data: GetTeam) => {
    const { userId, teamId } = data
    const { team, role } = await resolveTeam({ userId, teamId })
    const canManage = canManageTeam(role)

    const [memberRows, inviteRows, joinedRows] = await Promise.all([
        teamRepository.findMembers(team.id),
        canManage ? teamRepository.findPendingInvites(team.id, new Date()) : [],
        teamRepository.findJoinedTeams(userId),
    ])

    const members: TeamMemberView[] = memberRows
        .map(toMemberView)
        // the owner first, then by the date they joined
        .sort((a, b) => Number(b.role === 'OWNER') - Number(a.role === 'OWNER'))

    const invites: TeamInviteView[] = inviteRows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        invitedBy: row.invitedBy.name,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
    }))

    const memberOf: MemberOfView[] = joinedRows.map((row) => ({
        teamId: row.team.id,
        name: row.team.name,
        ownerName: row.team.owner.name,
        role: row.role,
    }))

    return {
        team: { id: team.id, name: team.name, createdAt: team.createdAt },
        role,
        members,
        invites,
        memberOf,
    }
}

const createInvite = async (data: CreateInvite) => {
    const { userId, teamId, email, role, ip } = data
    const { team, role: actorRole } = await resolveTeam({ userId, teamId })
    if (!canManageTeam(actorRole)) {
        throw new AppError('only the owner or an admin can invite people', 403)
    }
    // an admin cannot make another admin: only the owner sets who is an admin
    if (role === 'ADMIN' && actorRole !== 'OWNER') {
        throw new AppError('only the owner can invite an admin', 403)
    }

    const address = normalizeEmail(email)
    const now = new Date()
    const [member, pending, memberCount, inviteCount, inviter] = await Promise.all([
        teamRepository.findMemberByEmail(team.id, address),
        teamRepository.findPendingInviteByEmail(team.id, address, now),
        teamRepository.countMembers(team.id),
        teamRepository.countPendingInvites(team.id, now),
        teamRepository.findUserContact(userId),
    ])
    if (!inviter) throw new AppError('user not found', 404)
    if (member) throw new AppError('this person is in the team already', 409)
    if (pending) throw new AppError('this person has an invite already', 409)
    if (memberCount >= MAX_TEAM_MEMBERS) {
        throw new AppError(`a team can have up to ${MAX_TEAM_MEMBERS} members`, 409)
    }
    if (inviteCount >= MAX_PENDING_INVITES) {
        throw new AppError(`a team can have up to ${MAX_PENDING_INVITES} open invites`, 409)
    }

    const token = createInviteToken()
    const invite = await teamRepository.createInvite({
        teamId: team.id,
        email: address,
        role,
        tokenHash: hashInviteToken(token),
        invitedById: userId,
        expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    })

    const inviteUrl = buildInviteUrl(token)
    if (env.NODE_ENV === 'development') {
        console.log(`[DEV invite link] ${address}: ${inviteUrl}`)
    }
    const inviterName = oneLine(inviter.name) || inviter.email
    const queued = await emailService.sendMessageEmail({
        to: address,
        subject: `${inviterName} invited you to a team on December`,
        body: [
            `${inviterName} (${inviter.email}) invited you to the team ${oneLine(team.name)} on December as ${roleLabel(role)}.`,
            `Join the team: ${inviteUrl}`,
            `The link works for 7 days. Sign in with ${address} to join.`,
        ].join('\n\n'),
    })
    // the token is only in the mail, so an invite with no mail is of no use to anyone
    if (!queued) {
        await teamRepository.deleteInvite(invite.id)
        throw new AppError('the invite mail could not be sent. try again', 503)
    }

    await auditService.record({
        teamId: team.id,
        actorId: userId,
        action: 'member.invited',
        target: address,
        ip,
        metadata: { role },
    })

    return { invite: { ...invite, invitedBy: inviter.name } }
}

const revokeInvite = async (data: RevokeInvite) => {
    const { userId, teamId, inviteId, ip } = data
    const { team, role } = await resolveTeam({ userId, teamId })
    if (!canManageTeam(role)) {
        throw new AppError('only the owner or an admin can revoke an invite', 403)
    }

    const invite = await teamRepository.revokeInvite(team.id, inviteId, new Date())
    if (!invite) throw new AppError('invite not found', 404)

    await auditService.record({
        teamId: team.id,
        actorId: userId,
        action: 'member.invite_revoked',
        target: invite.email,
        ip,
        metadata: { role: invite.role },
    })

    return { id: invite.id }
}

// the invite page reads this before the user signs in, so it gives no more than the page
// shows, and the email is masked
const previewInvite = async (data: PreviewInvite): Promise<InvitePreview> => {
    const { token, viewerId } = data
    const invite = await teamRepository.findInviteByTokenHash(hashInviteToken(token))
    if (!invite || invite.revokedAt || invite.acceptedAt) {
        throw new AppError('invite not found', 404)
    }

    const preview: InvitePreview = {
        teamName: invite.team.name,
        inviterName: invite.invitedBy.name,
        role: invite.role,
        email: maskEmail(invite.email),
        expired: invite.expiresAt.getTime() <= Date.now(),
    }
    if (!viewerId) return preview

    const viewer = await teamRepository.findUserContact(viewerId)
    if (!viewer) return preview
    return { ...preview, emailMatches: normalizeEmail(viewer.email) === invite.email }
}

const acceptInvite = async (data: AcceptInvite) => {
    const { userId, token, ip } = data
    const invite = await teamRepository.findInviteByTokenHash(hashInviteToken(token))
    if (!invite || invite.revokedAt) throw new AppError('invite not found', 404)
    if (invite.acceptedAt) throw new AppError('this invite is used already', 409)
    const now = new Date()
    if (invite.expiresAt.getTime() <= now.getTime()) {
        throw new AppError('this invite has expired', 410)
    }

    const user = await teamRepository.findUserContact(userId)
    if (!user) throw new AppError('user not found', 404)
    // the link alone is not enough: the account must own the invited address
    if (normalizeEmail(user.email) !== invite.email) {
        throw new AppError('this invite is for another email address', 403)
    }
    if (!user.emailVerified) {
        throw new AppError('verify your email address to join a team', 403)
    }

    const memberCount = await teamRepository.countMembers(invite.teamId)
    if (memberCount >= MAX_TEAM_MEMBERS) {
        throw new AppError(`a team can have up to ${MAX_TEAM_MEMBERS} members`, 409)
    }

    const member = await teamRepository.acceptInvite({
        inviteId: invite.id,
        teamId: invite.teamId,
        userId,
        role: invite.role,
        now,
    })
    if (!member) throw new AppError('this invite is used already', 409)

    await auditService.record({
        teamId: invite.teamId,
        actorId: userId,
        action: 'member.joined',
        target: user.email,
        ip,
        metadata: { role: member.role },
    })

    return { team: { id: invite.team.id, name: invite.team.name }, role: member.role }
}

const changeMemberRole = async (data: ChangeMemberRole) => {
    const { userId, teamId, memberUserId, role, ip } = data
    const { team, role: actorRole } = await resolveTeam({ userId, teamId })
    if (actorRole !== 'OWNER') throw new AppError('only the owner can change a role', 403)

    const member = await teamRepository.findMember(team.id, memberUserId)
    if (!member) throw new AppError('member not found', 404)
    // no ownership transfer yet: the owner stays the owner
    if (member.role === 'OWNER') throw new AppError('the role of the owner cannot change', 400)
    if (member.role === role) return { member: toMemberView(member) }

    const updated = await teamRepository.updateMemberRole(team.id, memberUserId, role)

    await auditService.record({
        teamId: team.id,
        actorId: userId,
        action: 'member.role_changed',
        target: updated.user.email,
        ip,
        metadata: { from: member.role, to: role },
    })

    return { member: toMemberView(updated) }
}

// an owner or admin removes a member, or a member removes itself (leaves)
const removeMember = async (data: RemoveMember) => {
    const { userId, teamId, memberUserId, ip } = data
    const { team, role: actorRole } = await resolveTeam({ userId, teamId })
    const isLeaving = memberUserId === userId

    if (isLeaving) {
        if (actorRole === 'OWNER') throw new AppError('the owner cannot leave the team', 400)
    } else if (!canManageTeam(actorRole)) {
        throw new AppError('only the owner or an admin can remove a member', 403)
    }

    const member = await teamRepository.findMember(team.id, memberUserId)
    if (!member) throw new AppError('member not found', 404)
    if (!isLeaving) {
        if (member.role === 'OWNER') throw new AppError('the owner cannot be removed', 403)
        if (member.role === 'ADMIN' && actorRole !== 'OWNER') {
            throw new AppError('only the owner can remove an admin', 403)
        }
    }

    const removed = await teamRepository.deleteMember(team.id, memberUserId)
    if (!removed) throw new AppError('member not found', 404)

    await auditService.record({
        teamId: team.id,
        actorId: userId,
        action: isLeaving ? 'member.left' : 'member.removed',
        target: member.user.email,
        ip,
        metadata: { role: member.role },
    })

    return { userId: memberUserId }
}

// the audit log is for the owner and the admins of the team
const resolveAuditTeam = async (data: TeamScope): Promise<TeamRecord> => {
    const { userId, teamId } = data
    const { team, role } = await resolveTeam({ userId, teamId })
    if (!canManageTeam(role)) {
        throw new AppError('only the owner or an admin can read the audit log', 403)
    }
    return team
}

const listAuditEvents = async (data: ListAuditEvents) => {
    const { userId, teamId, action, actorId, from, to, page, limit } = data
    const team = await resolveAuditTeam({ userId, teamId })
    const filter = { action, actorId, from, to }

    // personal events (sign-in, secrets, keys, billing) are only for the user who did them
    const scope = { teamId: team.id, viewerId: userId, filter }

    const [total, events] = await Promise.all([
        auditService.countEvents(scope),
        auditService.listEvents({ ...scope, skip: (page - 1) * limit, take: limit }),
    ])

    return {
        events,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    }
}

// the same filter as the list, as a csv file. the newest AUDIT_EXPORT_MAX_ROWS rows
const exportAuditEvents = async (data: ExportAuditEvents) => {
    const { userId, teamId, action, actorId, from, to } = data
    const team = await resolveAuditTeam({ userId, teamId })

    const events = await auditService.listEvents({
        teamId: team.id,
        viewerId: userId,
        filter: { action, actorId, from, to },
        skip: 0,
        take: AUDIT_EXPORT_MAX_ROWS,
    })

    return { fileName: 'audit-log.csv', csv: toAuditCsv(events) }
}

export const teamService = {
    ensureTeam,
    getTeam,
    changeMemberRole,
    removeMember,
    createInvite,
    revokeInvite,
    previewInvite,
    acceptInvite,
    listAuditEvents,
    exportAuditEvents,
}
