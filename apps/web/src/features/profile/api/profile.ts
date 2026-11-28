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
    creditBalance?: number
    onboardingCompletedAt?: string | null
    canvasWaitlist?: boolean
    defaultModelSource?: 'CREDITS' | 'OWN_KEY'
    // "save as default" in the prompt box (#632)
    defaultPlanFirst?: boolean
    defaultOpenPullRequest?: boolean
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

const updateModelSource = (defaultModelSource: 'CREDITS' | 'OWN_KEY') => {
    return apiRequest<{ defaultModelSource: 'CREDITS' | 'OWN_KEY' }>('/setting/model-source', {
        method: 'PATCH',
        body: JSON.stringify({ defaultModelSource }),
    })
}

export type SessionDefaults = {
    defaultPlanFirst: boolean
    defaultOpenPullRequest: boolean
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
    prAuthor: 'december' | 'user'
    commitAuthor: 'both' | 'december'
    githubCommentsEnabled: boolean
    reviewReplies: 'all' | 'mention' | 'off'
    fixFailedChecks: boolean
    autoReview: 'asked' | 'mine' | 'all'
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

const deleteAccount = () => {
    return apiRequest<void>('/auth/account', {
        method: 'DELETE',
    })
}

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

/** the repositories of one git host (B1, B12): all of them, up to 1,000 */
export type RepoList = {
    repos: GithubRepo[]
    /** github accounts whose install could not be read (removed or suspended) */
    unavailable: string[]
    /** true when the host has more than 1,000 */
    truncated: boolean
}

/**
 * Reads a repository list from the server or the query cache. An older server, a cache saved
 * before the list had its own fields and a test can all give a plain array.
 */
export const toRepoList = (data: unknown): RepoList => {
    if (Array.isArray(data))
        return { repos: data as GithubRepo[], unavailable: [], truncated: false }
    const list = data as Partial<RepoList> | null | undefined
    return {
        repos: Array.isArray(list?.repos) ? list.repos : [],
        unavailable: Array.isArray(list?.unavailable) ? list.unavailable : [],
        truncated: Boolean(list?.truncated),
    }
}

const getGithubRepos = async () => toRepoList(await apiRequest<unknown>('/platform/github/repos'))

export type GitlabStatus = {
    /** false until the server has the GitLab app (#645) */
    available: boolean
    connected: boolean
    username: string | null
}

const getGitlabStatus = () => apiRequest<GitlabStatus>('/integrations/gitlab')

const getGitlabRepos = async () => toRepoList(await apiRequest<unknown>('/platform/gitlab/repos'))

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

const getGithubConnectUrl = () => {
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
    // only the page to come back to: the server takes the user from the sign-in cookie (V5)
    return `https://github.com/apps/${appName}/installations/new?state=${encodeURIComponent(redirectPath)}`
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
    getPushKey,
    getPushStatus,
    subscribePush,
    unsubscribePush,
    deleteAccount,
    getGithubRepos,
    getGithubConnectUrl,
    getGitlabStatus,
    getGitlabRepos,
    disconnectGitlab,
    getGitlabConnectUrl,
    submitFeedback,
    createGithubRepo,
    syncGithubRepo,
}
