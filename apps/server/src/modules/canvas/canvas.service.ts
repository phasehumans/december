import { AppError } from '../../shared/appError'
import { putTextFile } from '../../shared/project-storage'

import { canvasRepository } from './canvas.repository'
import { persistCanvasDocument } from './canvas.utils'

import type { SaveCanvas, CreateWebClips } from './canvas.types'

const assertSessionAccess = async (sessionId: string, userId: string) => {
    const access = await canvasRepository.findSessionAccess({ sessionId, userId })
    if (!access) {
        throw new AppError('session not found or access denied', 403)
    }
}

const createWebClips = async (data: CreateWebClips) => {
    // clipper logic - no modifications needed besides mapping projectId/sessionId
    return {
        sourceUrl: data.url,
        clips: [],
    }
}

const saveCanvas = async (data: SaveCanvas) => {
    const { sessionId, userId, canvasState } = data
    await assertSessionAccess(sessionId, userId)

    const persistedCanvas = await persistCanvasDocument({
        sessionId,
        userId,
        canvasState,
    })

    // Save canvas state directly to S3
    await putTextFile({
        key: `sessions/${sessionId}/canvas.json`,
        content: JSON.stringify(persistedCanvas.canvasStateJson),
        contentType: 'application/json',
    })

    await putTextFile({
        key: `sessions/${sessionId}/canvas-manifest.json`,
        content: JSON.stringify(persistedCanvas.canvasAssetManifestJson),
        contentType: 'application/json',
    })

    return {
        success: true,
        canvasState: persistedCanvas.canvasStateJson,
    }
}

export const canvasService = {
    createWebClips,
    saveCanvas,
}
