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
    // a draft pull request on github, a "Draft:" merge request on gitlab
    draft?: boolean
}

export interface GetPullRequestInput {
    token: string
    repoPath: string
    number: number
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
    mergedAt?: string | null
    closedAt?: string | null
    /** the host's id of the repository the pull request is in, when the host sends it */
    repoId?: string
}

/** a read of one pull request waits this long at most: a host that hangs is no answer */
export const PULL_REQUEST_READ_TIMEOUT_MS = 10_000

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

export interface RepoDirInput {
    token: string
    repoPath: string
    // the folder from the repository root; '' is the root
    path: string
}

export interface RepoBranchInput {
    token: string
    repoPath: string
    branch: string
}

export interface RepoDirEntry {
    name: string
    // from the repository root
    path: string
    type: 'file' | 'dir'
}

export interface RepoFileInput {
    token: string
    repoPath: string
    path: string
    // a larger file is not returned
    maxBytes: number
}

export interface RepoTextFile {
    // bytes
    size: number
    // null when the file is larger than maxBytes
    content: string | null
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

// the account a token belongs to, as the host gives it
export interface GitHostUser {
    id: string
    login: string
    name: string | null
    // github: the public email. gitlab: the commit email, then the account email
    email: string | null
}

export interface GitProvider {
    name: GitProviderName
    // the account of the token, or null when the host refuses it or does not answer
    getUser: (data: { token: string }) => Promise<GitHostUser | null>
    // null when the url is not on this host
    parseRepoUrl: (url: string) => RepoRef | null
    getCloneUrl: (data: CloneUrlInput) => string
    listRepos: (data: ListReposInput) => Promise<GitRepo[]>
    // opens the pull request, or returns the one already open for the head branch.
    // null when the host refused both.
    createPullRequest: (data: CreatePullRequestInput) => Promise<PullRequest | null>
    // null when the request is refused or the network fails
    getPullRequest: (data: GetPullRequestInput) => Promise<PullRequest | null>
    getCiStatus: (data: CiStatusInput) => Promise<CiStatus>
    comment: (data: CommentInput) => Promise<void>
    // the files and folders of one folder at the default branch (links and submodules are
    // left out). throws GitProviderError with the status of the host: 404 when this token
    // cannot read the repository or the folder is not there.
    listDir: (data: RepoDirInput) => Promise<RepoDirEntry[]>
    // a file at the default branch as utf-8 text. throws like listDir.
    readTextFile: (data: RepoFileInput) => Promise<RepoTextFile>
    // true when the repository has the branch, false when the host answers 404 (no such
    // branch, or this token cannot read the repository). throws GitProviderError otherwise.
    hasBranch: (data: RepoBranchInput) => Promise<boolean>
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

// the base64 body of a file from a git host as utf-8 text. the size is counted here, so a
// host that reports a wrong size cannot pass the cap.
export const decodeRepoFile = (base64: string, maxBytes: number): RepoTextFile => {
    const bytes = Uint8Array.from(atob(base64.replace(/\s/g, '')), (char) => char.charCodeAt(0))
    if (bytes.length > maxBytes) return { size: bytes.length, content: null }
    return { size: bytes.length, content: new TextDecoder().decode(bytes) }
}
