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

export type MarkAllAsRead = {
    userId: string
}

export type DeleteAllReadNotification = {
    userId: string
}

export type NotifyLevel = 'ALL' | 'IMPORTANT' | 'NONE'

/** the events that reach email and push (#636). all but SESSION_FINISHED are important */
export type NotifyEventKind =
    | 'SESSION_FINISHED'
    | 'SESSION_NEEDS_INPUT'
    | 'SESSION_FAILED'
    | 'LOW_CREDITS'

export type NotifyEvent = {
    userId: string
    kind: NotifyEventKind
    sessionId?: string
    sessionTitle?: string | null
    // the error of a failed run, or the balance in cents for low credits
    detail?: string
    // the user has the session open: the inbox gets it, email and push do not
    isWatching?: boolean
}

export type NotifyEventMessage = {
    title: string
    message: string
    type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
    // the app path the inbox row, the email and the push open
    path: string
    emailSubject: string
    emailBody: string
}

export type SendPushToUser = {
    userId: string
    payload: { title: string; body: string; url: string; tag: string }
    urgency?: 'normal' | 'high'
}

export type SubscribePush = {
    userId: string
    endpoint: string
    p256dh: string
    auth: string
    userAgent?: string
}

export type UnsubscribePush = {
    userId: string
    endpoint: string
}

export type SendDailyDigests = {
    now?: Date
}

export type DigestSummary = {
    sessionsWorkedOn: number
    pullRequestsOpened: number
    creditsUsedCents: number
}
