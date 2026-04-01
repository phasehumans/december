import { createHash } from 'crypto'
import { toPreviewWorkspacePath } from '../modules/generation/frontend-paths'
import { getTextFile, putTextFile, versionKey } from './project-storage'

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

const guessContentType = (path: string) => {
    if (path.endsWith('.tsx')) return 'text/tsx; charset=utf-8'
    if (path.endsWith('.ts')) return 'text/typescript; charset=utf-8'
    if (path.endsWith('.js')) return 'text/javascript; charset=utf-8'
    if (path.endsWith('.json')) return 'application/json; charset=utf-8'
    if (path.endsWith('.css')) return 'text/css; charset=utf-8'
    if (path.endsWith('.html')) return 'text/html; charset=utf-8'
    if (path.endsWith('.md')) return 'text/markdown; charset=utf-8'
    if (path.endsWith('.svg')) return 'image/svg+xml'
    return 'text/plain; charset=utf-8'
}

const isRunnableSnapshot = (paths: string[]) => {
    const fileSet = new Set(paths)
    return (
        fileSet.has('package.json') &&
        fileSet.has('index.html') &&
        paths.some((path) => path.startsWith('src/'))
    )
}

export const previewManifestObjectKey = (
    projectId: string,
    versionId: string,
    manifestVersion: string
) => `projects/${projectId}/preview/versions/${versionId}/manifests/${manifestVersion}.json`

export const latestPreviewManifestRefKey = (projectId: string, versionId: string) =>
    `projects/${projectId}/preview/versions/${versionId}/latest.json`

const createManifest = ({
    projectId,
    versionId,
    manifestVersion,
    files,
}: {
    projectId: string
    versionId: string
    manifestVersion: string
    files: PreviewManifestFile[]
}): PreviewManifest => ({
    manifestVersion,
    projectId,
    projectVersionId: versionId,
    publishedAt: new Date().toISOString(),
    runnable: isRunnableSnapshot(files.map((file) => file.path)),
    files,
})

export const putPreviewSourceFile = async ({
    projectId,
    versionId,
    path,
    content,
}: {
    projectId: string
    versionId: string
    path: string
    content: string
}) => {
    await putTextFile({
        key: versionKey(projectId, versionId, path),
        content,
        contentType: guessContentType(path),
    })
}

export const publishGeneratedPreviewManifest = async ({
    projectId,
    versionId,
    manifestVersion,
    generatedFiles,
}: {
    projectId: string
    versionId: string
    manifestVersion: string
    generatedFiles: Record<string, string>
}) => {
    const files = Object.entries(generatedFiles).reduce<PreviewManifestFile[]>(
        (entries, [path, content]) => {
            const workspacePath = toPreviewWorkspacePath(path)

            if (!workspacePath) {
                return entries
            }

            entries.push({
                path: workspacePath,
                objectKey: versionKey(projectId, versionId, path),
                size: Buffer.byteLength(content, 'utf8'),
                contentType: guessContentType(path),
                sha256: createHash('sha256').update(content).digest('hex'),
            })

            return entries
        },
        []
    )

    if (files.length === 0) {
        return null
    }

    const manifest = createManifest({
        projectId,
        versionId,
        manifestVersion,
        files,
    })

    if (!manifest.runnable) {
        return null
    }

    return publishPreviewManifest(manifest)
}

export const publishStoredPreviewManifest = async ({
    projectId,
    versionId,
    manifestVersion,
    files,
}: {
    projectId: string
    versionId: string
    manifestVersion: string
    files: PreviewManifestStoredFile[]
}) => {
    const manifestFiles = files.reduce<PreviewManifestFile[]>((entries, file) => {
        const workspacePath = toPreviewWorkspacePath(file.path)

        if (!workspacePath) {
            return entries
        }

        entries.push({
            path: workspacePath,
            objectKey: file.key,
            size: file.size,
            ...(file.contentType ? { contentType: file.contentType } : {}),
        })

        return entries
    }, [])

    if (manifestFiles.length === 0) {
        return null
    }

    const manifest = createManifest({
        projectId,
        versionId,
        manifestVersion,
        files: manifestFiles,
    })

    if (!manifest.runnable) {
        return null
    }

    return publishPreviewManifest(manifest)
}

export const publishPreviewManifest = async (manifest: PreviewManifest) => {
    const manifestKey = previewManifestObjectKey(
        manifest.projectId,
        manifest.projectVersionId,
        manifest.manifestVersion
    )
    const ref: PreviewManifestRef = {
        manifestVersion: manifest.manifestVersion,
        manifestKey,
        projectId: manifest.projectId,
        projectVersionId: manifest.projectVersionId,
        publishedAt: manifest.publishedAt,
        runnable: manifest.runnable,
    }

    await putTextFile({
        key: manifestKey,
        content: JSON.stringify(manifest, null, 2),
        contentType: 'application/json; charset=utf-8',
    })

    await putTextFile({
        key: latestPreviewManifestRefKey(manifest.projectId, manifest.projectVersionId),
        content: JSON.stringify(ref, null, 2),
        contentType: 'application/json; charset=utf-8',
    })

    return ref
}

export const getLatestPreviewManifestRef = async (projectId: string, versionId: string) => {
    const content = await getTextFile(latestPreviewManifestRefKey(projectId, versionId))

    if (!content) {
        return null
    }

    const parsed = JSON.parse(content) as PreviewManifestRef
    return parsed
}
