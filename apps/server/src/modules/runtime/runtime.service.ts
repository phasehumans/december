import { prisma } from '@december/database'
import { AppError } from '../../shared/appError'
import { runtimeRepository } from './runtime.repository'

import type {
    RuntimePreviewStatus,
    StartPreview,
    PreviewIdentifier,
    NotifyManifestPublished,
    RecordRuntimeStatus,
    CheckSandboxCompilation,
    SetSessionListeningPort,
    GetSessionListeningPort,
} from './runtime.types'

const previewStatusStore = new Map<string, RuntimePreviewStatus>()
const pendingDeletions = new Map<string, NodeJS.Timeout>()
const sessionListeningPorts = new Map<string, number>()

function cancelPendingDeletion(sessionId: string) {
    const timer = pendingDeletions.get(sessionId)
    if (timer) {
        clearTimeout(timer)
        pendingDeletions.delete(sessionId)
        console.log(`[runtime] Cancelled pending deletion for session ${sessionId}`)
    }
}

function scheduleDeletion(sessionId: string, delayMs: number) {
    cancelPendingDeletion(sessionId)
    const timer = setTimeout(async () => {
        try {
            console.log(`[runtime] Deleting preview status for session ${sessionId}`)
            previewStatusStore.delete(sessionId)
            sessionListeningPorts.delete(sessionId)
            pendingDeletions.delete(sessionId)
        } catch (err) {
            console.error(`Failed to delete preview status for session ${sessionId}:`, err)
            pendingDeletions.delete(sessionId)
        }
    }, delayMs)
    pendingDeletions.set(sessionId, timer)
}

const setSessionListeningPort = (data: SetSessionListeningPort) => {
    const { sessionId, port } = data
    sessionListeningPorts.set(sessionId, port)
    return { sessionId, port }
}

const getSessionListeningPort = (data: GetSessionListeningPort): number | null => {
    const { sessionId } = data
    return sessionListeningPorts.get(sessionId) ?? null
}

const resolvePreviewPort = (sessionId: string, explicitPort?: number): number | null => {
    if (explicitPort) {
        sessionListeningPorts.set(sessionId, explicitPort)
        return explicitPort
    }
    if (sessionListeningPorts.has(sessionId)) {
        return sessionListeningPorts.get(sessionId)!
    }
    const storedStatus = previewStatusStore.get(sessionId)
    if (storedStatus?.previewUrl) {
        const match = storedStatus.previewUrl.match(/\/preview\/(\d+)/)
        if (match && match[1]) {
            const detected = parseInt(match[1], 10)
            sessionListeningPorts.set(sessionId, detected)
            return detected
        }
    }
    return null
}

const buildPreviewUrl = (sessionId: string, explicitPort?: number): string => {
    const port = resolvePreviewPort(sessionId, explicitPort)
    return port
        ? `/api/v1/sessions/${sessionId}/preview/${port}`
        : `/api/v1/sessions/${sessionId}/preview`
}

const loadSession = async (data: StartPreview) => {
    const { userId, projectId: sessionId } = data
    const session = await runtimeRepository.findSessionForStart({ sessionId, userId })
    if (!session) {
        throw new AppError('Session not found', 404)
    }
    return { session }
}

const recordRuntimeStatus = (data: RecordRuntimeStatus) => {
    const { previewId, status } = data
    if (status.previewUrl) {
        const match = status.previewUrl.match(/\/preview\/(\d+)/)
        if (match && match[1]) {
            sessionListeningPorts.set(previewId, parseInt(match[1], 10))
        }
    }
    previewStatusStore.set(previewId, status)
    return status
}

const startPreview = async (data: StartPreview): Promise<RuntimePreviewStatus> => {
    const { userId, projectId: sessionId, port } = data
    cancelPendingDeletion(sessionId)
    const { session } = await loadSession(data)

    await prisma.session.update({
        where: { id: sessionId },
        data: { vmStatus: 'RUNNING' },
    }).catch(() => {})

    const previewUrl = buildPreviewUrl(session.id, port)

    const status: RuntimePreviewStatus = {
        previewId: session.id,
        sessionId: session.id,
        state: 'Healthy',
        backendStatus: 'ready',
        previewUrl,
        updatedAt: new Date().toISOString(),
    }

    previewStatusStore.set(session.id, status)
    return status
}

const notifyManifestPublished = async (data: NotifyManifestPublished): Promise<RuntimePreviewStatus> => {
    const { sessionId, port } = data
    const previewUrl = buildPreviewUrl(sessionId, port)

    const status: RuntimePreviewStatus = {
        previewId: sessionId,
        sessionId,
        state: 'Healthy',
        backendStatus: 'ready',
        previewUrl,
        updatedAt: new Date().toISOString(),
    }
    previewStatusStore.set(sessionId, status)
    return status
}

const getPreviewStatus = async (data: PreviewIdentifier): Promise<RuntimePreviewStatus> => {
    const { userId, previewId } = data
    const session = await runtimeRepository.findSessionForStatus({ previewId, userId })

    if (!session) {
        throw new AppError('Session not found', 404)
    }

    const storedStatus = previewStatusStore.get(previewId)
    if (storedStatus) {
        return storedStatus
    }

    const previewUrl = buildPreviewUrl(previewId)
    const isRunning = session.vmStatus === 'RUNNING' || session.vmStatus === 'PROVISIONING'
    const status: RuntimePreviewStatus = {
        previewId,
        sessionId: previewId,
        state: isRunning ? 'Healthy' : session.vmStatus === 'FAILED' ? 'Failed' : 'Stopped',
        backendStatus: session.vmStatus === 'RUNNING' ? 'ready' : session.vmStatus === 'PROVISIONING' ? 'loading' : 'failed',
        previewUrl,
        updatedAt: session.updatedAt ? session.updatedAt.toISOString() : new Date().toISOString(),
    }

    return status
}

const deletePreview = async (data: PreviewIdentifier) => {
    const { userId, previewId } = data
    const session = await runtimeRepository.findSessionForDelete({ previewId, userId })

    if (!session) {
        throw new AppError('Session not found', 404)
    }

    previewStatusStore.delete(previewId)
    sessionListeningPorts.delete(previewId)
    await prisma.session.update({
        where: { id: previewId },
        data: { vmStatus: 'STOPPED' },
    }).catch(() => {})

    return { deleted: true }
}

export type CompileCheckResult = {
    success: boolean
    errors?: string | null
}

const checkSandboxCompilation = async (data: CheckSandboxCompilation): Promise<CompileCheckResult> => {
    const { sessionId } = data
    return { success: true, errors: null }
}

export const runtimeService = {
    cancelPendingDeletion,
    scheduleDeletion,
    setSessionListeningPort,
    getSessionListeningPort,
    startPreview,
    notifyManifestPublished,
    getPreviewStatus,
    deletePreview,
    recordRuntimeStatus,
    checkSandboxCompilation,
}
