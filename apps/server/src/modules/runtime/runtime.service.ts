import { prisma } from '@december/database'
import {
    getLatestPreviewManifestRef,
    publishStoredPreviewManifest,
    type PreviewManifestRef,
} from '../../shared/preview-manifest'
import { getBinaryFile, putBinaryFile } from '../../shared/project-storage'
import { chromium } from 'playwright'

import type {
    RuntimePreviewError,
    RuntimePreviewStatus,
    StartPreview,
    PreviewIdentifier,
    NotifyManifestPublished,
    RecordRuntimeStatus,
    CheckSandboxCompilation,
    EnsureManifestRef,
    ProjectVersionRecord,
    StoredProjectFile,
} from '@december/shared'



const previewStatusStore = new Map<string, RuntimePreviewStatus>()
const runtimeBaseUrl = (process.env.RUNTIME_BASE_URL ?? 'http://127.0.0.1:5050').replace(/\/+$/, '')
const runtimeSharedSecret = process.env.RUNTIME_SHARED_SECRET

const pendingDeletions = new Map<string, NodeJS.Timeout>()

export function cancelPendingDeletion(projectId: string) {
    const timer = pendingDeletions.get(projectId)
    if (timer) {
        clearTimeout(timer)
        pendingDeletions.delete(projectId)
        console.log(`[runtime] Cancelled pending 5-minute deletion for project ${projectId}`)
    }
}

export function scheduleDeletion(projectId: string, delayMs: number) {
    cancelPendingDeletion(projectId)
    const timer = setTimeout(async () => {
        try {
            console.log(`[runtime] Deleting preview container for project ${projectId} after 5 min delay`)
            await runtimeRequest<{ deleted: boolean }>(`/previews/${encodeURIComponent(projectId)}`, {
                method: 'DELETE',
            }).catch(() => null)
            previewStatusStore.delete(projectId)
            pendingDeletions.delete(projectId)
        } catch (err) {
            console.error(`Failed to delete preview container after delay for project ${projectId}:`, err)
            pendingDeletions.delete(projectId)
        }
    }, delayMs)
    pendingDeletions.set(projectId, timer)
}

async function takePreviewScreenshot(projectId: string, previewUrl: string) {
    console.log(`[Screenshot] Starting screenshot capture workflow for project ${projectId}`)
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
        
        const key = `projects/${projectId}/preview.png`
        console.log(`[Screenshot] Uploading screenshot to object storage (MinIO) at key: ${key}...`)
        await putBinaryFile({
            key,
            content: screenshotBuffer,
            contentType: 'image/png'
        })
        console.log(`[Screenshot] Screenshot uploaded to object storage successfully.`)
        
        console.log(`[Screenshot] Updating database for project ${projectId} with previewImageKey...`)
        await prisma.project.update({
            where: { id: projectId },
            data: {
                previewImageKey: key
            }
        })
        console.log(`[Screenshot] Database updated successfully.`)
        
        console.log(`[Screenshot] Screenshot capture workflow completed successfully for project ${projectId}.`)
    } catch (error) {
        console.error(`[Screenshot] Capture workflow failed for project ${projectId}:`, error)
    } finally {
        if (browser) {
            console.log(`[Screenshot] Closing browser...`)
            await browser.close()
            console.log(`[Screenshot] Browser closed.`)
        }
        console.log(`[Screenshot] Scheduling container cleanup for project ${projectId} in 5 minutes...`)
        scheduleDeletion(projectId, 5 * 60 * 1000)
    }
}

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

const loadProjectVersion = async (data: StartPreview) => {
    const { userId, projectId, versionId } = data
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            userId,
        },
        select: {
            id: true,
            currentVersionId: true,
            githubRepoUrl: true,
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

const ensureManifestRef = async (data: EnsureManifestRef) => {
    const { projectId, version } = data
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

const getInvalidStructureStatus = (projectId: string, message: string): RuntimePreviewStatus => ({
    previewId: projectId,
    projectId: projectId,
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

const validateProjectStructure = async (
    projectId: string,
    version: ProjectVersionRecord
): Promise<{ isValid: boolean; error?: string }> => {
    return { isValid: true }
}

const recordRuntimeStatus = (data: RecordRuntimeStatus) => {
    const { previewId, status } = data
    previewStatusStore.set(previewId, status)
    return status
}

const startPreview = async (data: StartPreview) => {
    const { userId, projectId, versionId } = data
    cancelPendingDeletion(projectId)
    const { project, version } = await loadProjectVersion(data)

    if (version.status !== 'READY') {
        return {
            previewId: project.id,
            projectId: project.id,
            state: 'Bootstrapping',
            backendStatus: 'loading',
            updatedAt: new Date().toISOString(),
        } as RuntimePreviewStatus
    }

    // Validate project structure
    const validation = await validateProjectStructure(project.id, version)
    if (!validation.isValid) {
        return getInvalidStructureStatus(project.id, validation.error!)
    }

    const initialManifest = await ensureManifestRef({
        projectId: project.id,
        version,
    })

    const isImported = await prisma.projectImport.findFirst({
        where: { projectId: project.id },
    })
    const isGithub = !!project.githubRepoUrl
    
    // Check if it's a duplicate or remix by checking if the manifest has files other than the scaffold
    const manifestFiles = parseStoredProjectFiles(version.manifestJson)
    const scaffoldPaths = ['package.json', 'vite.config.ts', 'tsconfig.json', 'index.html', 'src/main.tsx']
    const hasOtherFiles = manifestFiles.some((f) => !scaffoldPaths.includes(f.path))

    const isNewProject = version.versionNumber === 1 && !isImported && !isGithub && !hasOtherFiles

    return runtimeRequest<RuntimePreviewStatus>('/previews/start', {
        method: 'POST',
        body: JSON.stringify({
            previewId: previewIdForProject(project.id),
            projectId: project.id,
            isNewProject,
            ...(initialManifest ? { initialManifest } : {}),
        }),
    })
}

const notifyManifestPublished = async (data: NotifyManifestPublished) => {
    const { projectId, manifest } = data
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

const getPreviewStatus = async (data: PreviewIdentifier) => {
    const { userId, previewId } = data
    const project = await prisma.project.findFirst({
        where: {
            id: previewId,
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

    // Check project version structure before getting status
    const version = await prisma.projectVersion.findFirst({
        where: {
            projectId: project.id,
            id: project.currentVersionId ?? undefined,
        },
        orderBy: {
            versionNumber: 'desc',
        },
    })

    if (version && version.status !== 'READY') {
        return {
            previewId: project.id,
            projectId: project.id,
            state: 'Bootstrapping',
            backendStatus: 'loading',
            updatedAt: new Date().toISOString(),
        } as RuntimePreviewStatus
    }

    if (version) {
        const validation = await validateProjectStructure(project.id, version)
        if (!validation.isValid) {
            return getInvalidStructureStatus(project.id, validation.error!)
        }
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
        takePreviewScreenshot(project.id, status.previewUrl).catch((err) => {
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
    const { projectId } = data
    return runtimeRequest<CompileCheckResult>(
        `/previews/${encodeURIComponent(previewIdForProject(projectId))}/validate`,
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
