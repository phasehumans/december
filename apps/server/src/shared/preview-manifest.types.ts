export type PreviewManifestFile = {
    path: string
    objectKey: string
    size: number
    contentType?: string
    sha256?: string
}

export type PreviewManifest = {
    manifestVersion: string
    projectId: string
    projectVersionId: string
    publishedAt: string
    runnable: boolean
    files: PreviewManifestFile[]
}

export type PreviewManifestRef = {
    manifestVersion: string
    manifestKey: string
    projectId: string
    projectVersionId?: string
    publishedAt: string
    runnable: boolean
}

export type PreviewManifestStoredFile = {
    path: string
    key: string
    size: number
    contentType?: string
}
