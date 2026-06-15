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
