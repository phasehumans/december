import type { GithubRun, PullRequestSettingsValues } from '@december/shared'
import type { GitRepo } from '@december/shared/git'

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
    /** the user authorization code github sends with the install (V1) */
    code?: string
}

export type VerifyInstallationAccess = {
    code: string
    installationId: string
}

export type InstallationAccess = {
    hasAccess: boolean
    /** the github id of the user who authorized, when github answered */
    githubId: string | null
}

export type ClaimInstallationReason =
    | 'already_owned'
    | 'owned_by_other_user'
    | 'unverified'
    | 'account_matches'
    | 'account_mismatch'
    | 'user_has_access'

export type ClaimInstallationResult = {
    linked: boolean
    reason: ClaimInstallationReason
}

/** why the install did not link, sent back to the web page as ?github=<problem> */
export type InstallProblem = 'in_use' | 'unverified' | 'signed_out' | 'requested'

export type CanClaimInstallation = {
    existingUserId?: string | null
    userId: string
    userGithubId?: string | null
    details: {
        created_at?: string
        account?: { id?: number | string; type?: string }
    } | null
    /** github listed this install among the ones the authorizing user can see */
    userHasAccess?: boolean
}

export type FindInstallationOwner = {
    accountId?: string
    accountType?: string
    senderId?: string
}

export type ToLocalCallbackUrl = {
    returnUrl: string
    installationId?: string
    setupAction?: string
    state?: string
    /** the user authorization code of the install, for the local server to check */
    code?: string
    isProduction?: boolean
}

export type ResolveInstallReturnUrl = {
    returnUrl: string
    appUrl?: string
    isProduction?: boolean
}

export type ProcessUninstallation = {
    installationId: string
}

export type NotifyInstallationLost = {
    installationId: string
    reason: 'removed' | 'suspended'
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

export type GithubInstallationRepo = GitRepo

export type InstallationRepoList = {
    repos: GithubInstallationRepo[]
    /** the accounts whose install could not be read (removed or suspended on github) */
    unavailable: string[]
}

export type InstallationStatusResponse = {
    installed: boolean
    installationId: string | null
    accountLogin: string | null
    accountType: string | null
    targetType: string | null
}

type WebhookRepository = {
    /** github's id of the repository: it stays when the repository is renamed */
    id?: string
    name: string
    fullName: string
    owner: {
        login: string
    }
    defaultBranch?: string
    private?: boolean
}

export type HandleIssueComment = {
    installationId: string
    repository: WebhookRepository
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
            type?: string
        }
        authorAssociation?: string | null
    }
}

export type HandleGithubEventResult = {
    handled: boolean
    reason?: string
    sessionId?: string
}

// pull_request opened, synchronize or ready_for_review: an automatic review
export type HandlePullRequestEvent = {
    installationId: string
    action: string
    repository: WebhookRepository
    pullRequest: {
        number: number
        title: string
        body?: string | null
        draft?: boolean
        head: {
            ref: string
            sha?: string
            repoFullName?: string
        }
        base: {
            ref: string
        }
        user: {
            login: string
            type?: string
        }
        // the author's role in the repository: OWNER, MEMBER, COLLABORATOR, NONE, ...
        authorAssociation?: string | null
    }
}

// pull_request_review_comment created: a comment on a line of a pull request
export type HandleReviewComment = {
    installationId: string
    repository: WebhookRepository
    pullRequest: {
        number: number
        title: string
        body?: string | null
        authorLogin?: string
        head: {
            ref: string
            sha?: string
            repoFullName?: string
        }
        base: {
            ref: string
        }
    }
    comment: {
        id: number
        body: string
        path?: string
        line?: number | null
        diffHunk?: string
        user: {
            login: string
            type?: string
        }
        authorAssociation?: string | null
    }
}

// check_suite completed with a failure on a pull request
export type HandleCheckSuite = {
    installationId: string
    repository: WebhookRepository
    conclusion?: string | null
    headSha?: string
    pullRequestNumbers: number[]
}

export type StartGithubRun = {
    token: string
    userId: string
    run: GithubRun
    // the text the agent works from: the issue or pull request body and the request
    body: string
    instruction: string
    // extra context for the prompt (a review comment's file and lines, failed checks)
    context?: string
    // post "on it" with the session link (runs a person asked for)
    announce: boolean
}

export type StartGithubRunResult = {
    started: boolean
    reason?: string
    sessionId?: string
}

export type ResolveRunModel = {
    userId: string
    defaultModelSource: 'CREDITS' | 'OWN_KEY'
}

export type RunModelChoice =
    | {
          ok: true
          billingSource: 'CREDITS' | 'OWN_KEY'
          provider?: string
          model?: string
      }
    | { ok: false; message: string }

export type ShouldAutoReview = {
    settings: PullRequestSettingsValues
    action: string
    draft: boolean
    authorLogin: string
    authorType?: string
    // the author's role in the repository; only owners, members and collaborators count
    authorAssociation?: string | null
    ownerGithubLogin?: string | null
}

export type BuildGithubRunPrompt = {
    run: GithubRun
    body: string
    instruction: string
    context?: string
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
    /** github's id of the repository, when the webhook sends it */
    repoId?: string
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
    /** github's id of the repository: a session that saved it matches only by it */
    repoId?: string
    repoOwner: string
    repoName: string
    prNumber: number
    prAuthorLogin?: string
}

/** a pull request changed on github: the state december saves on its sessions (#632) */
export type PullRequestStateEvent = {
    gitProvider: 'GITHUB'
    /** github's id of the repository: it stays the same when the repository is renamed */
    repoId?: string
    repoOwner: string
    repoName: string
    number: number
    state: 'open' | 'draft' | 'merged' | 'closed'
    title?: string
    additions?: number
    deletions?: number
    openedAt?: string | null
    mergedAt?: string | null
    closedAt?: string | null
    /** the last change of the pull request on github */
    updatedAt?: string | null
}
