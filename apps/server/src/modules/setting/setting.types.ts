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

export type NotificationSettings = {
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: true
    notifyLevel?: 'ALL' | 'IMPORTANT' | 'NONE'
    notifyEmail?: boolean
    notifyPush?: false
    digestEnabled?: boolean
    digestTime?: string
    timezone?: string
}

export type UpdateNotifications = {
    userId: string
    settings: NotificationSettings
}

export type UpdateModelSource = {
    userId: string
    defaultModelSource: 'CREDITS' | 'OWN_KEY'
}

export type UpdateSessionDefaults = {
    userId: string
    defaultPlanFirst?: boolean
    defaultEffort?: 'fast' | 'deep'
    defaultOpenPullRequest?: boolean
}

export type GetToolDenyRules = {
    userId: string
}

export type UpdateToolDenyRules = {
    userId: string
    rules: string[]
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

/** web preferences kept on the account (#636). messageWhileWorking is the web steeringMode */
export type Preferences = {
    sendKey: 'enter' | 'mod-enter'
    soundOnFinish: boolean
    messageWhileWorking: 'queue' | 'send'
}

export type UpdatePreferences = {
    userId: string
    preferences: Partial<Preferences>
}

export type UpdateSupportAccess = {
    userId: string
    enabled: boolean
}

export type DataExportStatus = 'PENDING' | 'READY' | 'FAILED'

export type DataExportJobData = {
    exportId: string
}

export type RequestDataExport = {
    userId: string
}

export type GetDataExport = {
    userId: string
}

export type ProcessDataExport = {
    exportId: string
}

export type DownloadDataExport = {
    exportId: string
    token: string
}

/** the latest export, for the account page */
export type DataExportState = {
    id: string
    status: DataExportStatus
    createdAt: Date
    expiresAt: Date | null
    // the next time the user can ask for a new export
    nextAllowedAt: Date
}
