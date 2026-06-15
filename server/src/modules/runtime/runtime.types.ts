import { prisma } from '../../config/db'
import type { PreviewManifestRef } from '../../shared/preview-manifest'

export type ProjectVersionRecord = NonNullable<Awaited<ReturnType<typeof prisma.projectVersion.findFirst>>>

export type EnsureManifestRef = {
    projectId: string
    version: ProjectVersionRecord
}

export type RuntimePreviewError = {
    class:
        | 'temporary_partial_generation'
        | 'stable_compile_runtime'
        | 'dependency_install'
        | 'infra_runtime'
    code: string
    message: string
    detail?: string | null
    retryable: boolean
}

export type RuntimePreviewStatus = {
    previewId: string
    projectId: string
    state:
        | 'WaitingForRunnableVersion'
        | 'Bootstrapping'
        | 'Installing'
        | 'Starting'
        | 'Healthy'
        | 'Rebuilding'
        | 'Failed'
        | 'Stopped'
    backendStatus: 'loading' | 'ready' | 'rebuilding' | 'failed'
    currentVersion?: string | null
    healthyVersion?: string | null
    previewUrl?: string | null
    lastError?: RuntimePreviewError | null
    updatedAt: string
}

export type StartPreview = {
    userId: string
    projectId: string
    versionId?: string
}

export type PreviewIdentifier = {
    userId: string
    previewId: string
}

export type NotifyManifestPublished = {
    projectId: string
    manifest: PreviewManifestRef
}

export type RecordRuntimeStatus = {
    previewId: string
    status: RuntimePreviewStatus
}

export type CheckSandboxCompilation = {
    projectId: string
}
