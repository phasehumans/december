import {
    publishGeneratedPreviewManifest,
    publishStoredPreviewManifest,
    putPreviewSourceFile,
} from '../../lib/preview-manifest'
import { runtimeService } from '../runtime/runtime.service'

export const notifyRuntimeOfManifest = async ({
    projectId,
    manifest,
}: {
    projectId: string
    manifest:
        | Awaited<ReturnType<typeof publishGeneratedPreviewManifest>>
        | Awaited<ReturnType<typeof publishStoredPreviewManifest>>
}) => {
    if (!manifest) {
        return
    }

    try {
        await runtimeService.notifyManifestPublished({
            projectId,
            manifest,
        })
    } catch (error) {
        console.error('[runtime/notify]', error)
    }
}

export const publishIncrementalPreviewSnapshot = async ({
    projectId,
    versionId,
    path,
    content,
    generatedFiles,
    sequence,
}: {
    projectId: string
    versionId: string
    path: string
    content: string
    generatedFiles: Record<string, string>
    sequence: number
}) => {
    await putPreviewSourceFile({
        projectId,
        versionId,
        path,
        content,
    })

    const manifest = await publishGeneratedPreviewManifest({
        projectId,
        versionId,
        manifestVersion: `build-${String(sequence).padStart(4, '0')}`,
        generatedFiles,
    })

    await notifyRuntimeOfManifest({
        projectId,
        manifest,
    })
}

export const publishFinalPreviewSnapshot = async ({
    projectId,
    versionId,
    files,
}: {
    projectId: string
    versionId: string
    files: Array<{
        path: string
        key: string
        contentType?: string
        size: number
    }>
}) => {
    const manifest = await publishStoredPreviewManifest({
        projectId,
        versionId,
        manifestVersion: 'final',
        files,
    })

    await notifyRuntimeOfManifest({
        projectId,
        manifest,
    })
}
