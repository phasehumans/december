import {
    publishGeneratedPreviewManifest,
    publishStoredPreviewManifest,
    putPreviewSourceFile,
} from '../../shared/preview-manifest'
import { runtimeService } from '../runtime/runtime.service'

import type {
    NotifyRuntimeOfManifest,
    PublishIncrementalPreviewSnapshot,
    PublishFinalPreviewSnapshot,
} from './generation.types'

export const notifyRuntimeOfManifest = async (data: NotifyRuntimeOfManifest) => {
    const { projectId, manifest } = data
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

export const publishIncrementalPreviewSnapshot = async (
    data: PublishIncrementalPreviewSnapshot
) => {
    const { projectId, versionId, path, content, generatedFiles, sequence } = data
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

export const publishFinalPreviewSnapshot = async (data: PublishFinalPreviewSnapshot) => {
    const { projectId, versionId, files } = data
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
