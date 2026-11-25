import { prisma } from '@december/database'

import type { InviteRole, TeamRole } from './team.types'

const teamSelect = { id: true, name: true, ownerId: true, createdAt: true } as const

const memberSelect = {
    userId: true,
    role: true,
    createdAt: true,
    user: { select: { name: true, email: true } },
} as const

async function findUserContact(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, emailVerified: true },
    })
}

async function findTeamByOwner(ownerId: string) {
    return prisma.team.findUnique({ where: { ownerId }, select: teamSelect })
}

/** the team of a user with the owner as its first member. safe to call twice */
async function createOwnTeam(ownerId: string, name: string) {
    return prisma.$transaction(async (tx) => {
        const team = await tx.team.upsert({
            where: { ownerId },
            update: {},
            create: { ownerId, name },
            select: teamSelect,
        })
        await tx.teamMember.upsert({
            where: { teamId_userId: { teamId: team.id, userId: ownerId } },
            update: {},
            create: { teamId: team.id, userId: ownerId, role: 'OWNER' },
        })
        return team
    })
}

/**
 * every user owns one team. a user from after the migration has none until it is first
 * needed, so it is made here. null when the user does not exist.
 */
async function ensureOwnTeam(userId: string) {
    const existing = await findTeamByOwner(userId)
    if (existing) return existing

    const user = await findUserContact(userId)
    if (!user) return null
    try {
        return await createOwnTeam(userId, user.name.trim() || user.email)
    } catch (error: any) {
        // two first reads at once: the other one made the team
        if (error?.code === 'P2002') return findTeamByOwner(userId)
        throw error
    }
}

async function findMembership(teamId: string, userId: string) {
    return prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { role: true, team: { select: teamSelect } },
    })
}

async function findMembers(teamId: string) {
    return prisma.teamMember.findMany({
        where: { teamId },
        select: memberSelect,
        orderBy: { createdAt: 'asc' },
    })
}

async function findPendingInvites(teamId: string, now: Date) {
    return prisma.teamInvite.findMany({
        where: { teamId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true,
            invitedBy: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
    })
}

/** the teams of other people that this user joined */
async function findJoinedTeams(userId: string) {
    return prisma.teamMember.findMany({
        where: { userId, team: { ownerId: { not: userId } } },
        select: {
            role: true,
            team: { select: { id: true, name: true, owner: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'asc' },
    })
}

async function findMemberByEmail(teamId: string, email: string) {
    return prisma.teamMember.findFirst({
        where: { teamId, user: { email: { equals: email, mode: 'insensitive' } } },
        select: { userId: true },
    })
}

async function findPendingInviteByEmail(teamId: string, email: string, now: Date) {
    return prisma.teamInvite.findFirst({
        where: { teamId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        select: { id: true },
    })
}

async function countMembers(teamId: string) {
    return prisma.teamMember.count({ where: { teamId } })
}

async function countPendingInvites(teamId: string, now: Date) {
    return prisma.teamInvite.count({
        where: { teamId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    })
}

async function createInvite(data: {
    teamId: string
    email: string
    role: InviteRole
    tokenHash: string
    invitedById: string
    expiresAt: Date
}) {
    return prisma.teamInvite.create({
        data,
        select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    })
}

async function findInviteByTokenHash(tokenHash: string) {
    return prisma.teamInvite.findUnique({
        where: { tokenHash },
        select: {
            id: true,
            teamId: true,
            email: true,
            role: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            team: { select: { id: true, name: true } },
            invitedBy: { select: { name: true } },
        },
    })
}

/**
 * marks the invite used and adds the member, as one step. null when another request used,
 * revoked or outlived the invite first, or when the user is in the team already.
 */
async function acceptInvite(data: {
    inviteId: string
    teamId: string
    userId: string
    role: TeamRole
    now: Date
}) {
    const { inviteId, teamId, userId, role, now } = data
    try {
        return await prisma.$transaction(async (tx) => {
            const claimed = await tx.teamInvite.updateMany({
                where: { id: inviteId, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
                data: { acceptedAt: now },
            })
            if (claimed.count !== 1) return null
            return tx.teamMember.create({
                data: { teamId, userId, role },
                select: { role: true },
            })
        })
    } catch (error: any) {
        // the user is a member already: the unique (teamId, userId) refused the second row
        if (error?.code === 'P2002') return null
        throw error
    }
}

/** the invite when it was open and is revoked now, null in every other case */
async function revokeInvite(teamId: string, inviteId: string, now: Date) {
    const revoked = await prisma.teamInvite.updateMany({
        where: { id: inviteId, teamId, acceptedAt: null, revokedAt: null },
        data: { revokedAt: now },
    })
    if (revoked.count !== 1) return null
    return prisma.teamInvite.findUnique({
        where: { id: inviteId },
        select: { id: true, email: true, role: true },
    })
}

async function findMember(teamId: string, userId: string) {
    return prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: memberSelect,
    })
}

async function updateMemberRole(teamId: string, userId: string, role: InviteRole) {
    return prisma.teamMember.update({
        where: { teamId_userId: { teamId, userId } },
        data: { role },
        select: memberSelect,
    })
}

/** false when the member was gone already */
async function deleteMember(teamId: string, userId: string) {
    // the owner row never goes: the role is in the filter, so a wrong caller cannot delete it
    const deleted = await prisma.teamMember.deleteMany({
        where: { teamId, userId, role: { not: 'OWNER' } },
    })
    return deleted.count === 1
}

/** for an invite whose mail could not be sent */
async function deleteInvite(inviteId: string) {
    return prisma.teamInvite.deleteMany({ where: { id: inviteId } })
}

export const teamRepository = {
    deleteInvite,
    findMember,
    updateMemberRole,
    deleteMember,
    revokeInvite,
    findUserContact,
    findTeamByOwner,
    createOwnTeam,
    ensureOwnTeam,
    findMembership,
    findMembers,
    findPendingInvites,
    findJoinedTeams,
    findMemberByEmail,
    findPendingInviteByEmail,
    countMembers,
    countPendingInvites,
    createInvite,
    findInviteByTokenHash,
    acceptInvite,
}
