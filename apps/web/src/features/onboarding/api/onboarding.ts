import { apiRequest } from '@/shared/api/client'

export type OnboardingStep = 'github' | 'start' | 'models'

export const ONBOARDING_STEPS: OnboardingStep[] = ['github', 'start', 'models']

/** each step is done from real data on the server, never because the user skipped it */
export type OnboardingState = {
    completedAt: string | null
    step: OnboardingStep | null
    steps: {
        models: boolean
        github: boolean
    }
    github: { accountLogin: string | null } | null
    wallet: { balanceInCents: number }
    ownKey: { provider: string; keyHint: string } | null
}

const get = () => apiRequest<OnboardingState>('/setting/onboarding')

const update = (data: { step: OnboardingStep }) =>
    apiRequest<OnboardingState>('/setting/onboarding', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })

const complete = () =>
    apiRequest<OnboardingState>('/setting/onboarding/complete', {
        method: 'POST',
    })

export const onboardingAPI = {
    get,
    update,
    complete,
}
