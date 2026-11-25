import type { BillingSource } from '@/features/home/model-selection'

/**
 * True when a prompt cannot run because December credits are needed and there are none.
 * A run on the user's own key is paid by the provider of the key, so the balance does
 * not block it. `remainingInCents` is undefined while the balance is not known.
 */
export const isBlockedByCredits = (data: {
    source: BillingSource
    unlimited: boolean
    remainingInCents: number | undefined
}): boolean => {
    const { source, unlimited, remainingInCents } = data
    if (source === 'OWN_KEY' || unlimited || remainingInCents === undefined) return false
    return remainingInCents <= 0
}

/**
 * True when the open session shows "low credits": it runs on December credits and under
 * 10 cents are left. A session on the user's own key does not use the balance, so it
 * shows nothing. At zero the out of credits card shows in its place.
 */
export const isLowOnCredits = (data: {
    source: BillingSource
    unlimited: boolean
    remainingInCents: number | undefined
}): boolean => {
    const { source, unlimited, remainingInCents } = data
    if (source === 'OWN_KEY' || unlimited || remainingInCents === undefined) return false
    return remainingInCents > 0 && remainingInCents < 10
}
