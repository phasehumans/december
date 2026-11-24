// the git hosts december cloud can work with. same values as the prisma enum GitProvider.
export type GitProviderName = 'GITHUB' | 'GITLAB'

export type CiStatus = 'passing' | 'pending' | 'failed'

// the state december saves on the session (Session.prState)
export type PullRequestStatus = 'open' | 'draft' | 'merged' | 'closed'

export interface GitRepo {
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
    provider: GitProviderName
}

export interface RepoRef {
    // github: the user or org. gitlab: the full namespace, which can hold subgroups (a/b/c)
    owner: string
    name: string
    // owner/name
    path: string
}

export interface ListReposInput {
    token: string
    page?: number
    limit?: number
    search?: string
}

export interface CloneUrlInput {
    token: string
    repoPath: string
}

export interface CreatePullRequestInput {
    token: string
    repoPath: string
    title: string
    head: string
    base: string
    body: string
}

// a github pull request or a gitlab merge request
export interface PullRequest {
    number: number
    url: string
    title: string
    // github's state word: open or closed (gitlab's opened becomes open)
    state: string
    status: PullRequestStatus
    headSha?: string
    additions: number
    deletions: number
    changedFiles?: number
    createdAt?: string
    updatedAt?: string
}

export interface CiStatusInput {
    token: string
    repoPath: string
    sha: string
}

export interface CommentInput {
    token: string
    repoPath: string
    issueNumber: number | string
    body: string
}

export interface OAuthApp {
    clientId: string
    clientSecret: string
    redirectUri: string
}

export interface RefreshTokenInput extends OAuthApp {
    refreshToken: string
}

export interface TokenSet {
    accessToken: string
    refreshToken: string | null
    expiresAt: Date | null
}

export interface GitProvider {
    name: GitProviderName
    // null when the url is not on this host
    parseRepoUrl: (url: string) => RepoRef | null
    getCloneUrl: (data: CloneUrlInput) => string
    listRepos: (data: ListReposInput) => Promise<GitRepo[]>
    // opens the pull request, or returns the one already open for the head branch.
    // null when the host refused both.
    createPullRequest: (data: CreatePullRequestInput) => Promise<PullRequest | null>
    getCiStatus: (data: CiStatusInput) => Promise<CiStatus>
    comment: (data: CommentInput) => Promise<void>
    refreshToken: (data: RefreshTokenInput) => Promise<TokenSet>
}

export class GitProviderError extends Error {
    status: number

    constructor(message: string, status: number) {
        super(message)
        this.name = 'GitProviderError'
        this.status = status
    }
}
