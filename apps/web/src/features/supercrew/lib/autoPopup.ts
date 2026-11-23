import type { WaitlistState } from '../api/waitlist'

export const SUPER_CREW_POPUP_DELAY_MS = 3000

interface AutoPopupInput {
    isAuthenticated: boolean
    isHome: boolean
    isOpen: boolean
    state: WaitlistState | undefined
}

// the card opens by itself once per account, only on home. the server already folds the
// onboarding rule into canShowPopup (onboarding complete and never shown before).
export const shouldAutoOpenSuperCrew = (input: AutoPopupInput) => {
    const { isAuthenticated, isHome, isOpen, state } = input
    if (!isAuthenticated || !isHome || isOpen || !state) return false
    return state.canShowPopup
}
