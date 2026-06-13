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
