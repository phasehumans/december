import { apiRequest } from '@/shared/api/client'
import { getApiBaseUrl, getGithubAppName } from '@/shared/config/env'

export type Profile = {
    id: string
    name: string
    email: string
    // only the admin's profile says this, with the admin panel's path
    isAdmin?: boolean
    adminPath?: string
    createdAt: string
    updatedAt: string
    emailVerified: boolean
    receiveNotification: boolean
    googleId: string | null
    githubConnected: boolean
    githubAppInstall?: boolean
    githubUsername?: string
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
    // what December tells the user about, and where (#636)
    notifyLevel?: NotifyLevel
    notifyPush?: boolean
    timezone?: string
    memories?: string | null
    rules?: string | null
    avatarUrl?: string | null
    creditBalance?: number
    onboardingCompletedAt?: string | null
    canvasWaitlist?: boolean
    defaultModelSource?: 'CREDITS' | 'OWN_KEY'
    // defaults for a new session (#632)
    defaultPlanFirst?: boolean
    defaultEffort?: 'fast' | 'deep'
    defaultOpenPullRequest?: boolean
    // more defaults for a new session (#637): the model of the user's own key, the
    // repository ('last-used' or a full name) and the base branch ('default' or a name)
    defaultOwnKeyProvider?: string | null
    defaultOwnKeyModel?: string | null
    defaultRepository?: string
    defaultBaseBranch?: string
    // preferences saved on the account (#636), null when none are saved
    preferences?: Partial<AccountPreferences> | null
}

export type AccountPreferences = {
    sendKey: 'enter' | 'mod-enter'
    soundOnFinish: boolean
    messageWhileWorking: 'queue' | 'send'
}

// one signed-in device on the account page (#636)
export type SignedInSession = {
    id: string
    label: string
    kind: 'web' | 'cli'
    lastActiveAt: string
    createdAt: string
    isCurrent: boolean
}

// the latest data export (#636). the link to the file goes out by email
export type DataExport = {
    id: string
    status: 'PENDING' | 'READY' | 'FAILED'
    createdAt: string
    expiresAt: string | null
    nextAllowedAt: string
}

type BackendProfile = Profile
type BackendProject = { id: string; name: string; [key: string]: any }

export type QuickInfo = {
    fullName: string
    githubConnected: boolean
}

type BackendQuickInfo = {
    fullName: string
    isGithubConnected: boolean
}

type UpdateNameInput = {
    name: string
}

type UpdateAvatarUrlInput = {
    avatarUrl: string
}

export type NotifyLevel = 'ALL' | 'IMPORTANT' | 'NONE'

// every field is optional: the page saves one row at a time. security alerts stay on, and
// push turns on through subscribePush
export type UpdateNotificationInput = {
    notifyProductUpdates?: boolean
    notifyLevel?: NotifyLevel
    notifyPush?: false
    timezone?: string
}

const buildUrl = (baseUrl: string, params: Record<string, string>) => {
    const url = new URL(baseUrl)

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
    }

    return url.toString()
}

const getProfile = () => {
    return apiRequest<BackendProfile>('/setting')
}

const updateName = (data: UpdateNameInput) => {
    return apiRequest<BackendProfile>('/setting/name', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateAvatarUrl = (data: UpdateAvatarUrlInput) => {
    return apiRequest<BackendProfile>('/setting/avatar', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateModelSource = (defaultModelSource: 'CREDITS' | 'OWN_KEY') => {
    return apiRequest<{ defaultModelSource: 'CREDITS' | 'OWN_KEY' }>('/setting/model-source', {
        method: 'PATCH',
        body: JSON.stringify({ defaultModelSource }),
    })
}

export type SessionDefaults = {
    defaultPlanFirst: boolean
    defaultEffort: 'fast' | 'deep'
    defaultOpenPullRequest: boolean
    defaultOwnKeyProvider: string | null
    defaultOwnKeyModel: string | null
    defaultRepository: string
    defaultBaseBranch: string
}

// /permissions (#632): tool calls the agent may never make in cloud sessions
const getToolDenyRules = () => apiRequest<{ rules: string[] }>('/setting/permissions')

const updateToolDenyRules = (rules: string[]) =>
    apiRequest<{ rules: string[] }>('/setting/permissions', {
        method: 'PUT',
        body: JSON.stringify({ rules }),
    })

const updateSessionDefaults = (defaults: Partial<SessionDefaults>) => {
    return apiRequest<SessionDefaults>('/setting/defaults', {
        method: 'PATCH',
        body: JSON.stringify(defaults),
    })
}

// how December opens and handles pull requests, and what the GitHub App does (#568)
export type PullRequestSettings = {
    branchPrefix: string
    prDraft: boolean
    prCreate: 'auto' | 'ask'
    prAuthor: 'december' | 'user'
    commitAuthor: 'both' | 'december'
    archiveOnMerge: boolean
    githubCommentsEnabled: boolean
    reviewReplies: 'all' | 'mention' | 'off'
    replyToBots: boolean
    fixFailedChecks: boolean
    autoReview: 'asked' | 'mine' | 'all'
    reviewCadence: 'once' | 'push'
    reviewRepos: string[]
}

const getPullRequestSettings = () => {
    return apiRequest<PullRequestSettings>('/setting/pull-requests')
}

const updatePullRequestSettings = (data: Partial<PullRequestSettings>) => {
    return apiRequest<PullRequestSettings>('/setting/pull-requests', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateNotifications = (data: UpdateNotificationInput) => {
    return apiRequest<BackendProfile>('/setting/notifications', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const getQuickInfo = () => {
    return apiRequest<BackendQuickInfo>('/setting/me').then((info) => ({
        fullName: info.fullName,
        githubConnected: info.isGithubConnected,
    }))
}

const signout = () => {
    return apiRequest<void>('/auth/signout', {
        method: 'POST',
        keepalive: true,
    })
}

const signoutAll = () => {
    return apiRequest<void>('/auth/signout/all', {
        method: 'POST',
    })
}

const listSignedInSessions = () => {
    return apiRequest<SignedInSession[]>('/auth/sessions')
}

const revokeSignedInSession = (id: string) => {
    return apiRequest<{ id: string; isCurrent: boolean }>(`/auth/sessions/${id}`, {
        method: 'DELETE',
    })
}

const updatePreferences = (preferences: Partial<AccountPreferences>) => {
    return apiRequest<{ preferences: Partial<AccountPreferences> | null }>('/setting/preferences', {
        method: 'PATCH',
        body: JSON.stringify(preferences),
    })
}

// browser push (#636). publicKey is null when the server has no push keys
const getPushKey = () => {
    return apiRequest<{ publicKey: string | null }>('/notification/push/key')
}

// does this browser (its push endpoint) have push for the signed-in user
const getPushStatus = (endpoint: string) => {
    return apiRequest<{ subscribed: boolean }>('/notification/push/status', {
        method: 'POST',
        body: JSON.stringify({ endpoint }),
    })
}

const subscribePush = (subscription: PushSubscriptionJSON) => {
    return apiRequest<{ notifyPush: boolean }>('/notification/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ endpoint: subscription.endpoint, keys: subscription.keys }),
    })
}

const unsubscribePush = (endpoint: string) => {
    return apiRequest<{ notifyPush: boolean; devices: number }>('/notification/push/subscribe', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint }),
    })
}

const getDataExport = () => {
    return apiRequest<{ export: DataExport | null }>('/setting/export')
}

const requestDataExport = () => {
    return apiRequest<{ export: DataExport }>('/setting/export', { method: 'POST' })
}

const deleteAccount = () => {
    return apiRequest<void>('/auth/account', {
        method: 'DELETE',
    })
}

// --- memories ---

type UpdateMemoriesInput = {
    memories: string
}

const getMemories = () => {
    return apiRequest<{ memories: string | null }>('/setting/memories')
}

const updateMemories = (data: UpdateMemoriesInput) => {
    return apiRequest<{ memories: string | null }>('/setting/memories', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const deleteMemories = () => {
    return apiRequest<void>('/setting/memories', {
        method: 'DELETE',
    })
}

// --- rules ---

// --- integrations ---

export type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    language: string | null
    description: string | null
    owner: {
        login: string
        avatarUrl: string
    }
    // a GitLab project has the same shape; older responses have no provider (GitHub)
    provider?: 'GITHUB' | 'GITLAB'
}

const getGithubRepos = () => {
    return apiRequest<GithubRepo[]>('/platform/github/repos')
}

export type GitlabStatus = {
    /** false until the server has the GitLab app (#645) */
    available: boolean
    connected: boolean
    username: string | null
}

// does the repository have this branch (#637). the prompt box asks before it starts on the
// default base branch
const checkRepoBranch = (data: {
    repository: string
    branch: string
    provider?: 'GITHUB' | 'GITLAB'
}) => {
    const params = new URLSearchParams({
        repository: data.repository,
        branch: data.branch,
        provider: data.provider ?? 'GITHUB',
    })
    return apiRequest<{ exists: boolean }>(`/platform/repos/branch?${params}`)
}

const getGitlabStatus = () => apiRequest<GitlabStatus>('/integrations/gitlab')

const getGitlabRepos = () => apiRequest<GithubRepo[]>('/platform/gitlab/repos')

const disconnectGitlab = () =>
    apiRequest<void>('/integrations/gitlab', {
        method: 'DELETE',
    })

/** the server sends the browser on to gitlab.com and back to `returnPath` */
const getGitlabConnectUrl = (returnPath?: string) => {
    const path =
        returnPath ??
        (typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/settings/repositories')
    return `${getApiBaseUrl()}/integrations/gitlab/start?redirect=${encodeURIComponent(path)}`
}

const getGithubConnectUrl = (userId: string) => {
    const origin =
        typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null'
            ? window.location.origin
            : ''
    const currentPath =
        typeof window !== 'undefined'
            ? window.location.pathname + window.location.search
            : '/settings/repositories'
    const redirectPath = origin ? `${origin}${currentPath}` : currentPath
    const appName = getGithubAppName() || 'trydecember'
    const stateVal = userId ? `${userId}|${redirectPath}` : redirectPath
    return `https://github.com/apps/${appName}/installations/new?state=${encodeURIComponent(stateVal)}`
}

const submitFeedback = (data: { rating: 'sad' | 'neutral' | 'happy' | null; feedback: string }) => {
    return apiRequest<{ message: string }>('/setting/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const createGithubRepo = (
    projectId: string,
    data: { name: string; private: boolean; description?: string }
) => {
    return apiRequest<BackendProject>(`/platform/projects/${projectId}/github/repository`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const syncGithubRepo = (projectId: string, data: { commitMessage?: string }) => {
    return apiRequest<BackendProject>(`/platform/projects/${projectId}/github/sync`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export const profileAPI = {
    getProfile,
    updateName,
    updateAvatarUrl,
    updateNotifications,
    updateModelSource,
    updateSessionDefaults,
    getToolDenyRules,
    updateToolDenyRules,
    getPullRequestSettings,
    updatePullRequestSettings,
    getQuickInfo,
    signout,
    signoutAll,
    listSignedInSessions,
    revokeSignedInSession,
    updatePreferences,
    getDataExport,
    requestDataExport,
    getPushKey,
    getPushStatus,
    subscribePush,
    unsubscribePush,
    deleteAccount,
    getMemories,
    updateMemories,
    deleteMemories,
    getGithubRepos,
    checkRepoBranch,
    getGithubConnectUrl,
    getGitlabStatus,
    getGitlabRepos,
    disconnectGitlab,
    getGitlabConnectUrl,
    submitFeedback,
    createGithubRepo,
    syncGithubRepo,
}
