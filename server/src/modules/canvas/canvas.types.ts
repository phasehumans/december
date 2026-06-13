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
