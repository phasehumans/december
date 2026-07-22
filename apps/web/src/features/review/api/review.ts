import { apiRequest } from '@/shared/api/client'

export type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
export type ReviewProvider = 'GITHUB' | 'GITLAB'
export type ReviewStrictness = 'LENIENT' | 'STANDARD' | 'STRICT'

export type ReviewFinding = {
    id: string
    severity: 'CRITICAL' | 'WARNING' | 'INFO'
    category: string
    filePath: string
    lineNumber: number
    title: string
    description: string
    originalSnippet?: string
    proposedSnippet?: string
}

export type PullRequestReview = {
    id: string
    userId: string
    sessionId?: string | null
    prUrl: string
    prNumber: number
    repository: string
    provider: ReviewProvider
    title: string
    author: string
    authorAvatar?: string | null
    status: ReviewStatus
    isAutoReview: boolean
    score: number
    summary?: string | null
    findings: ReviewFinding[]
    preferences?: Record<string, any>
    createdAt: string
    updatedAt: string
}

export type ReviewPreference = {
    id: string
    userId: string
    autoReviewAgentPrs: boolean
    defaultStrictness: ReviewStrictness
    focusAreas: string[]
    createdAt: string
    updatedAt: string
}

export type GetReviewsFilters = {
    repository?: string
    status?: string
    isAutoReview?: boolean
    search?: string
    page?: number
    limit?: number
}

export const reviewAPI = {
    getReviews: async (filters?: GetReviewsFilters) => {
        const params = new URLSearchParams()
        if (filters?.repository) params.append('repository', filters.repository)
        if (filters?.status) params.append('status', filters.status)
        if (typeof filters?.isAutoReview === 'boolean')
            params.append('isAutoReview', String(filters.isAutoReview))
        if (filters?.search) params.append('search', filters.search)
        if (filters?.page) params.append('page', String(filters.page))
        if (filters?.limit) params.append('limit', String(filters.limit))

        const queryString = params.toString()
        const url = `/api/v1/reviews${queryString ? `?${queryString}` : ''}`
        return apiRequest<{ reviews: PullRequestReview[]; pagination: any }>(url)
    },

    getReviewById: async (id: string) => {
        return apiRequest<PullRequestReview>(`/api/v1/reviews/${id}`)
    },

    submitReview: async (prUrl: string, sessionId?: string) => {
        return apiRequest<PullRequestReview>('/api/v1/reviews', {
            method: 'POST',
            body: JSON.stringify({ prUrl, sessionId }),
        })
    },

    deleteReview: async (id: string) => {
        return apiRequest<{ success: boolean }>(`/api/v1/reviews/${id}`, {
            method: 'DELETE',
        })
    },

    getPreferences: async () => {
        return apiRequest<ReviewPreference>('/api/v1/reviews/preferences')
    },

    updatePreferences: async (data: Partial<ReviewPreference>) => {
        return apiRequest<ReviewPreference>('/api/v1/reviews/preferences', {
            method: 'PUT',
            body: JSON.stringify(data),
        })
    },
}
