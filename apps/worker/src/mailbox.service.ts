import { prisma } from '@december/database'

import type {
    EnqueueMailboxMessageInput,
    PlaceMailboxMessagesInput,
    CompleteMailboxMessagesInput,
    FailMailboxMessagesInput,
    ScheduleWakeUpInput,
    ParkSessionInput,
    UnparkSessionInput,
} from './mailbox.types'

const enqueueMailboxMessage = async (data: EnqueueMailboxMessageInput) => {
    const { sessionId, sender, content, metadata } = data

    return await prisma.mailboxMessage.create({
        data: {
            sessionId,
            sender,
            content,
            status: 'QUEUED',
            metadata: metadata || undefined,
        },
    })
}

const placeMailboxMessages = async (data: PlaceMailboxMessagesInput) => {
    const { sessionId } = data

    const queuedMessages = await prisma.mailboxMessage.findMany({
        where: {
            sessionId,
            status: 'QUEUED',
        },
        orderBy: { createdAt: 'asc' },
    })

    if (queuedMessages.length === 0) {
        return []
    }

    const ids = queuedMessages.map((msg) => msg.id)
    await prisma.mailboxMessage.updateMany({
        where: {
            id: { in: ids },
            status: 'QUEUED',
        },
        data: {
            status: 'PLACED',
        },
    })

    return queuedMessages
}

const completeMailboxMessages = async (data: CompleteMailboxMessagesInput) => {
    const { messageIds } = data

    if (!messageIds || messageIds.length === 0) {
        return
    }

    await prisma.mailboxMessage.updateMany({
        where: {
            id: { in: messageIds },
            status: 'PLACED',
        },
        data: {
            status: 'COMPLETED',
            processedAt: new Date(),
        },
    })
}

const failMailboxMessages = async (data: FailMailboxMessagesInput) => {
    const { messageIds } = data

    if (!messageIds || messageIds.length === 0) {
        return
    }

    await prisma.mailboxMessage.updateMany({
        where: {
            id: { in: messageIds },
        },
        data: {
            status: 'FAILED',
            processedAt: new Date(),
        },
    })
}

const scheduleWakeUp = async (data: ScheduleWakeUpInput) => {
    const { sessionId, triggerAt, reason, payload } = data

    return await prisma.wakeUpTrigger.create({
        data: {
            sessionId,
            triggerAt,
            reason: reason || 'scheduled_wake',
            status: 'PENDING',
            payload: payload || undefined,
        },
    })
}

const parkSession = async (data: ParkSessionInput) => {
    const { sessionId, reason } = data

    console.log(
        `[SESSION LIFECYCLE] Parking session '${sessionId}' (reason: ${reason || 'idle'}). Freeing runtime resources.`
    )

    await prisma.session.update({
        where: { id: sessionId },
        data: {
            status: 'PARKED',
            leaseOwner: null,
            leaseExpiresAt: null,
        },
    })

    return { status: 'PARKED' }
}

const unparkSession = async (data: UnparkSessionInput) => {
    const { sessionId } = data

    console.log(`[SESSION LIFECYCLE] Unparking session '${sessionId}' to resume execution.`)

    await prisma.session.update({
        where: { id: sessionId },
        data: {
            status: 'RUNNING',
        },
    })

    return { status: 'RUNNING' }
}

export const MailboxService = {
    enqueueMailboxMessage,
    placeMailboxMessages,
    completeMailboxMessages,
    failMailboxMessages,
    scheduleWakeUp,
    parkSession,
    unparkSession,
}
