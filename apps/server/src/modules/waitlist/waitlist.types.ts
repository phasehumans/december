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
