import type { BackendProject } from '@/features/projects/api/project'

import { apiRequest } from '@/shared/api/client'

export type BackendTemplate = {
    id: string
    name: string
    description: string | null
    prompt: string
    isFeatured: boolean
    projectCategory: string
    createdAt: string
    updatedAt: string
    userId: string
    authorName: string
    authorUsername: string
    likeCount: number
    isLiked: boolean
}

type ToggleLikeResult = {
    id: string
    userId: string
    projectId: string
    isLiked: boolean
    createdAt: string
}

const getTemplates = () => {
    return apiRequest<BackendTemplate[]>('/template')
}

const getFeaturedTemplates = () => {
    return apiRequest<BackendTemplate[]>('/template/featured')
}

const getTemplateById = (templateId: string) => {
    return apiRequest<BackendTemplate>(`/template/${templateId}`)
}

const toggleLike = (templateId: string, isLiked: boolean) => {
    return apiRequest<ToggleLikeResult>(`/template/${templateId}/like`, {
        method: 'POST',
        body: JSON.stringify({ isLiked }),
    })
}

const remixTemplate = (templateId: string) => {
    return apiRequest<BackendProject>(`/template/${templateId}/remix`, {
        method: 'POST',
    })
}

export const templateAPI = {
    getTemplates,
    getFeaturedTemplates,
    getTemplateById,
    toggleLike,
    remixTemplate,
}
