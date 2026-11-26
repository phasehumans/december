import { publishEvent } from '@december/shared/queue'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { sendWebPush } from '../../shared/web-push'
import { getAdminEmails } from '../admin/admin.utils'
import { emailService } from '../email/email.service'

import { notificationRepository } from './notification.repository'
import {
    appUrl,
    digestBody,
    eventMessage,
    isAllowedPushEndpoint,
    isDigestDue,
    levelAllows,
    vapidKeys,
} from './notification.utils'

export const notificationSelect = {
    id: true,
    title: true,
    message: true,
    isRead: true,
    type: true,
    category: true,
    link: true,
    createdAt: true,
}

import type {
    GetNotifications,
    GetUnreadCount,
    GetNotificationById,
    MarkAsRead,
    DeleteNotification,
    SendNotificationToUser,
    DeleteAllReadNotification,
    MarkAllAsRead,
    NotifyEvent,
    NotifyLowCredits,
    SendPushToUser,
    InvalidateProfileCache,
    GetPushConfig,
    GetPushStatus,
    SubscribePush,
    UnsubscribePush,
    RemovePushOnSignOut,
    StartDigestWindow,
    SendDailyDigests,
    SendNotificationToAdmins,
} from './notification.types'

const getNotifications = async (data: GetNotifications) => {
    const { userId, page, limit, isRead, category } = data
    return notificationRepository.findManyNotifications({
        userId,
        page,
        limit,
        isRead,
        category,
        select: notificationSelect,
    })
}

const getUnreadCount = async (data: GetUnreadCount) => {
    const { userId } = data
    const [count, mentions] = await Promise.all([
        notificationRepository.countUnreadNotifications(userId),
        notificationRepository.countUnreadNotifications(userId, 'MENTION'),
    ])
    return { count, mentions }
}

const getNotificationById = async (data: GetNotificationById) => {
    const { userId, id } = data
    return notificationRepository.findNotificationById({
        userId,
        id,
        select: notificationSelect,
    })
}

const markAsRead = async (data: MarkAsRead) => {
    const { userId, id } = data
    const existing = await notificationRepository.findFirstNotification({
        userId,
        id,
        select: {
            id: true,
        },
    })

    if (!existing) {
        throw new AppError('notification not found', 404)
    }

    return notificationRepository.updateNotificationRead({
        userId,
        id,
        select: notificationSelect,
    })
}

const deleteNotification = async (data: DeleteNotification) => {
    const { userId, id } = data
    const existing = await notificationRepository.findFirstNotification({
        userId,
        id,
        select: {
            id: true,
        },
    })

    if (!existing) {
        throw new AppError('notification not found', 404)
    }

    return notificationRepository.deleteNotification({
        userId,
        id,
        select: notificationSelect,
    })
}

const sendNotificationToUser = async (data: SendNotificationToUser) => {
    const {
        userId,
        title,
        message,
        type = 'INFO',
        link,
        category = 'GENERAL',
        toast = false,
    } = data
    const notification = await notificationRepository.createNotification({
        userId,
        title,
        message,
        type,
        category,
        link,
        select: notificationSelect,
    })

    // open tabs get it at once over the socket (socket.ts relays user_notifications:*)
    try {
        await publishEvent(`user_notifications:${userId}`, { notification, toast })
    } catch (err) {
        // the inbox still refetches the unread count every 30s, so a missed publish only delays it
        console.error('[Notification] live publish failed:', err)
    }

    return notification
}

const markAllAsRead = async (data: MarkAllAsRead) => {
    const { userId } = data
    const result = await notificationRepository.updateAllNotificationsRead(userId)
    return { updated: result.count }
}

const deleteAllReadNotification = async (data: DeleteAllReadNotification) => {
    const { userId } = data
    return notificationRepository.deleteManyReadNotifications(userId)
}

// notification settings, email, push and the daily summary (#636)

const settingsLink = () => [{ label: 'Notification settings', url: `${appUrl()}/settings/account` }]

// the profile response carries notifyPush; it is cached by the setting module
const invalidateProfileCache = async (data: InvalidateProfileCache) => {
    const { userId } = data
    await appCache.del(appCache.key('setting', 'profile', userId))
}

/** sends one push message to every browser of the user; returns how many took it */
const sendPushToUser = async (data: SendPushToUser) => {
    const { userId, payload, urgency } = data

    const keys = vapidKeys()
    if (!keys) return 0

    const subscriptions = await notificationRepository.findPushSubscriptions(userId)
    const gone: string[] = []
    const delivered: string[] = []
    for (const subscription of subscriptions) {
        try {
            const result = await sendWebPush({
                target: subscription,
                payload,
                keys,
                urgency,
                topic: payload.tag,
            })
            if (result.ok) delivered.push(subscription.id)
            else if (result.gone) gone.push(subscription.id)
            else console.warn(`[Notification] push answered ${result.status}`)
        } catch (error) {
            console.error('[Notification] push failed:', error)
        }
    }

    if (gone.length > 0) await notificationRepository.deletePushSubscriptionsByIds(gone)
    if (delivered.length > 0) await notificationRepository.touchPushSubscriptions(delivered)
    return delivered.length
}

/**
 * One event for one user: the inbox, then email and push, as far as the user's level
 * allows. While the user has the session open, only the inbox gets it.
 */
const notifyEvent = async (data: NotifyEvent) => {
    const { userId, kind, sessionId, sessionTitle, detail, isWatching = false } = data

    const prefs = await notificationRepository.findUserNotifyPrefs(userId)
    if (!prefs || prefs.isDeleted || !levelAllows(prefs.notifyLevel, kind)) {
        return { inbox: false, email: false, push: 0 }
    }

    const words = eventMessage({ kind, sessionId, sessionTitle, detail })
    await sendNotificationToUser({
        userId,
        title: words.title,
        message: words.message,
        type: words.type,
        link: words.path,
        toast: kind === 'SESSION_NEEDS_INPUT' || kind === 'SPEND_LIMIT',
    })

    if (isWatching) return { inbox: true, email: false, push: 0 }

    const url = `${appUrl()}${words.path}`
    let email = false
    if (prefs.notifyEmail) {
        const sent = await emailService.sendMessageEmail({
            to: prefs.email,
            subject: words.emailSubject,
            body: `${words.emailBody}\n\nOpen it: ${url}`,
            footerLinks: settingsLink(),
        })
        email = sent !== null
    }

    const push = prefs.notifyPush
        ? await sendPushToUser({
              userId,
              payload: {
                  title: words.title,
                  body: words.message,
                  url,
                  tag: `${kind}-${sessionId ?? userId}`,
              },
              urgency: kind === 'SESSION_FINISHED' ? 'normal' : 'high',
          })
        : 0

    return { inbox: true, email, push }
}

/**
 * Low credits, from every place that charges credits: the worker's CreditsLow event (each
 * server node gets it) and the server's own charges. All of them claim the same mark on the
 * user, so one drop under the user's amount gives one alert, and the next one goes out only
 * after the balance went over the amount and under it again (#638). Which charge is a drop:
 * crossedLowCreditsAmount.
 */
const notifyLowCredits = async (data: NotifyLowCredits) => {
    const { userId, balanceInCents } = data

    if (!(await notificationRepository.claimLowBalanceAlert(userId))) {
        return { inbox: false, email: false, push: 0 }
    }
    return notifyEvent({
        userId,
        kind: 'LOW_CREDITS',
        // whole cents, rounded down: a balance just under the amount does not show the amount
        detail: Number.isFinite(balanceInCents) ? String(Math.floor(balanceInCents)) : undefined,
    })
}

const getPushConfig = async (_data: GetPushConfig) => ({
    publicKey: vapidKeys()?.publicKey ?? null,
})

/**
 * The switch on the account page: does this browser have push for this user. A browser
 * keeps its endpoint when another user signs in on it, so only the server knows.
 */
const getPushStatus = async (data: GetPushStatus) => {
    const { userId, endpoint } = data
    const subscription = await notificationRepository.findPushSubscription({ userId, endpoint })
    return { subscribed: subscription !== null }
}

// this browser gets push; turning it on anywhere turns it on for the account
const subscribePush = async (data: SubscribePush) => {
    const { userId, authSessionId, endpoint, p256dh, auth, userAgent } = data

    if (!vapidKeys()) {
        throw new AppError('push is not set up on this server', 503)
    }
    if (!isAllowedPushEndpoint(endpoint)) {
        throw new AppError('this push service is not supported', 400)
    }

    await notificationRepository.upsertPushSubscription({
        userId,
        authSessionId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent?.slice(0, 300),
    })
    const updated = await notificationRepository.updateNotifyPush(userId, true)
    await invalidateProfileCache({ userId })
    return updated
}

// this browser stops; the account stays on while another browser still has push
const unsubscribePush = async (data: UnsubscribePush) => {
    const { userId, endpoint } = data

    await notificationRepository.deletePushSubscription({ userId, endpoint })
    const remaining = await notificationRepository.countPushSubscriptions(userId)
    const updated = await notificationRepository.updateNotifyPush(userId, remaining > 0)
    await invalidateProfileCache({ userId })
    return { ...updated, devices: remaining }
}

/**
 * A sign-in ended (sign out, a device signed out from the list, sign out everywhere): its
 * browsers get no more push. With no authSessionId, every browser of the user.
 */
const removePushOnSignOut = async (data: RemovePushOnSignOut) => {
    const { userId, authSessionId } = data

    const removed = await notificationRepository.deletePushSubscriptionsOnSignOut({
        userId,
        authSessionId,
    })
    if (removed.count === 0) return { removed: 0 }

    const remaining = await notificationRepository.countPushSubscriptions(userId)
    if (remaining === 0) {
        await notificationRepository.updateNotifyPush(userId, false)
        await invalidateProfileCache({ userId })
    }
    return { removed: removed.count }
}

/**
 * The user turns the summary on: the window of the first summary starts now, not at the
 * last summary from before it was off. Saving "on" again changes nothing.
 */
const startDigestWindow = async (data: StartDigestWindow) => {
    const { userId, now = new Date() } = data
    const result = await notificationRepository.startDigestWindow(userId, now)
    return { started: result.count > 0 }
}

/**
 * The background tick: one mail for each user whose summary time has come in their time
 * zone, with what happened since the last one. No mail when nothing happened.
 */
const sendDailyDigests = async (data: SendDailyDigests) => {
    const { now = new Date() } = data

    const users = await notificationRepository.findDigestUsers()
    let sent = 0
    for (const user of users) {
        try {
            const since = user.lastDigestAt
            if (!since) {
                // no saved start (turned on before startDigestWindow): the window starts here
                await notificationRepository.markDigestSent(user.id, now)
                continue
            }
            if (
                !isDigestDue({
                    now,
                    timezone: user.timezone,
                    digestTime: user.digestTime,
                    lastDigestAt: since,
                })
            ) {
                continue
            }

            const body = digestBody(await notificationRepository.summarizeSince(user.id, since))
            if (body) {
                await emailService.sendMessageEmail({
                    to: user.email,
                    subject: 'Your December day',
                    body: `${body}\n\nOpen December: ${appUrl()}`,
                    footerLinks: settingsLink(),
                })
                sent += 1
            }
            // a quiet day counts too, so the next summary starts from here
            await notificationRepository.markDigestSent(user.id, now)
        } catch (error) {
            console.error(`[Notification] daily summary failed for ${user.id}:`, error)
        }
    }
    return { checked: users.length, sent }
}

/**
 * Admin events (a credit request, a credit change, a session opened, the authenticator) go
 * to every admin's December inbox. Admins get no email for these.
 */
const sendNotificationToAdmins = async (data: SendNotificationToAdmins) => {
    const userIds = await notificationRepository.findUserIdsByEmails(getAdminEmails())
    for (const userId of userIds) {
        try {
            await sendNotificationToUser({ ...data, userId })
        } catch (err) {
            // the admin action already happened; a missed inbox item must not undo or block it
            console.error('[Notification] admin inbox item failed:', err)
        }
    }
}

export const notificationService = {
    notifyEvent,
    notifyLowCredits,
    sendPushToUser,
    getPushConfig,
    getPushStatus,
    subscribePush,
    unsubscribePush,
    removePushOnSignOut,
    startDigestWindow,
    sendDailyDigests,
    getNotifications,
    getUnreadCount,
    getNotificationById,
    markAsRead,
    deleteNotification,
    sendNotificationToUser,
    sendNotificationToAdmins,
    deleteAllReadNotification,
    markAllAsRead,
}
