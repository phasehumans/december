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

/** the repositories of one git host, as the settings page and the prompt box read them */
export type RepoList = {
    repos: GitRepo[]
    /** github accounts whose install could not be read (removed or suspended) */
    unavailable: string[]
    /** true when the host has more than the cap (1,000) */
    truncated: boolean
}

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
