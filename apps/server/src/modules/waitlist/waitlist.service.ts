import { AppError } from '../../shared/appError'

import { waitlistRepository } from './waitlist.repository'

import type { GetWaitlistState, JoinWaitlist, MarkPopupSeen, WaitlistState } from './waitlist.types'

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

export const waitlistService = {
    getState,
    join,
    markPopupSeen,
}
