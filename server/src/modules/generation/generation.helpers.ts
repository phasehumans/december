import { cleanPrompt } from '../../utils/cleanPrompt'
import { assertFrontendWorkspacePath } from './frontend-paths'
import type {
    ProjectPlan,
    RevisionBase,
    StoredProjectFile,
    VersionSummary,
} from './generation.types'

export const createProjectName = (prompt: string) => {
    const words = cleanPrompt(prompt)
        .split(' ')
        .filter(Boolean)
        .slice(0, 4)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

    const name = words.join(' ').trim()
    return name.length >= 3 ? name.slice(0, 40) : 'New Project'
}

export const assertFrontendOnlyPlan = (plan: ProjectPlan) => {
    const plannedFiles = plan.data?.files ?? []
    const invalidFile = plannedFiles.find((file) => {
        try {
            assertFrontendWorkspacePath(file.path, 'planned frontend file')
            return false
        } catch {
            return true
        }
    })

    if (invalidFile) {
        throw new Error(`plan agent returned non-frontend file: ${invalidFile.path}`)
    }
}

export const appendAssistantMessageContent = (existing: string, next: string) => {
    if (!next.trim()) {
        return existing
    }

    if (!existing.trim()) {
        return next.trim()
    }

    return `${existing.trim()}\n\n${next.trim()}`
}

export const getFilesInGenerationOrder = (plan: ProjectPlan) => {
    if (!plan.data) {
        throw new Error('project plan is missing data')
    }

    const plannedFiles = new Map(plan.data.files.map((file) => [file.path, file]))

    return plan.data.generationOrder.map((path) => {
        const file = plannedFiles.get(path)

        if (!file || !file.generate) {
            throw new Error(`generation order contains invalid file path: ${path}`)
        }

        return file
    })
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

export const mergeProjectFiles = ({
    currentFiles,
    updatedFiles,
    deletedFiles,
}: {
    currentFiles: Record<string, string>
    updatedFiles: Array<{ path: string; content: string }>
    deletedFiles: string[]
}) => {
    const mergedFiles = { ...currentFiles }

    for (const file of updatedFiles) {
        mergedFiles[file.path] = file.content
    }

    for (const path of deletedFiles) {
        delete mergedFiles[path]
    }

    const appliedFiles = updatedFiles
        .filter((file) => currentFiles[file.path] !== file.content)
        .map((file) => file.path)
    const removedFiles = deletedFiles.filter((path) => path in currentFiles)

    return {
        mergedFiles,
        appliedFiles,
        removedFiles,
    }
}

export const mapVersionSummary = (version: {
    id: string
    versionNumber: number
    label: string | null
    sourcePrompt: string
    summary: string | null
    status: 'GENERATING' | 'READY' | 'FAILED'
    objectStoragePrefix: string
    manifestJson: unknown
    createdAt: Date
    updatedAt: Date
}): VersionSummary => ({
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

export const toRecentMessages = (base: RevisionBase['baseVersion']) =>
    base.messages.slice(-8).map((message: any) => ({
        role: message.role,
        content: message.content,
    }))
