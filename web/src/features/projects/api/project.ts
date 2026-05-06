import { ApiError, apiFetch, apiRequest } from '@/shared/api/client'
import type { CanvasDocument } from '@/features/canvas/types'

export type BackendProject = {
    id: string
    name: string
    description: string | null
    prompt: string
    isStarred: boolean
    projectStatus: 'DRAFT' | 'GENERATING' | 'READY' | 'DEPLOYED' | 'FAILED'
    versionCount?: number
    currentVersionId?: string | null
    createdAt: string
    updatedAt: string
    userId: string
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
    status?: 'thinking' | 'planning' | 'building' | 'done' | 'error' | null
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
    rename?: string
    isStarred?: boolean
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

const deleteProject = (projectId: string) => {
    return apiRequest<{ message: string }>(`/project/${projectId}`, {
        method: 'DELETE',
    })
}

const duplicateProject = (projectId: string) => {
    return apiRequest<BackendProject>(`/project/${projectId}/duplicate`, {
        method: 'POST',
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
    deleteProject,
    duplicateProject,
    downloadProject,
}
