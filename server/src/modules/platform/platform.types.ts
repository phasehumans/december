export type DeployProject = {
    projectId: string
    userId: string
}

export type GetProject = {
    userId: string
    projectId: string
    versionId?: string
}

import type { Response } from 'express'

export type CreateVercelProject = {
    userId: string
    name: string
    repoOwner: string
    repoName: string
}

export type GetDeploymentByCommit = {
    userId: string
    vercelProjectId: string
    commitSha: string
}

export type GetLatestDeployment = {
    userId: string
    vercelProjectId: string
}

export type GetDeploymentStatus = {
    userId: string
    deploymentId: string
}

export type StreamBuildLogs = {
    userId: string
    deploymentId: string
    res: Response
}
