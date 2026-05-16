import type { PreviewSessionStatus } from '@/features/preview/types'

import { apiRequest } from '@/shared/api/client'

export type ImportStatus =
    | 'PENDING'
    | 'VALIDATING'
    | 'UPLOADING'
    | 'STARTING_RUNTIME'
    | 'READY'
    | 'FAILED'
export type ImportSourceType = 'GITHUB' | 'ZIP'

export interface ProjectImportStatus {
    id: string
    sourceType: ImportSourceType
    sourceUrl?: string | null
    sourceFileName?: string | null
    bucket?: string | null
    objectPrefix?: string | null
    status: ImportStatus
    framework?: string | null
    projectId?: string | null
    projectVersionId?: string | null
    previewUrl?: string | null
    errorMessage?: string | null
    errorsJson?: unknown
    attempts: number
    createdAt: string
    updatedAt: string
    runtimeStatus?: PreviewSessionStatus | null
}

const importGithub = (repoURL: string) => {
    return apiRequest<ProjectImportStatus>('/imports/github', {
        method: 'POST',
        body: JSON.stringify({ repoURL }),
    })
}

const importZip = (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    return apiRequest<ProjectImportStatus>('/imports/zip', {
        method: 'POST',
        body: formData,
    })
}

const getImportStatus = (importId: string) => {
    return apiRequest<ProjectImportStatus>(`/imports/${importId}`)
}

export const importsAPI = {
    importGithub,
    importZip,
    getImportStatus,
}
