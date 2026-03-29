import { prisma } from '../../config/db'
import {
    getLatestPreviewManifestRef,
    publishStoredPreviewManifest,
    type PreviewManifestRef,
} from '../../lib/preview-manifest'

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
    backendStatus: 'ready' | 'rebuilding' | 'failed'
    currentVersion?: string | null
    healthyVersion?: string | null
    previewUrl?: string | null
    lastError?: RuntimePreviewError | null
    updatedAt: string
}

type StartPreviewInput = {
    userId: string
    projectId: string
    versionId?: string
}

type PreviewIdentifierInput = {
    userId: string
    previewId: string
}

type RuntimeStatusCallbackInput = RuntimePreviewStatus

type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

type ProjectVersionRecord = NonNullable<Awaited<ReturnType<typeof prisma.projectVersion.findFirst>>>

const previewStatusStore = new Map<string, RuntimePreviewStatus>()
const runtimeBaseUrl = (process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:5050').replace(/\/+$/, '')
const runtimeSharedSecret = process.env.RUNTIME_SHARED_SECRET

const parseStoredProjectFiles = (value: unknown): StoredProjectFile[] => {
    if (!Array.isArray(value)) {
        return []
    }

    return value.reduce<StoredProjectFile[]>((files, item) => {
        if (!item || typeof item !== 'object') {
            return files
        }

        const candidate = item as Partial<StoredProjectFile>

        if (typeof candidate.path !== 'string' || typeof candidate.key !== 'string') {
            return files
        }

        files.push({
            path: candidate.path,
            key: candidate.key,
            ...(typeof candidate.contentType === 'string'
                ? { contentType: candidate.contentType }
                : {}),
            size: typeof candidate.size === 'number' ? candidate.size : 0,
        })

        return files
    }, [])
}

const previewIdForProject = (projectId: string) => projectId

const runtimeRequest = async <T>(path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')

    if (runtimeSharedSecret) {
        headers.set('x-phasehumans-runtime-secret', runtimeSharedSecret)
    }

    const response = await fetch(`${runtimeBaseUrl}${path}`, {
        ...init,
        headers,
    })

    const payload = (await response.json().catch(() => null)) as {
        data?: T
        error?: { message?: string }
    } | null

    if (!response.ok) {
        throw new Error(
            payload?.error?.message || `runtime request failed with status ${response.status}`
        )
    }

    if (!payload?.data) {
        throw new Error('runtime response did not include data')
    }

    return payload.data
}

const loadProjectVersion = async ({ userId, projectId, versionId }: StartPreviewInput) => {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        select: {
            id: true,
            currentVersionId: true,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    const version = await prisma.projectVersion.findFirst({
        where: {
            projectId: project.id,
            id: versionId ?? project.currentVersionId ?? undefined,
        },
        orderBy: versionId
            ? undefined
            : {
                  versionNumber: 'desc',
              },
    })

    if (!version) {
        throw new Error('project version not found')
    }

    return {
        project,
        version,
    }
}

const ensureManifestRef = async ({
    projectId,
    version,
}: {
    projectId: string
    version: ProjectVersionRecord
}) => {
    const latestRef = await getLatestPreviewManifestRef(projectId, version.id)

    if (latestRef) {
        return latestRef
    }

    const storedFiles = parseStoredProjectFiles(version.manifestJson)

    if (storedFiles.length === 0) {
        return null
    }

    return publishStoredPreviewManifest({
        projectId,
        versionId: version.id,
        manifestVersion: 'final',
        files: storedFiles,
    })
}

const recordRuntimeStatus = (previewId: string, status: RuntimeStatusCallbackInput) => {
    previewStatusStore.set(previewId, status)
    return status
}

const startPreview = async ({ userId, projectId, versionId }: StartPreviewInput) => {
    const { project, version } = await loadProjectVersion({ userId, projectId, versionId })
    const initialManifest = await ensureManifestRef({
        projectId: project.id,
        version,
    })

    return runtimeRequest<RuntimePreviewStatus>('/previews/start', {
        method: 'POST',
        body: JSON.stringify({
            previewId: previewIdForProject(project.id),
            projectId: project.id,
            ...(initialManifest ? { initialManifest } : {}),
        }),
    })
}

const notifyManifestPublished = async ({
    projectId,
    manifest,
}: {
    projectId: string
    manifest: PreviewManifestRef
}) => {
    return runtimeRequest<RuntimePreviewStatus>(
        `/previews/${encodeURIComponent(previewIdForProject(projectId))}/manifest-published`,
        {
            method: 'POST',
            body: JSON.stringify({
                projectId,
                manifest,
            }),
        }
    )
}

const getPreviewStatus = async ({ userId, previewId }: PreviewIdentifierInput) => {
    const project = await prisma.project.findFirst({
        where: {
            id: previewId,
            userId,
        },
        select: {
            id: true,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    try {
        return await runtimeRequest<RuntimePreviewStatus>(
            `/previews/${encodeURIComponent(previewId)}/status`
        )
    } catch (error) {
        const storedStatus = previewStatusStore.get(previewId)

        if (storedStatus) {
            return storedStatus
        }

        throw error
    }
}

const deletePreview = async ({ userId, previewId }: PreviewIdentifierInput) => {
    const project = await prisma.project.findFirst({
        where: {
            id: previewId,
            userId,
        },
        select: {
            id: true,
        },
    })

    if (!project) {
        throw new Error('project not found')
    }

    await runtimeRequest<{ deleted: boolean }>(`/previews/${encodeURIComponent(previewId)}`, {
        method: 'DELETE',
    })

    previewStatusStore.delete(previewId)

    return {
        deleted: true,
    }
}

export const runtimeService = {
    startPreview,
    notifyManifestPublished,
    getPreviewStatus,
    deletePreview,
    recordRuntimeStatus,
}
