import type { CanvasDocument } from './canvas.persistence'

export type CreateWebClips = {
    url: string
    userId: string
    projectId?: string
}

export type SaveCanvas = {
    projectId: string
    userId: string
    versionId?: string
    canvasState: any
}

export type PersistImageAsset = {
    projectId: string
    userId: string
    versionId: string
    item: CanvasDocument['items'][number]
}

export type PersistCanvasDocument = {
    projectId: string
    userId: string
    versionId: string
    canvasState?: CanvasDocument | null
}

export type HydrateCanvasDocument = {
    canvasState?: unknown
    canvasAssetManifest?: unknown
}

export type ClipperWorkerSection = {
    path: string
    width: number
    height: number
}

export type ClipperWorkerResult = {
    directory: string
    full: string
    width: number
    height: number
    sections: ClipperWorkerSection[]
}
