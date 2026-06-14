export type GetAllProjects = {
    userId: string
}

export type GetProject = {
    userId: string
    projectId: string
    versionId?: string
}

export type CreateProject = {
    name: string
    description: string | undefined
    prompt: string
    userId: string
}

export type RenameProject = {
    projectId: string
    userId: string
    rename: string
}

export type UpdateGeneralSettings = {
    projectId: string
    userId: string
    name?: string
    description?: string | null
    isStarred?: boolean
    isSharedAsTemplate?: boolean
    projectCategory?:
        | 'LANDING_PAGE'
        | 'DASHBOARD'
        | 'PORTFOLIO_BLOG'
        | 'SAAS_APP'
        | 'ECOMMERCE'
        | 'NONE'
}

export type DeleteProject = {
    userId: string
    projectId: string
}

export type DuplicateProject = {
    userId: string
    projectId: string
    name?: string
}

export type ShareProject = {
    userId: string
    projectId: string
    isSharedAsTemplate: boolean
    projectCategory?:
        | 'LANDING_PAGE'
        | 'DASHBOARD'
        | 'PORTFOLIO_BLOG'
        | 'SAAS_APP'
        | 'ECOMMERCE'
        | 'NONE'
}

export type ToggleStarProject = {
    userId: string
    projectId: string
    isStarred: boolean
}

export type StoredProjectFile = {
    path: string
    key: string
    contentType?: string
    size: number
}

export type CopyProjectVersionsAndMessages = {
    sourceProjectId: string
    newProjectId: string
    newUserId: string
    sourceCurrentVersionId: string | null
}

export type ProjectVersionSummaryInput = {
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
}

export type ProjectVersionSummary = {
    id: string
    versionNumber: number
    label: string
    sourcePrompt: string
    summary: string | null
    status: string
    objectStoragePrefix: string
    fileCount: number
    createdAt: Date
    updatedAt: Date
}
