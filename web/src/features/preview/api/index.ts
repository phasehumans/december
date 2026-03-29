import { apiRequest } from '@/shared/api/client'
import type { PreviewSessionStatus } from '@/features/preview/types'

const startPreview = (projectId: string, versionId?: string | null) => {
    return apiRequest<PreviewSessionStatus>('/runtime/previews/start', {
        method: 'POST',
        body: JSON.stringify({
            projectId,
            ...(versionId ? { versionId } : {}),
        }),
    })
}

const getPreviewStatus = (previewId: string) => {
    return apiRequest<PreviewSessionStatus>(`/runtime/previews/${previewId}/status`)
}

const stopPreview = (previewId: string) => {
    return apiRequest<{ deleted: boolean }>(`/runtime/previews/${previewId}`, {
        method: 'DELETE',
    })
}

export const previewAPI = {
    startPreview,
    getPreviewStatus,
    stopPreview,
}
