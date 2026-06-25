export type DeployProject = {
    projectId: string
    userId: string
}

import type { Response } from 'express'

export type CreateVercelProject = {
    userId: string
    name: string
    repoOwner?: string
    repoName?: string
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

export type ListGithubRepos = {
    userId: string
}

export type GithubRepo = {
    id: number
    name: string
    fullName: string
    private: boolean
    defaultBranch: string
    updatedAt: string
    htmlUrl: string
    cloneUrl: string
    language: string | null
    description: string | null
    owner: {
        login: string
        avatarUrl: string
    }
}

export type CreateRepo = {
    userId: string
    projectId: string
    name: string
    private: boolean
    description?: string
}

export type UpdateRepo = {
    userId: string
    projectId: string
    commitMessage?: string
}

export type UnlinkProject = {
    userId: string
    projectId: string
}

export type SyncEnvVars = {
    userId: string
    projectId: string
    keys?: string[]
}

export type CancelDeployment = {
    userId: string
    deploymentId: string
}
