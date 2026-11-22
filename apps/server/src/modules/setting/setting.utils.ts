import type { OnboardingStep } from './setting.types'

export const sanitizeMarkdown = (str: string): string => {
    return str
        .replace(/[\r\n]+/g, ' ') // replace newlines with spaces to prevent log/section breakout
        .replace(/([\\`*_{}[\]()#+\-.!])/g, '\\$1') // escape all markdown special characters
}

const ONBOARDING_STEPS: OnboardingStep[] = ['github', 'start', 'models']

/** a saved step name, or null for anything that is not a current step */
export const toOnboardingStep = (value: string | null): OnboardingStep | null =>
    ONBOARDING_STEPS.find((step) => step === value) ?? null
