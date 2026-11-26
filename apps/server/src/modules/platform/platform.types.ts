import type { GitRepo } from '@december/shared/git'

export type DeploySession = {
    sessionId: string
    userId: string
}

export type ListGithubRepos = {
    userId: string
    page?: number
    limit?: number
    search?: string
}

export type GithubRepo = GitRepo

export type GitlabRepo = GitRepo

export type ListGitlabRepos = {
    userId: string
    page?: number
    limit?: number
    search?: string
}

export type CreateRepo = {
    userId: string
    sessionId: string
    name: string
    private: boolean
    description?: string
}

export type UpdateRepo = {
    userId: string
    sessionId: string
    commitMessage?: string
}

export type UnlinkSession = {
    userId: string
    sessionId: string
}

export type ResolveRepoToken = {
    userId: string
    gitProvider: 'GITHUB' | 'GITLAB'
    owner?: string
}

export type CheckRepoBranch = {
    userId: string
    gitProvider: 'GITHUB' | 'GITLAB'
    // the full name of the repository: owner/name, or a gitlab group path
    repository: string
    branch: string
}
