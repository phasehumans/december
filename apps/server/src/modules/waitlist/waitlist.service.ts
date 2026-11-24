import { AppError } from '../../shared/appError'
import { adminRepository } from '../admin/admin.repository'
import { personalize } from '../admin/admin.utils'
import { emailService } from '../email/email.service'
import { notificationService } from '../notification/notification.service'

import { waitlistRepository } from './waitlist.repository'

import type {
    GetWaitlistState,
    JoinWaitlist,
    LaunchWaitlist,
    ListWaitlistEntries,
    MarkPopupSeen,
    WaitlistAdminList,
    WaitlistLaunchResult,
    WaitlistState,
} from './waitlist.types'

const ADMIN_LIST_LIMIT = 1000

const getState = async (data: GetWaitlistState): Promise<WaitlistState> => {
    const { userId, feature } = data
    const [entry, user] = await Promise.all([
        waitlistRepository.findEntry({ userId, feature }),
        waitlistRepository.findUserOnboarding(userId),
    ])

    if (!user) {
        throw new AppError('user not found', 404)
    }

    const joinedAt = entry?.joinedAt ?? null
    const popupSeen = Boolean(entry?.popupSeenAt)

    return {
        feature,
        joined: Boolean(joinedAt),
        joinedAt: joinedAt ? joinedAt.toISOString() : null,
        popupSeen,
        canShowPopup: Boolean(user.onboardingCompletedAt) && !popupSeen,
    }
}

const join = async (data: JoinWaitlist): Promise<WaitlistState> => {
    const { userId, feature } = data
    await waitlistRepository.ensureEntry({ userId, feature })
    await waitlistRepository.setJoinedAtIfEmpty({ userId, feature, at: new Date() })
    return getState({ userId, feature })
}

const markPopupSeen = async (data: MarkPopupSeen): Promise<WaitlistState> => {
    const { userId, feature } = data
    await waitlistRepository.ensureEntry({ userId, feature })
    await waitlistRepository.setPopupSeenAtIfEmpty({ userId, feature, at: new Date() })
    return getState({ userId, feature })
}

// admin only (#630): who asked to be told when the feature ships
const listEntries = async (data: ListWaitlistEntries): Promise<WaitlistAdminList> => {
    const { feature } = data
    const [entries, counts] = await Promise.all([
        waitlistRepository.findJoinedEntries({ feature, limit: ADMIN_LIST_LIMIT }),
        waitlistRepository.countEntries({ feature }),
    ])

    return {
        feature,
        ...counts,
        items: entries.map((entry) => ({
            userId: entry.userId,
            name: entry.user.name,
            email: entry.user.email,
            joinedAt: entry.joinedAt ? entry.joinedAt.toISOString() : null,
            notifiedAt: entry.notifiedAt ? entry.notifiedAt.toISOString() : null,
        })),
    }
}

/**
 * Launch day (#630): email and an inbox item to everyone on the list who has not had one.
 * Each row is claimed first, so a second click or a later launch never sends twice.
 */
const launch = async (data: LaunchWaitlist): Promise<WaitlistLaunchResult> => {
    const { adminUserId, feature, subject, body, inboxMessage } = data
    const entries = await waitlistRepository.findUnnotifiedEntries({ feature })

    let sentCount = 0
    let failedCount = 0
    for (const entry of entries) {
        const claimed = await waitlistRepository.claimNotify({ id: entry.id, at: new Date() })
        if (!claimed) continue

        const queued = await emailService.sendMessageEmail({
            to: entry.user.email,
            subject,
            body: personalize(body, entry.user.name),
        })
        if (!queued) {
            // not queued (redis down): free the row so the next launch tries this person again
            await waitlistRepository.releaseNotify({ id: entry.id })
            failedCount += 1
            continue
        }
        sentCount += 1

        try {
            await notificationService.sendNotificationToUser({
                userId: entry.userId,
                title: subject,
                message: inboxMessage,
            })
        } catch (err) {
            // the email is out and the row stays claimed, so the rest of the list still gets theirs
            console.error(`[Waitlist] launch inbox item failed for ${entry.userId}:`, err)
        }
    }

    await adminRepository.writeAuditLog({
        adminUserId,
        action: 'waitlist.launch',
        targetType: 'waitlist',
        targetId: feature,
        metadata: { subject, sentCount, failedCount },
    })

    return { sentCount, failedCount }
}

export const waitlistService = {
    getState,
    join,
    markPopupSeen,
    listEntries,
    launch,
}
