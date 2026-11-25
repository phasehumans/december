// how December opens and handles pull requests, and what the GitHub App does on its own.
// the server saves them per user; the worker and the webhook read them with these defaults.

export type AutoReview = 'asked' | 'mine' | 'all'
export type ReviewCadence = 'once' | 'push'
export type ReviewReplies = 'all' | 'mention' | 'off'

export interface PullRequestSettingsValues {
    // opening (#637)
    branchPrefix: string
    prDraft: boolean
    prCreate: 'auto' | 'ask'
    prAuthor: 'december' | 'user'
    commitAuthor: 'both' | 'december'
    archiveOnMerge: boolean
    // github app (#568)
    githubCommentsEnabled: boolean
    reviewReplies: ReviewReplies
    replyToBots: boolean
    fixFailedChecks: boolean
    autoReview: AutoReview
    reviewCadence: ReviewCadence
    // empty means every repository the app can see
    reviewRepos: string[]
}

export const PULL_REQUEST_SETTING_DEFAULTS: PullRequestSettingsValues = {
    branchPrefix: 'december/',
    prDraft: false,
    prCreate: 'auto',
    prAuthor: 'december',
    commitAuthor: 'both',
    archiveOnMerge: true,
    githubCommentsEnabled: true,
    reviewReplies: 'mention',
    replyToBots: false,
    fixFailedChecks: true,
    autoReview: 'asked',
    reviewCadence: 'once',
    reviewRepos: [],
}

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback

/** a saved row (or null) as complete settings; unknown values fall back to the defaults */
export const toPullRequestSettings = (
    row: Partial<Record<keyof PullRequestSettingsValues, unknown>> | null | undefined
): PullRequestSettingsValues => {
    const d = PULL_REQUEST_SETTING_DEFAULTS
    if (!row) return { ...d, reviewRepos: [] }
    return {
        branchPrefix: typeof row.branchPrefix === 'string' ? row.branchPrefix : d.branchPrefix,
        prDraft: typeof row.prDraft === 'boolean' ? row.prDraft : d.prDraft,
        prCreate: pick(row.prCreate, ['auto', 'ask'] as const, d.prCreate),
        prAuthor: pick(row.prAuthor, ['december', 'user'] as const, d.prAuthor),
        commitAuthor: pick(row.commitAuthor, ['both', 'december'] as const, d.commitAuthor),
        archiveOnMerge:
            typeof row.archiveOnMerge === 'boolean' ? row.archiveOnMerge : d.archiveOnMerge,
        githubCommentsEnabled:
            typeof row.githubCommentsEnabled === 'boolean'
                ? row.githubCommentsEnabled
                : d.githubCommentsEnabled,
        reviewReplies: pick(row.reviewReplies, ['all', 'mention', 'off'] as const, d.reviewReplies),
        replyToBots: typeof row.replyToBots === 'boolean' ? row.replyToBots : d.replyToBots,
        fixFailedChecks:
            typeof row.fixFailedChecks === 'boolean' ? row.fixFailedChecks : d.fixFailedChecks,
        autoReview: pick(row.autoReview, ['asked', 'mine', 'all'] as const, d.autoReview),
        reviewCadence: pick(row.reviewCadence, ['once', 'push'] as const, d.reviewCadence),
        reviewRepos: Array.isArray(row.reviewRepos)
            ? row.reviewRepos.filter((r): r is string => typeof r === 'string')
            : [],
    }
}

// "create the pull request" (prCreate) and the "open pull request" default of a new session
// are one stored value: User.defaultOpenPullRequest. 'auto' is on, 'ask' is off. the
// prCreate column of the settings row is not read or written.
export const toPrCreate = (
    defaultOpenPullRequest: boolean
): PullRequestSettingsValues['prCreate'] => (defaultOpenPullRequest ? 'auto' : 'ask')

export const toDefaultOpenPullRequest = (
    prCreate: PullRequestSettingsValues['prCreate']
): boolean => prCreate === 'auto'

/**
 * Is this a branch name git takes (the rules of `git check-ref-format --branch`), made
 * only of letters, digits and `. _ / -`. So: no `..`, no part that starts with `.` or
 * ends with `.lock`, no control characters, spaces or `~ ^ : ? * [ \`, no `@{`, no `/`
 * or `.` at the end, no `/` or `-` at the start, no empty part.
 */
export const isValidBranchName = (name: string): boolean => {
    if (!name || name.length > 200) return false
    if (!/^[A-Za-z0-9._/-]+$/.test(name)) return false
    if (name.startsWith('-') || name.startsWith('/')) return false
    if (name.endsWith('/') || name.endsWith('.')) return false
    if (name.includes('..') || name.includes('//') || name.includes('@{')) return false
    return name.split('/').every((part) => !part.startsWith('.') && !part.endsWith('.lock'))
}

/**
 * Can this branch prefix be saved: `<prefix><session id>` must be a valid branch name.
 * An empty prefix is allowed (the branch is the session id).
 */
export const checkBranchPrefix = (prefix: string): { ok: true } | { ok: false; reason: string } =>
    isValidBranchName(`${prefix}session-1`)
        ? { ok: true }
        : { ok: false, reason: 'branchPrefix does not give a branch name git allows' }

// a branch name made of the prefix and a suffix, with characters git refuses taken out.
// a name git still refuses becomes december/<suffix>
export const toBranchName = (prefix: string, suffix: string): string => {
    const clean = `${prefix}${suffix}`
        .replace(/[^A-Za-z0-9._/-]+/g, '-')
        .replace(/\/{2,}/g, '/')
        .replace(/\.{2,}/g, '.')
        .replace(/^[/.-]+/, '')
        .replace(/[/.]+$/, '')
    return isValidBranchName(clean) ? clean : `december/${suffix}`
}

/** the github run a session was started for (Session.githubRun) */
export type GithubRunMode = 'issue' | 'change' | 'review'

export interface GithubRun {
    mode: GithubRunMode
    installationId: string
    repoFullName: string
    repoOwner: string
    repoName: string
    // the issue or pull request number
    number: number
    title: string
    // who asked (a github login), or "december" for runs December starts on its own
    requestedBy: string
    // the branch the work starts from: the default branch (issue) or the pull request base
    baseRef: string
    // pull requests only: the head branch and commit
    headRef?: string
    headSha?: string
    // why December started on its own: an automatic review, a failed check, a review comment
    trigger?: 'comment' | 'auto_review' | 'failed_checks' | 'review_comment'
}

export const isGithubRun = (value: unknown): value is GithubRun => {
    const run = value as GithubRun | null
    return Boolean(
        run &&
        typeof run === 'object' &&
        ['issue', 'change', 'review'].includes(run.mode) &&
        typeof run.installationId === 'string' &&
        typeof run.repoFullName === 'string' &&
        typeof run.number === 'number'
    )
}
