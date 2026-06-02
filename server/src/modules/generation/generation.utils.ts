export const cleanPrompt = (input: string): string => {
    if (!input) {
        return ''
    }
    return input.replace(/\r\n?/g, ' ').replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()
}

export const parsePartialArray = (jsonString: string, key: string): string => {
    const startRegex = new RegExp(`"${key}"\\s*:\\s*\\[`)
    const match = startRegex.exec(jsonString)
    if (!match) return ''

    const content = jsonString.slice(match.index + match[0].length)
    const endIdx = content.indexOf('],')
    const arrayStr = endIdx === -1 ? content : content.slice(0, endIdx)

    const stringMatches = [...arrayStr.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)]
    try {
        return stringMatches.map((m) => JSON.parse(`"${m[1]}"`)).join('\n\n')
    } catch {
        return ''
    }
}

const ROOT_FRONTEND_FILE_PATTERNS = [
    /^\.gitignore$/,
    /^build\.ts$/,
    /^bun-env\.d\.ts$/,
    /^README\.md$/,
    /^tsconfig\.json$/,
    /^package\.json$/,
    /^index\.html$/,
]

const FRONTEND_DIRECTORY_PREFIXES = ['src/', 'public/']
const DISALLOWED_PREFIXES = ['server/', 'api/', 'prisma/']
const DISALLOWED_EXACT_PATHS = new Set([
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    '.env.test',
])

export const isFrontendWorkspacePath = (path: string) => {
    const trimmedPath = path.trim()

    if (!trimmedPath || trimmedPath !== path) {
        return false
    }

    if (trimmedPath.includes('\\') || trimmedPath.startsWith('/') || trimmedPath.includes('../')) {
        return false
    }

    if (DISALLOWED_EXACT_PATHS.has(trimmedPath) || trimmedPath.startsWith('.env.')) {
        return false
    }

    if (DISALLOWED_PREFIXES.some((prefix) => trimmedPath.startsWith(prefix))) {
        return false
    }

    if (FRONTEND_DIRECTORY_PREFIXES.some((prefix) => trimmedPath.startsWith(prefix))) {
        return true
    }

    return ROOT_FRONTEND_FILE_PATTERNS.some((pattern) => pattern.test(trimmedPath))
}

export const assertFrontendWorkspacePath = (path: string, label = 'frontend file') => {
    if (!isFrontendWorkspacePath(path)) {
        throw new Error(
            `${label} must stay in src/, public/, or approved frontend root files: ${path}`
        )
    }
}

export const toPreviewWorkspacePath = (path: string) => {
    if (path.startsWith('web/')) {
        const legacyPath = path.slice('web/'.length)
        return isFrontendWorkspacePath(legacyPath) ? legacyPath : null
    }

    return isFrontendWorkspacePath(path) ? path : null
}

import type {
    ProjectChangePlan,
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

export const assertFrontendOnlyChangePlan = (plan: ProjectChangePlan) => {
    const operations = plan.data?.operations ?? []
    const invalidOperation = operations.find((operation) => {
        try {
            assertFrontendWorkspacePath(operation.path, 'planned frontend patch file')
            return false
        } catch {
            return true
        }
    })

    if (invalidOperation) {
        throw new Error(`plan agent returned non-frontend patch file: ${invalidOperation.path}`)
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

    return plan.data.buildOrder.map((path) => {
        const file = plannedFiles.get(path)

        if (!file || !file.generate) {
            throw new Error(`build order contains invalid file path: ${path}`)
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
