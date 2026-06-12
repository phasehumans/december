import { API_BASE_URL, apiRequest } from '@/shared/api/client'
import { type BackendProject } from '@/features/projects/api/project'

export type Profile = {
    id: string
    name: string
    username: string
    email: string
    createdAt: string
    updatedAt: string
    emailVerified: boolean
    receiveNotification: boolean
    googleId: string | null
    githubConnected: boolean
    githubUsername?: string
    vercelConnected?: boolean
    vercelTeamId?: string | null
    vercelConfigurationId?: string | null
    supabaseConnected?: boolean
    supabaseUserId?: string | null
    supabaseConnectedAt?: string | null
    notionWorkspaceId?: string | null
    notionWorkspaceName?: string | null
    figmaConnected?: boolean
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
    chatSuggestions?: boolean
    generationSound?: 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER'
    memories?: string | null
    design?: string | null
    avatarUrl?: string | null
    subscriptionPlan?: 'FREE' | 'PRO'
    subscriptionStatus?: 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED'
    hasCompletedOnboarding?: boolean
}

type BackendProfile = Profile

export type QuickInfo = {
    firstName: string
    githubConnected: boolean
}

type BackendQuickInfo = {
    firstName: string
    isGithubConnected: boolean
}

type UpdateNameInput = {
    name: string
}

type UpdateUsernameInput = {
    username: string
}

type UpdateAvatarUrlInput = {
    avatarUrl: string
}

type ChangePasswordInput = {
    currentPassword: string
    newPassword: string
}

type UpdateNotificationInput = {
    notifyProjectActivity?: boolean
    notifyProductUpdates?: boolean
    notifySecurityAlerts?: boolean
}

type UpdateChatSuggestionsInput = {
    chatSuggestions: boolean
}

type UpdateGenerationSoundInput = {
    generationSound: 'FIRST_GENERATION' | 'ALWAYS' | 'NEVER'
}

type ClientRuntimeEnv = {
    process?: {
        env?: Record<string, string | undefined>
    }
    Bun?: {
        env?: Record<string, string | undefined>
    }
    __ENV__?: Record<string, string | undefined>
}

const getClientEnv = (key: string) => {
    const runtime = globalThis as typeof globalThis & ClientRuntimeEnv

    return runtime.Bun?.env?.[key] ?? runtime.process?.env?.[key] ?? runtime.__ENV__?.[key]
}

const getGithubClientId = () =>
    getClientEnv('GITHUB_CLIENT_ID') ??
    getClientEnv('PUBLIC_GITHUB_CLIENT_ID') ??
    'Ov23liFGkTAwCW7E8gtk'

const getVercelIntegrationSlug = () =>
    getClientEnv('VERCEL_INTEGRATION_SLUG') ??
    getClientEnv('PUBLIC_VERCEL_INTEGRATION_SLUG') ??
    'december'

const buildUrl = (baseUrl: string, params: Record<string, string>) => {
    const url = new URL(baseUrl)

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value)
    }

    return url.toString()
}

const getProfile = () => {
    return apiRequest<BackendProfile>('/profile')
}

const updateName = (data: UpdateNameInput) => {
    return apiRequest<BackendProfile>('/profile/name', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateUsername = (data: UpdateUsernameInput) => {
    return apiRequest<BackendProfile>('/profile/username', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateAvatarUrl = (data: UpdateAvatarUrlInput) => {
    return apiRequest<BackendProfile>('/profile/avatar', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const changePassword = (data: ChangePasswordInput) => {
    return apiRequest<BackendProfile>('/profile/password', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateNotifications = (data: UpdateNotificationInput) => {
    return apiRequest<BackendProfile>('/profile/notifications', {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateChatSuggestions = (data: UpdateChatSuggestionsInput) => {
    return apiRequest<BackendProfile>('/profile/suggestions', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const updateGenerationSound = (data: UpdateGenerationSoundInput) => {
    return apiRequest<BackendProfile>('/profile/sound', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const getQuickInfo = () => {
    return apiRequest<BackendQuickInfo>('/profile/info').then((info) => ({
        firstName: info.firstName,
        githubConnected: info.isGithubConnected,
    }))
}

const signout = () => {
    return apiRequest<void>('/profile/signout', {
        method: 'POST',
    })
}

const signoutAll = () => {
    return apiRequest<void>('/profile/signout/all', {
        method: 'POST',
    })
}

const deleteAccount = () => {
    return apiRequest<void>('/profile', {
        method: 'DELETE',
    })
}

// --- Memories ---

type UpdateMemoriesInput = {
    memories: string
}

const getMemories = () => {
    return apiRequest<{ memories: string | null }>('/profile/memories')
}

const updateMemories = (data: UpdateMemoriesInput) => {
    return apiRequest<{ memories: string | null }>('/profile/memories', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const deleteMemories = () => {
    return apiRequest<void>('/profile/memories', {
        method: 'DELETE',
    })
}

// --- design ---

type UpdatedesignInput = {
    design: string
}

const getdesign = () => {
    return apiRequest<{ design: string | null }>('/profile/design')
}

const updatedesign = (data: UpdatedesignInput) => {
    return apiRequest<{ design: string | null }>('/profile/design', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const deletedesign = () => {
    return apiRequest<void>('/profile/design', {
        method: 'DELETE',
    })
}

// --- Integrations ---

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
}

const getGithubRepos = () => {
    return apiRequest<GithubRepo[]>('/integrations/github/repos')
}

const getGithubConnectUrl = (userId: string) => {
    return buildUrl('https://github.com/login/oauth/authorize', {
        client_id: getGithubClientId(),
        scope: 'repo',
        state: userId,
    })
}

const getVercelConnectUrl = (userId: string) => {
    return buildUrl(`https://vercel.com/integrations/${getVercelIntegrationSlug()}/new`, {
        state: userId,
    })
}

const getSupabaseConnectUrl = () => {
    return `${API_BASE_URL}/integrations/supabase/connect`
}

const getNotionConnectUrl = () => {
    return `${API_BASE_URL}/integrations/notion/connect`
}

const getFigmaConnectUrl = () => {
    return `${API_BASE_URL}/integrations/figma/connect`
}

const submitFeedback = (data: { rating: 'sad' | 'neutral' | 'happy' | null; feedback: string }) => {
    return apiRequest<{ message: string }>('/profile/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const completeOnboarding = () => {
    return apiRequest<BackendProfile>('/profile/onboarding', {
        method: 'PATCH',
    })
}

const createGithubRepo = (
    projectId: string,
    data: { name: string; private: boolean; description?: string }
) => {
    return apiRequest<BackendProject>(`/integrations/projects/${projectId}/github/repository`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const syncGithubRepo = (projectId: string, data: { commitMessage?: string }) => {
    return apiRequest<BackendProject>(`/integrations/projects/${projectId}/github/sync`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export const profileAPI = {
    getProfile,
    updateName,
    updateUsername,
    updateAvatarUrl,
    changePassword,
    updateNotifications,
    updateChatSuggestions,
    updateGenerationSound,
    getQuickInfo,
    signout,
    signoutAll,
    deleteAccount,
    getMemories,
    updateMemories,
    deleteMemories,
    getdesign,
    updatedesign,
    deletedesign,
    getGithubRepos,
    getGithubConnectUrl,
    getVercelConnectUrl,
    getSupabaseConnectUrl,
    getNotionConnectUrl,
    getFigmaConnectUrl,
    submitFeedback,
    completeOnboarding,
    createGithubRepo,
    syncGithubRepo,
}
