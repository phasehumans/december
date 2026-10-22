export type DeploySession = {
    sessionId: string
    userId: string
}

export type DownloadSession = {
    sessionId: string
    userId: string
}

export type DownloadSessionResult = {
    fileName: string
    downloadUrl?: string
    zip?: Uint8Array | Buffer
}

export type ListGithubRepos = {
    userId: string
    page?: number
    limit?: number
    search?: string
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
