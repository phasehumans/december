import type { CanvasAssetKind, CanvasAssetSource } from '@/features/canvas/types'

import { apiRequest } from '@/shared/api/client'

export interface WebClipResult {
    id: string
    content: string
    width: number
    height: number
    assetKey: string
    assetSource: CanvasAssetSource
    assetContentType: string
    assetKind: CanvasAssetKind
}

export interface CreateWebClipsResponse {
    sourceUrl: string
    clips: WebClipResult[]
}

const createWebClips = (data: { url: string; projectId?: string | null }) => {
    return apiRequest<CreateWebClipsResponse>('/canvas/web-clips', {
        method: 'POST',
        body: JSON.stringify({
            url: data.url,
            ...(data.projectId ? { projectId: data.projectId } : {}),
        }),
    })
}

export const canvasAPI = {
    createWebClips,
}
