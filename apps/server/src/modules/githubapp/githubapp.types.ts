export type GitHubAppInstallationPayload = {
    action: string
    installation: {
        id: number | string
        account?: {
            login?: string
            type?: string
        }
        target_type?: string
        permissions?: Record<string, string>
    }
    sender?: {
        id?: number | string
        login?: string
    }
}

export type ProcessInstallation = {
    installationId: string
    userId?: string | null
    accountLogin?: string
    accountType?: string
    targetType?: string
    permissions?: Record<string, string>
}

export type ProcessUninstallation = {
    installationId: string
}

export type VerifySignature = {
    payload: string
    signature: string
}

export type GetInstallationAccessToken = {
    installationId: string
}

export type GetUserInstallationToken = {
    userId: string
    owner?: string
}

export type GetUserInstallationRepos = {
    userId: string
    page?: number
    limit?: number
    search?: string
}

export type GetUserInstallationStatus = {
    userId: string
}

export type GithubInstallationRepo = {
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

export type InstallationStatusResponse = {
    installed: boolean
    installationId: string | null
    accountLogin: string | null
    accountType: string | null
    targetType: string | null
}

export type HandleIssueComment = {
    installationId: string
    repository: {
        name: string
        fullName: string
        owner: {
            login: string
        }
        defaultBranch?: string
        private?: boolean
    }
    issue: {
        number: number
        title: string
        body?: string | null
        pullRequest?: any
    }
    comment: {
        id: number
        body: string
        user: {
            login: string
            id?: number
        }
        authorAssociation?: string | null
    }
}

export type HandleIssueCommentResult = {
    handled: boolean
    reason?: string
    issueNumber?: number
    jobId?: string
}

export type GithubIssueJobData = {
    taskType: 'github_issue_fix'
    installationId: string
    gitToken: string
    repoFullName: string
    repoOwner: string
    repoName: string
    defaultBranch: string
    issueNumber: number
    issueTitle: string
    issueBody: string
    commentId: number
    commentAuthor: string
    prompt: string
    userId?: string | null
}
