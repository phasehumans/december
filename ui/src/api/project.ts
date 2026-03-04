import { apiRequest } from './client'

export type BackendProject = {
    id: string
    name: string
    description: string | null
    prompt: string
    isStarred: boolean
    projectStatus: 'DRAFT' | 'GENERATING' | 'READY' | 'DEPLOYED' | 'FAILED'
    createdAt: string
    updatedAt: string
    userId: string
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

const getProjects = () => {
    return apiRequest<BackendProject[]>('/project')
}

const getProject = (projectId: string) => {
    return apiRequest<BackendProject>(`/project/${projectId}`)
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
    return apiRequest<BackendProject>(`/project/${projectId}`, {
        method: 'DELETE',
    })
}

export const projectAPI = {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
}
