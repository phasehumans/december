import {
    getLatestPreviewManifestRef,
    publishStoredPreviewManifest,
} from '../../shared/preview-manifest'
import { getBinaryFile, putBinaryFile, listPrefix, sessionWorkspacePrefix } from '../../shared/project-storage'
import { chromium } from 'playwright'
import { runtimeRepository } from './runtime.repository'

import type { PreviewManifestRef } from '../../shared/preview-manifest.types'
type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}
import type {
    RuntimePreviewError,
    RuntimePreviewStatus,
    StartPreview,
    PreviewIdentifier,
    NotifyManifestPublished,
    RecordRuntimeStatus,
    CheckSandboxCompilation,
    EnsureManifestRef,
    SessionRecord,
} from './runtime.types'

const previewStatusStore = new Map<string, RuntimePreviewStatus>()
const runtimeBaseUrl = (process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:5050').replace(/\/+$/, '')
const runtimeSharedSecret = process.env.RUNTIME_SHARED_SECRET

const pendingDeletions = new Map<string, NodeJS.Timeout>()

export function cancelPendingDeletion(sessionId: string) {
    const timer = pendingDeletions.get(sessionId)
    if (timer) {
        clearTimeout(timer)
        pendingDeletions.delete(sessionId)
        console.log(`[runtime] Cancelled pending 5-minute deletion for session ${sessionId}`)
    }
}

export function scheduleDeletion(sessionId: string, delayMs: number) {
    cancelPendingDeletion(sessionId)
    const timer = setTimeout(async () => {
        try {
            console.log(`[runtime] Deleting preview container for session ${sessionId} after 5 min delay`)
            await runtimeRequest<{ deleted: boolean }>(`/previews/${encodeURIComponent(sessionId)}`, {
                method: 'DELETE',
            }).catch(() => null)
            previewStatusStore.delete(sessionId)
            pendingDeletions.delete(sessionId)
        } catch (err) {
            console.error(`Failed to delete preview container after delay for session ${sessionId}:`, err)
            pendingDeletions.delete(sessionId)
        }
    }, delayMs)
    pendingDeletions.set(sessionId, timer)
}

async function takePreviewScreenshot(sessionId: string, previewUrl: string) {
    console.log(`[Screenshot] Starting screenshot capture workflow for session ${sessionId}`)
    console.log(`[Screenshot] Target URL: ${previewUrl}`)
    let browser;
    try {
        console.log(`[Screenshot] Launching Playwright Chromium browser...`)
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        })
        console.log(`[Screenshot] Browser launched successfully.`)

        console.log(`[Screenshot] Creating new browser context (Viewport: 1280x800)...`)
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 }
        })
        console.log(`[Screenshot] Browser context created.`)

        console.log(`[Screenshot] Opening new browser page...`)
        const page = await context.newPage()
        console.log(`[Screenshot] New browser page opened.`)
        
        console.log(`[Screenshot] Navigating to ${previewUrl}...`)
        await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 })
        console.log(`[Screenshot] Navigation complete. Page loaded with networkidle.`)
        
        console.log(`[Screenshot] Waiting 2000ms for animations and client-side rendering to settle...`)
        await page.waitForTimeout(2000)
        console.log(`[Screenshot] Wait complete. Capturing page screenshot as PNG...`)
        
        const screenshotBuffer = await page.screenshot({ type: 'png' })
        console.log(`[Screenshot] Screenshot buffer captured. Buffer size: ${screenshotBuffer.byteLength} bytes.`)
        
        const key = `sessions/${sessionId}/preview.png`
        console.log(`[Screenshot] Uploading screenshot to object storage (MinIO) at key: ${key}...`)
        await putBinaryFile({
            key,
            content: screenshotBuffer,
            contentType: 'image/png'
        })
        console.log(`[Screenshot] Screenshot uploaded to object storage successfully.`)
        
        console.log(`[Screenshot] Updating database for session ${sessionId} with previewImageKey...`)
        await runtimeRepository.updateSessionPreviewImage({ sessionId, key })
        console.log(`[Screenshot] Database updated successfully.`)
        
        console.log(`[Screenshot] Screenshot capture workflow completed successfully for session ${sessionId}.`)
    } catch (error) {
        console.error(`[Screenshot] Capture workflow failed for session ${sessionId}:`, error)
    } finally {
        if (browser) {
            console.log(`[Screenshot] Closing browser...`)
            await browser.close()
            console.log(`[Screenshot] Browser closed.`)
        }
        console.log(`[Screenshot] Scheduling container cleanup for session ${sessionId} in 5 minutes...`)
        scheduleDeletion(sessionId, 5 * 60 * 1000)
    }
}

const runtimeRequest = async <T>(path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    headers.set('Content-Type', 'application/json')

    if (runtimeSharedSecret) {
        headers.set('x-december-runtime-secret', runtimeSharedSecret)
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

const loadSession = async (data: StartPreview) => {
    const { userId, projectId: sessionId } = data
    const session = await runtimeRepository.findSessionForPreview({ sessionId, userId })

    if (!session) {
        throw new Error('session not found')
    }

    return {
        session,
    }
}

const ensureManifestRef = async (data: EnsureManifestRef) => {
    const { sessionId } = data
    const latestRef = await getLatestPreviewManifestRef(sessionId, sessionId)

    if (latestRef) {
        return latestRef
    }

    const prefix = sessionWorkspacePrefix(sessionId)
    const objects = await listPrefix(prefix)
    const storedFiles: StoredProjectFile[] = []

    for (const obj of objects) {
        const key = obj.Key
        if (!key) continue
        const relativePath = key.substring(prefix.length)
        if (!relativePath || relativePath.endsWith('/')) continue

        storedFiles.push({
            path: relativePath,
            key,
            size: obj.Size ?? 0,
        })
    }

    if (storedFiles.length === 0) {
        return null
    }

    return publishStoredPreviewManifest({
        projectId: sessionId,
        versionId: sessionId,
        manifestVersion: 'final',
        files: storedFiles,
    })
}

const getInvalidStructureStatus = (sessionId: string, message: string): RuntimePreviewStatus => ({
    previewId: sessionId,
    sessionId: sessionId,
    state: 'Failed',
    backendStatus: 'failed',
    lastError: {
        class: 'stable_compile_runtime',
        code: 'UNSUPPORTED_STRUCTURE',
        message: message,
        retryable: false,
    },
    updatedAt: new Date().toISOString(),
})

const validateSessionStructure = async (
    sessionId: string
): Promise<{ isValid: boolean; error?: string }> => {
    return { isValid: true }
}

const recordRuntimeStatus = (data: RecordRuntimeStatus) => {
    const { previewId, status } = data
    previewStatusStore.set(previewId, status)
    return status
}

const startPreview = async (data: StartPreview) => {
    const { userId, projectId: sessionId } = data
    cancelPendingDeletion(sessionId)
    const { session } = await loadSession(data)

    // Validate session structure
    const validation = await validateSessionStructure(session.id)
    if (!validation.isValid) {
        return getInvalidStructureStatus(session.id, validation.error!)
    }

    const initialManifest = await ensureManifestRef({
        sessionId: session.id,
    })

    const isImported = await runtimeRepository.findSessionImport({ sessionId: session.id })
    const isGithub = !!session.githubRepoUrl
    
    // Check if it's a duplicate or remix by checking S3 files
    const prefix = sessionWorkspacePrefix(session.id)
    const objects = await listPrefix(prefix)
    const storedFiles = objects.map((obj) => obj.Key?.substring(prefix.length) || '').filter(Boolean)

    const scaffoldPaths = ['package.json', 'vite.config.ts', 'tsconfig.json', 'index.html', 'src/main.tsx']
    const hasOtherFiles = storedFiles.some((p) => !scaffoldPaths.includes(p))

    const isNewProject = !isImported && !isGithub && !hasOtherFiles

    return runtimeRequest<RuntimePreviewStatus>('/previews/start', {
        method: 'POST',
        body: JSON.stringify({
            previewId: session.id,
            projectId: session.id,
            isNewProject,
            ...(initialManifest ? { initialManifest } : {}),
        }),
    })
}

const notifyManifestPublished = async (data: NotifyManifestPublished) => {
    const { sessionId, manifest } = data
    return runtimeRequest<RuntimePreviewStatus>(
        `/previews/${encodeURIComponent(sessionId)}/manifest-published`,
        {
            method: 'POST',
            body: JSON.stringify({
                projectId: sessionId,
                manifest,
            }),
        }
    )
}

const getPreviewStatus = async (data: PreviewIdentifier) => {
    const { userId, previewId } = data
    const session = await runtimeRepository.findSessionForStatus({ previewId, userId })

    if (!session) {
        throw new Error('session not found')
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

const deletePreview = async (data: PreviewIdentifier) => {
    const { userId, previewId } = data
    const session = await runtimeRepository.findSessionForDelete({ previewId, userId })

    if (!session) {
        throw new Error('session not found')
    }

    let status: RuntimePreviewStatus | undefined
    try {
        status = await getPreviewStatus(data)
    } catch (err) {
        console.error('Failed to get preview status before delete:', err)
    }

    const hasValidPreview =
        status &&
        status.state === 'Healthy' &&
        status.backendStatus === 'ready' &&
        !status.lastError &&
        status.previewUrl

    if (hasValidPreview && status && status.previewUrl) {
        // Capture screenshot in the background (which will schedule container deletion in 5 min)
        takePreviewScreenshot(session.id, status.previewUrl).catch((err) => {
            console.error('Unhandled error in takePreviewScreenshot:', err)
        })
    } else {
        // Delete container immediately
        await runtimeRequest<{ deleted: boolean }>(`/previews/${encodeURIComponent(previewId)}`, {
            method: 'DELETE',
        }).catch(() => null)
        previewStatusStore.delete(previewId)
    }

    return {
        deleted: true,
    }
}

export type CompileCheckResult = {
    success: boolean
    errors?: string | null
}

const checkSandboxCompilation = async (data: CheckSandboxCompilation): Promise<CompileCheckResult> => {
    const { sessionId } = data
    return runtimeRequest<CompileCheckResult>(
        `/previews/${encodeURIComponent(sessionId)}/validate`,
        {
            method: 'POST',
        }
    )
}

export const runtimeService = {
    startPreview,
    notifyManifestPublished,
    getPreviewStatus,
    deletePreview,
    recordRuntimeStatus,
    checkSandboxCompilation,
}
