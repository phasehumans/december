import { apiRequest } from '@/shared/api/client'

export type WaitlistFeature = 'super-crew'

export interface WaitlistState {
    feature: WaitlistFeature
    joined: boolean
    joinedAt: string | null
    popupSeen: boolean
    canShowPopup: boolean
}

const getState = (feature: WaitlistFeature) => apiRequest<WaitlistState>(`/waitlist/${feature}`)

const join = (feature: WaitlistFeature) =>
    apiRequest<WaitlistState>(`/waitlist/${feature}/join`, { method: 'POST' })

const markSeen = (feature: WaitlistFeature) =>
    apiRequest<WaitlistState>(`/waitlist/${feature}/seen`, { method: 'POST' })

// admin only (#630): the server checks ADMIN_EMAILS on every call

export interface WaitlistAdminEntry {
    userId: string
    name: string
    email: string
    joinedAt: string | null
    notifiedAt: string | null
}

export interface WaitlistAdminList {
    feature: WaitlistFeature
    joinedCount: number
    notifiedCount: number
    items: WaitlistAdminEntry[]
}

export interface WaitlistLaunchResult {
    sentCount: number
    failedCount: number
}

export interface WaitlistLaunchInput {
    subject: string
    body: string
    inboxMessage: string
}

const listEntries = (feature: WaitlistFeature) =>
    apiRequest<WaitlistAdminList>(`/waitlist/${feature}/admin`)

const launch = (feature: WaitlistFeature, input: WaitlistLaunchInput) =>
    apiRequest<WaitlistLaunchResult>(`/waitlist/${feature}/admin/launch`, {
        method: 'POST',
        body: JSON.stringify(input),
    })

export const waitlistAPI = { getState, join, markSeen, listEntries, launch }
