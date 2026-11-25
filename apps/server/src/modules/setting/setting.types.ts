import type { PullRequestSettingsValues } from '@december/shared'

export type GetMe = {
    userId: string
}

export type GetProfile = {
    userId: string
}

export type UpdateName = {
    userId: string
    name: string
}

export type UpdateNotifications = {
    userId: string
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

export type UpdateModelSource = {
    userId: string
    defaultModelSource: 'CREDITS' | 'OWN_KEY'
}

export type OnboardingStep = 'github' | 'start' | 'models'

export type GetOnboarding = {
    userId: string
}

export type UpdateOnboarding = {
    userId: string
    step: OnboardingStep
}

export type CompleteOnboarding = {
    userId: string
}

/** what the /onboarding page needs. Each step is done from real data. */
export type OnboardingState = {
    completedAt: Date | null
    step: OnboardingStep | null
    steps: {
        models: boolean
        // a connected git host: github (app or oauth) or gitlab
        github: boolean
    }
    github: { accountLogin: string | null } | null
    gitlab: { username: string } | null
    wallet: { balanceInCents: number }
    ownKey: { provider: string; keyHint: string } | null
}

export type Unsubscribe = {
    userId: string
    token: string
}

export type SubmitFeedback = {
    userId: string
    rating: 'sad' | 'neutral' | 'happy' | null
    feedback: string
}

export type GetPullRequestSettings = {
    userId: string
}

export type UpdatePullRequestSettings = {
    userId: string
    settings: Partial<PullRequestSettingsValues>
}
