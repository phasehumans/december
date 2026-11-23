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

export const waitlistAPI = { getState, join, markSeen }
