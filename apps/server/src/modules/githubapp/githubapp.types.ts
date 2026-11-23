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

export type ClaimInstallation = {
    installationId: string
    userId: string
}

export type ClaimInstallationReason =
    | 'already_owned'
    | 'owned_by_other_user'
    | 'unverified'
    | 'account_matches'
    | 'account_mismatch'
    | 'recent_unclaimed'
    | 'stale_unclaimed'

export type ClaimInstallationResult = {
    linked: boolean
    reason: ClaimInstallationReason
}

export type CanClaimInstallation = {
    existingUserId?: string | null
    userId: string
    userGithubId?: string | null
    details: {
        created_at?: string
        account?: { id?: number | string; type?: string }
    } | null
    now?: Date
}

export type FindInstallationOwner = {
    accountId?: string
    accountType?: string
    senderId?: string
}

export type ResolveInstallReturnUrl = {
    returnUrl: string
    appUrl?: string
    isProduction?: boolean
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

export type HandlePullRequestOpened = {
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
    pullRequest: {
        number: number
        title: string
        body?: string | null
        head: {
            ref: string
            sha?: string
        }
        base: {
            ref: string
        }
        user: {
            login: string
            id?: number
        }
        authorAssociation?: string | null
    }
}

export type HandlePullRequestOpenedResult = {
    handled: boolean
    reason?: string
    pullRequestNumber?: number
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
    commentId?: number
    commentAuthor: string
    prompt: string
    userId?: string | null
    isPullRequest?: boolean
    pullRequestHead?: string
    pullRequestBase?: string
    slackWebhookUrl?: string
    discordWebhookUrl?: string
}

// one GitHub webhook event that may go into the owner's inbox
export type GithubActivity =
    | {
          kind: 'comment'
          isPullRequest: boolean
          body: string
          url?: string
      }
    | {
          kind: 'review_comment'
          body: string
          path?: string
          url?: string
      }
    | {
          kind: 'review'
          state: string
          body: string
          url?: string
      }
    | {
          kind: 'checks_failed'
      }

export type NotifyGithubActivity = {
    installationId?: string
    repoOwner: string
    repoName: string
    number: number
    actorLogin?: string
    actorType?: string
    prAuthorLogin?: string
    activity: GithubActivity
}

export type FindPullRequestOwner = {
    installationId?: string
    repoOwner: string
    repoName: string
    prNumber: number
    prAuthorLogin?: string
}
