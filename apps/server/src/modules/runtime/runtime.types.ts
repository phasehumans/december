import { prisma } from '@december/database'

import type { PreviewManifestRef } from '../../shared/preview-manifest.types'

export type SessionRecord = NonNullable<
    Awaited<ReturnType<typeof prisma.session.findFirst>>
>

export type EnsureManifestRef = {
    sessionId: string
}

export type ProvisionSession = {
    sessionId: string
    userId: string
}

export type HeartbeatSession = {
    sessionId: string
    userId: string
}

export type StopSession = {
    sessionId: string
    userId: string
}

export type GetSessionStatus = {
    sessionId: string
    userId: string
}

export type CancelPendingDeletion = {
    sessionId: string
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
    sessionId: string
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
    sessionId: string
    manifest: PreviewManifestRef
}

export type RecordRuntimeStatus = {
    previewId: string
    status: RuntimePreviewStatus
}

export type CheckSandboxCompilation = {
    sessionId: string
}
