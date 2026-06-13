import type { Response } from 'express'

export type ListGithubRepos = {
    userId: string
}

export type ConnectVercel = {
    code: string
    userId: string
    teamId?: string
    configurationId?: string
}

export type ConnectSupabase = {
    userId: string
    code: string
}

export type ConnectNotion = {
    userId: string
    code: string
}

export type ConnectGithub = {
    userId: string
    accessToken: string
    username: string
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
