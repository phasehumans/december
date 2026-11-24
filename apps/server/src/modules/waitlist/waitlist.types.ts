import type { WaitlistFeature } from './waitlist.schema'

export type GetWaitlistState = {
    userId: string
    feature: WaitlistFeature
}

export type JoinWaitlist = {
    userId: string
    feature: WaitlistFeature
}

export type MarkPopupSeen = {
    userId: string
    feature: WaitlistFeature
}

export type WaitlistState = {
    feature: WaitlistFeature
    joined: boolean
    joinedAt: string | null
    popupSeen: boolean
    canShowPopup: boolean
}

export type ListWaitlistEntries = {
    feature: WaitlistFeature
}

export type WaitlistAdminEntry = {
    userId: string
    name: string
    email: string
    joinedAt: string | null
    notifiedAt: string | null
}

export type LaunchWaitlist = {
    adminUserId: string
    feature: WaitlistFeature
    subject: string
    body: string
    inboxMessage: string
}

export type WaitlistLaunchResult = {
    sentCount: number
    failedCount: number
}

export type WaitlistAdminList = {
    feature: WaitlistFeature
    joinedCount: number
    notifiedCount: number
    items: WaitlistAdminEntry[]
}
