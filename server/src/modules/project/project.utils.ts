import type { StoredProjectFile } from './project.service'

export const isVersionSchemaMissing = (error: unknown) => {
    const message = error instanceof Error ? error.message.toLowerCase() : ''

    return (
        message.includes('projectversion') ||
        message.includes('projectmessage') ||
        message.includes('currentversionid') ||
        message.includes('versioncount')
    )
}

export const parseStoredProjectFiles = (value: unknown): StoredProjectFile[] => {
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

export const mapVersionSummary = (version: {
    id: string
    versionNumber: number
    label: string | null
    sourcePrompt: string
    summary: string | null
    status: string
    objectStoragePrefix: string
    manifestJson: unknown
    createdAt: Date
    updatedAt: Date
}) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    label: version.label ?? `v${version.versionNumber}`,
    sourcePrompt: version.sourcePrompt,
    summary: version.summary,
    status: version.status,
    objectStoragePrefix: version.objectStoragePrefix,
    fileCount: parseStoredProjectFiles(version.manifestJson).length,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
})
