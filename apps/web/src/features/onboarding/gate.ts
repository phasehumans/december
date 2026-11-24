import { ONBOARDING_PATH } from './constants'

type OnboardingGateInput = {
    isAuthenticated: boolean
    /** undefined while the profile loads */
    profile: { onboardingCompletedAt?: string | null } | undefined
    pathname: string
    search: string
}

/**
 * where a signed-in user must go before the app: /onboarding until they finish it.
 * Returns null when no redirect is needed. Routes outside the app (/activate, /github/callback)
 * never reach this check.
 */
export const getOnboardingRedirect = (input: OnboardingGateInput): string | null => {
    const { isAuthenticated, profile, pathname, search } = input
    if (!isAuthenticated || !profile) return null
    if (profile.onboardingCompletedAt) return null
    if (pathname === ONBOARDING_PATH) return null

    return `${ONBOARDING_PATH}?redirect=${encodeURIComponent(pathname + search)}`
}
