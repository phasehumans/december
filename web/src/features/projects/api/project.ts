import type { CanvasDocument } from '@/features/canvas/types'

import { ApiError, apiFetch, apiRequest } from '@/shared/api/client'

export type BackendProject = {
    id: string
    name: string
    description: string | null
    prompt: string
    isStarred: boolean
    isSharedAsTemplate: boolean
    projectStatus: 'DRAFT' | 'GENERATING' | 'READY' | 'DEPLOYED' | 'FAILED'
    versionCount?: number
    currentVersionId?: string | null
    createdAt: string
    updatedAt: string
    userId: string
    user?: {
        username: string
    }
    githubRepoName?: string | null
    githubRepoOwner?: string | null
    githubRepoUrl?: string | null
    githubLastSyncedAt?: string | null
}

export type BackendProjectVersionSummary = {
    id: string
    versionNumber: number
    label: string
    sourcePrompt: string
    summary: string | null
    status: 'GENERATING' | 'READY' | 'FAILED'
    objectStoragePrefix: string
    fileCount: number
    createdAt: string
    updatedAt: string
}

export type BackendProjectMessage = {
    id: string
    role: 'USER' | 'ASSISTANT' | 'SYSTEM'
    content: string
    status?: 'thinking' | 'building' | 'done' | 'error' | null
    sequence: number
    createdAt: string
    updatedAt: string
}

export type BackendProjectDetail = {
    project: BackendProject
    versions: BackendProjectVersionSummary[]
    selectedVersionId: string | null
    activeVersion:
        | (BackendProjectVersionSummary & {
              intent: unknown
              plan: unknown
          })
        | null
    chatMessages: BackendProjectMessage[]
    generatedFiles: Record<string, string>
    canvasState: CanvasDocument
}

type CreateProjectInput = {
    name: string
    description?: string
    prompt: string
}

type UpdateProjectInput = {
    rename: string
}

type UpdateGeneralSettingsInput = {
    name?: string
    description?: string | null
    isStarred?: boolean
    isSharedAsTemplate?: boolean
    projectCategory?:
        | 'LANDING_PAGE'
        | 'DASHBOARD'
        | 'PORTFOLIO_BLOG'
        | 'SAAS_APP'
        | 'ECOMMERCE'
        | 'NONE'
}

const buildVersionQuery = (versionId?: string | null) =>
    versionId ? `?versionId=${encodeURIComponent(versionId)}` : ''

const getProjects = () => {
    return apiRequest<BackendProject[]>('/project')
}

const getProject = (projectId: string, versionId?: string | null) => {
    return apiRequest<BackendProjectDetail>(`/project/${projectId}${buildVersionQuery(versionId)}`)
}

const createProject = (data: CreateProjectInput) => {
    return apiRequest<BackendProject>('/project', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

const updateProject = (projectId: string, data: UpdateProjectInput) => {
    return apiRequest<{ message: string }>(`/project/${projectId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const updateGeneralSettings = (projectId: string, data: UpdateGeneralSettingsInput) => {
    return apiRequest<{ message: string }>(`/project/${projectId}/general-settings`, {
        method: 'PATCH',
        body: JSON.stringify(data),
    })
}

const toggleStarProject = (projectId: string, isStarred: boolean) => {
    return apiRequest<{ message: string }>(`/project/${projectId}/star`, {
        method: 'POST',
        body: JSON.stringify({ isStarred }),
    })
}

const deleteProject = (projectId: string) => {
    return apiRequest<{ message: string }>(`/project/${projectId}`, {
        method: 'DELETE',
    })
}

const duplicateProject = (projectId: string, name?: string) => {
    return apiRequest<BackendProject>(`/project/${projectId}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name }),
    })
}

const shareProjectAsTemplate = (
    projectId: string,
    isSharedAsTemplate: boolean,
    projectCategory?: string
) => {
    return apiRequest<{ message: string }>(`/project/${projectId}/share`, {
        method: 'POST',
        body: JSON.stringify({ isSharedAsTemplate, projectCategory }),
    })
}

const downloadProject = async (projectId: string, versionId?: string | null) => {
    const res = await apiFetch(`/project/${projectId}/download${buildVersionQuery(versionId)}`, {})

    if (!res.ok) {
        let payload: { message?: string; errors?: unknown } | null = null

        try {
            payload = await res.json()
        } catch {
            payload = null
        }

        const message =
            (typeof payload?.errors === 'string' && payload.errors) ||
            payload?.message ||
            `Request failed with status ${res.status}`

        throw new ApiError(message, res.status, payload?.errors)
    }

    return {
        blob: await res.blob(),
        fileName:
            res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] ??
            `${projectId}.zip`,
    }
}

export const projectAPI = {
    getProjects,
    getProject,
    createProject,
    updateProject,
    updateGeneralSettings,
    deleteProject,
    duplicateProject,
    shareProjectAsTemplate,
    toggleStarProject,
    downloadProject,
}
