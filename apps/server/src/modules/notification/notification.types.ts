export type NotificationCategory = 'GENERAL' | 'MENTION'

export type GetNotifications = {
    userId: string
    page?: number
    limit?: number
    isRead?: boolean
    category?: NotificationCategory
}

export type GetUnreadCount = {
    userId: string
}

export type GetNotificationById = {
    userId: string
    id: string
}

export type MarkAsRead = {
    userId: string
    id: string
}

export type DeleteNotification = {
    userId: string
    id: string
}

export type SendNotificationToUser = {
    userId: string
    title: string
    message: string
    type?: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    link?: string
    category?: NotificationCategory
    // show a toast in open tabs (mentions, replies, agent questions)
    toast?: boolean
}

// admin events go to the admins' December inbox, never to their email
export type SendNotificationToAdmins = Omit<SendNotificationToUser, 'userId'>

// skipped while an unread item with the same title and link is in the inbox
export type SendNotificationOnce = SendNotificationToUser

export type MarkSessionRead = {
    userId: string
    sessionId: string
}

export type MarkAllAsRead = {
    userId: string
}

export type DeleteAllReadNotification = {
    userId: string
}

export type NotifyLevel = 'ALL' | 'IMPORTANT' | 'NONE'

/** the events that reach the inbox and push (#636). all but SESSION_FINISHED are important */
export type NotifyEventKind =
    | 'SESSION_FINISHED'
    | 'SESSION_NEEDS_INPUT'
    | 'SESSION_FAILED'
    | 'LOW_CREDITS'
    // a session is paused at a spend limit and asks to continue (#638)
    | 'SPEND_LIMIT'

export type NotifyEvent = {
    userId: string
    kind: NotifyEventKind
    sessionId?: string
    sessionTitle?: string | null
    // the error of a failed run, the balance in cents for low credits, or the question of
    // a spend limit ("Reached $5. Continue?")
    detail?: string
    // the user has the session open: the inbox gets it, email and push do not
    isWatching?: boolean
}

export type NotifyLowCredits = {
    userId: string
    // the balance after the charge that took it under the alert amount
    balanceInCents: number
}

export type NotifyEventMessage = {
    title: string
    message: string
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    // the app path the inbox row and the push open
    path: string
}

export type SendPushToUser = {
    userId: string
    payload: { title: string; body: string; url: string; tag: string }
    urgency?: 'normal' | 'high'
}

export type InvalidateProfileCache = {
    userId: string
}

export type GetPushConfig = Record<string, never>

export type GetPushStatus = {
    userId: string
    endpoint: string
}

export type SubscribePush = {
    userId: string
    // the sign-in of the browser. push stops when this sign-in ends
    authSessionId?: string
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string
}

export type UnsubscribePush = {
    userId: string
    endpoint: string
}

export type RemovePushOnSignOut = {
    userId: string
    // the sign-in that ended. with none, every browser of the user (sign out everywhere)
    authSessionId?: string
}
