import { prisma } from '@december/database'

import { PERSONAL_ACTION_PREFIXES } from './audit.utils'

import type { AuditScope, CreateAuditEvent, FindAuditEvents } from './audit.types'
import type { Prisma } from '@december/database'

async function createAuditEvent(data: CreateAuditEvent) {
    return prisma.auditEvent.create({ data, select: { id: true } })
}

// a personal event is in the result only for the user who did it
const auditWhere = (scope: AuditScope): Prisma.AuditEventWhereInput => {
    const { teamId, viewerId, filter } = scope
    const { action, actorId, from, to } = filter
    return {
        teamId,
        ...(action ? { action } : {}),
        ...(actorId ? { actorId } : {}),
        ...(from || to
            ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
            : {}),
        OR: [
            { actorId: viewerId },
            { NOT: PERSONAL_ACTION_PREFIXES.map((prefix) => ({ action: { startsWith: prefix } })) },
        ],
    }
}

const auditSelect = {
    id: true,
    action: true,
    target: true,
    ip: true,
    metadata: true,
    createdAt: true,
    actor: { select: { id: true, name: true, email: true } },
} as const

/** newest first */
async function findAuditEvents(data: FindAuditEvents) {
    const { skip, take, ...scope } = data
    return prisma.auditEvent.findMany({
        where: auditWhere(scope),
        select: auditSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
    })
}

async function countAuditEvents(data: AuditScope) {
    return prisma.auditEvent.count({ where: auditWhere(data) })
}

export const auditRepository = {
    createAuditEvent,
    findAuditEvents,
    countAuditEvents,
}
