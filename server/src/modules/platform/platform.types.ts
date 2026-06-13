export type DeployProject = {
    projectId: string
    userId: string
}

export type GetProject = {
    userId: string
    projectId: string
    versionId?: string
}
