import type { WaitlistState } from '../api/waitlist'

export const SUPER_CREW_POPUP_DELAY_MS = 3000

interface AutoPopupInput {
    isAuthenticated: boolean
    isHome: boolean
    isOpen: boolean
    /** phones never get the popup: the card opens only from the menu */
    isPhone: boolean
    state: WaitlistState | undefined
}

// the card opens by itself once per account, only on home and never on phones. the server already folds the
// onboarding rule into canShowPopup (onboarding complete and never shown before).
export const shouldAutoOpenSuperCrew = (input: AutoPopupInput) => {
    const { isAuthenticated, isHome, isOpen, isPhone, state } = input
    if (!isAuthenticated || !isHome || isOpen || isPhone || !state) return false
    return state.canShowPopup
}
