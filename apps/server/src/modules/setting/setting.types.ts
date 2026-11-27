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
    notifyPush?: false
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
    // the model of the user's own key (#637). null for both: no default
    defaultOwnKeyProvider?: string | null
    defaultOwnKeyModel?: string | null
    // 'last-used' or a repository full name
    defaultRepository?: string
    // 'default' or a branch name
    defaultBaseBranch?: string
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
    // false while the queue will run the job again after a failure. default: true
    isLastAttempt?: boolean
}

export type TellDataExportFailed = {
    userId: string
}

export type PurgeDataExports = {
    now?: Date
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

/** the setup commands of one repository: they run after the clone in a new sandbox (#637) */
export type RepositorySetupCommands = {
    repoFullName: string
    commands: string
}

/** the sandbox settings of a user (#637) */
export type SandboxSettings = {
    idleStopMinutes: 10 | 30 | 60
    // null: never archive
    archiveAfterDays: 7 | 30 | null
    setupCommands: RepositorySetupCommands[]
}

export type GetSandboxSettings = {
    userId: string
}

export type UpdateSandboxSettings = {
    userId: string
    settings: {
        idleStopMinutes?: 10 | 30 | 60
        archiveAfterDays?: 7 | 30 | null
    }
}

export type UpdateSetupCommands = {
    userId: string
    repoFullName: string
    commands: string
}

export type ArchiveInactiveSessions = {
    now?: Date
}
