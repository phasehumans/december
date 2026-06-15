import { currentKey, versionKey, putTextFile } from './project-storage'

export type GeneratedStorageFile = {
    path: string
    content: string
    contentType?: string
}

export type SavedStorageFile = GeneratedStorageFile & {
    key: string
    size: number
}

function guessContentType(path: string) {
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

export async function saveProjectFiles({
    projectId,
    versionId,
    files,
}: {
    projectId: string
    versionId: string
    files: GeneratedStorageFile[]
}) {
    const savedFiles = files.map((file) => {
        const contentType = file.contentType ?? guessContentType(file.path)

        return {
            ...file,
            contentType,
            key: versionKey(projectId, versionId, file.path),
            size: Buffer.byteLength(file.content, 'utf8'),
        }
    })

    await Promise.all(
        savedFiles.flatMap((file) => [
            putTextFile({
                key: file.key,
                content: file.content,
                contentType: file.contentType,
            }),
            putTextFile({
                key: currentKey(projectId, file.path),
                content: file.content,
                contentType: file.contentType,
            }),
        ])
    )

    return savedFiles satisfies SavedStorageFile[]
}
