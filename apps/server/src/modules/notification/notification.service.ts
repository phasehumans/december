import { publishEvent } from '@december/shared/queue'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { sendWebPush } from '../../shared/web-push'
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
    SendPushToUser,
    SubscribePush,
    UnsubscribePush,
    SendDailyDigests,
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
const invalidateProfileCache = async (userId: string) => {
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
        toast: kind === 'SESSION_NEEDS_INPUT',
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

const getPushConfig = async () => ({ publicKey: vapidKeys()?.publicKey ?? null })

// this browser gets push; turning it on anywhere turns it on for the account
const subscribePush = async (data: SubscribePush) => {
    const { userId, endpoint, p256dh, auth, userAgent } = data

    if (!vapidKeys()) {
        throw new AppError('push is not set up on this server', 503)
    }
    if (!isAllowedPushEndpoint(endpoint)) {
        throw new AppError('this push service is not supported', 400)
    }

    await notificationRepository.upsertPushSubscription({
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent?.slice(0, 300),
    })
    const updated = await notificationRepository.updateNotifyPush(userId, true)
    await invalidateProfileCache(userId)
    return updated
}

// this browser stops; the account stays on while another browser still has push
const unsubscribePush = async (data: UnsubscribePush) => {
    const { userId, endpoint } = data

    await notificationRepository.deletePushSubscription({ userId, endpoint })
    const remaining = await notificationRepository.countPushSubscriptions(userId)
    const updated = await notificationRepository.updateNotifyPush(userId, remaining > 0)
    await invalidateProfileCache(userId)
    return { ...updated, devices: remaining }
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
            if (!isDigestDue({ now, ...user })) continue

            const since = user.lastDigestAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000)
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

export const notificationService = {
    notifyEvent,
    sendPushToUser,
    getPushConfig,
    subscribePush,
    unsubscribePush,
    sendDailyDigests,
    getNotifications,
    getUnreadCount,
    getNotificationById,
    markAsRead,
    deleteNotification,
    sendNotificationToUser,
    deleteAllReadNotification,
    markAllAsRead,
}
