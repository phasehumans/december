import { logger } from '../../config/logger'
import { teamRepository } from '../team/team.repository'

import { auditRepository } from './audit.repository'

import type {
    AuditScope,
    FindAuditEvents,
    RecordAuditEvent,
    RecordSignIn,
    RecordUserAuditEvent,
} from './audit.types'

// the audit log of a team (#640). a row that cannot be saved never fails the request it
// describes: the failure goes to the server log
const record = async (data: RecordAuditEvent): Promise<void> => {
    const { teamId, actorId, action, target, ip, metadata } = data
    try {
        await auditRepository.createAuditEvent({
            teamId,
            actorId: actorId ?? null,
            action,
            target: target ?? null,
            ip: ip ?? null,
            metadata,
        })
    } catch (error) {
        logger.warn({ err: error, teamId, action }, 'audit event not saved')
    }
}

// for the things a user does to the own account: the row goes on the user's own team
const recordForUser = async (data: RecordUserAuditEvent): Promise<void> => {
    const { userId, action, target, ip, metadata } = data
    try {
        const team = await teamRepository.ensureOwnTeam(userId)
        if (!team) return
        await record({ teamId: team.id, actorId: userId, action, target, ip, metadata })
    } catch (error) {
        logger.warn({ err: error, userId, action }, 'audit event not saved')
    }
}

// every way to sign in writes the same row
const recordSignIn = async (data: RecordSignIn): Promise<void> => {
    const { userId, method, ip } = data
    await recordForUser({ userId, action: 'auth.sign_in', ip, metadata: { method } })
}

// the events of a team that the reader may see, newest first
const listEvents = async (data: FindAuditEvents) => {
    const { teamId, viewerId, filter, skip, take } = data
    return auditRepository.findAuditEvents({ teamId, viewerId, filter, skip, take })
}

const countEvents = async (data: AuditScope) => {
    const { teamId, viewerId, filter } = data
    return auditRepository.countAuditEvents({ teamId, viewerId, filter })
}

export const auditService = {
    record,
    recordForUser,
    recordSignIn,
    listEvents,
    countEvents,
}
