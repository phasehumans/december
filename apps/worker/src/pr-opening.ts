import { isValidBranchName, toBranchName } from '@december/shared'

import { shellQuote as sh } from './shell-quote'

import type { PullRequestSettingsValues } from '@december/shared'
import type { GitProviderName } from '@december/shared/git'

/**
 * The pull request "opening" settings of a user (#637) as decisions for one cloud session:
 * the task branch, the commit author and the token that opens the pull request. Nothing in
 * this file reads the database, the sandbox or the network.
 */

export interface CommitIdentity {
    name: string
    email: string
}

export const DECEMBER_IDENTITY: CommitIdentity = {
    name: 'December Agent',
    email: 'agent@trydecember.com',
}

/** the branch of a session from before the prefix setting, and of a GitHub App run */
export const legacyTaskBranch = (sessionId: string): string => `december/${sessionId}`

/**
 * The branch a session's work goes to. A session keeps its branch for its whole life: the
 * saved name wins, also after the user changes the prefix. A session from before the
 * setting has nothing saved and still is on `december/<sessionId>`. A saved name git
 * refuses is not used, and a prefix that gives such a name falls back to
 * `december/<sessionId>` (review E2).
 */
export const pickTaskBranch = (data: {
    sessionId: string
    branchPrefix: string
    savedBranch?: string | null
    currentBranch?: string | null
}): string => {
    const { sessionId, branchPrefix, savedBranch, currentBranch } = data
    if (savedBranch && isValidBranchName(savedBranch)) return savedBranch
    const legacy = legacyTaskBranch(sessionId)
    if (currentBranch?.trim() === legacy) return legacy
    const named = toBranchName(branchPrefix, sessionId)
    return isValidBranchName(named) ? named : legacy
}

/**
 * The branch name to save on the session, or null to leave the row as it is. It is saved
 * once: when nothing is saved, or when the saved name is one git refuses (the repair of
 * an old bad name). A name git refuses is never saved.
 */
export const branchToSave = (data: {
    savedBranch?: string | null
    taskBranch: string
}): string | null => {
    const { savedBranch, taskBranch } = data
    if (!isValidBranchName(taskBranch)) return null
    if (savedBranch && isValidBranchName(savedBranch)) return null
    return taskBranch
}

/** the user's account on the git host is needed only when the user is the commit author */
export const needsUserIdentity = (commitAuthor: PullRequestSettingsValues['commitAuthor']) =>
    commitAuthor === 'both'

/** "december" opens the pull request as the December GitHub App; GitLab has no app */
export const wantsAppToken = (data: {
    prAuthor: PullRequestSettingsValues['prAuthor']
    provider: GitProviderName
}): boolean => {
    const { prAuthor, provider } = data
    return prAuthor === 'december' && provider === 'GITHUB'
}

/** the branch and the commit author of a session the GitHub App started: December's own */
export const githubRunGit = (sessionId: string) => ({
    taskBranch: legacyTaskBranch(sessionId),
    author: DECEMBER_IDENTITY,
})

/** the text of the error event when the branch or the push failed (review E2) */
export const gitStepFailure = (data: { step: 'checkout' | 'push'; branch: string }) => {
    const { step, branch } = data
    const error =
        step === 'checkout'
            ? `Could not switch to the branch ${branch}. The work is not pushed and stays in the sandbox.`
            : `Could not push the branch ${branch}. The work is committed and stays in the sandbox.`
    return {
        type: 'AgentError',
        code: step === 'checkout' ? 'GIT_BRANCH_FAILED' : 'GIT_PUSH_FAILED',
        error,
        message: error,
    }
}

/**
 * The user as a commit author, from the account on the git host. The no-reply address of
 * the host is used when the email is not known. null when the account is not known.
 */
export const toUserIdentity = (data: {
    provider: GitProviderName
    id?: string | number | null
    login?: string | null
    name?: string | null
    email?: string | null
}): CommitIdentity | null => {
    const { provider, id, login, name, email } = data
    const cleanLogin = login?.trim()
    const cleanEmail = email?.trim()
    const displayName = name?.trim() || cleanLogin
    if (!displayName) return null
    if (cleanEmail) return { name: displayName, email: cleanEmail }
    if (!cleanLogin) return null

    const hasId = id !== null && id !== undefined && String(id).trim() !== ''
    if (provider === 'GITLAB') {
        return hasId
            ? { name: displayName, email: `${id}-${cleanLogin}@users.noreply.gitlab.com` }
            : null
    }
    return {
        name: displayName,
        email: hasId
            ? `${id}+${cleanLogin}@users.noreply.github.com`
            : `${cleanLogin}@users.noreply.github.com`,
    }
}

/** counts the commits of HEAD that no remote branch has */
export const AHEAD_COUNT_COMMAND = 'git rev-list --count HEAD --not --remotes'

/**
 * Is there work to push when a run ends. Changed or new files count, and so do commits
 * the agent made itself: the tree is clean then, but no remote branch has the commits.
 * `aheadCount` is the output of AHEAD_COUNT_COMMAND, or null when it failed.
 */
export const hasWorkToPublish = (data: {
    statusOutput: string
    aheadCount?: string | null
}): boolean => {
    const { statusOutput, aheadCount } = data
    if (statusOutput.trim()) return true
    const ahead = (aheadCount ?? '').trim()
    return /^\d+$/.test(ahead) && Number(ahead) > 0
}

/** "december": December alone. "both": the user, with December as Co-authored-by */
export const pickCommitAuthor = (data: {
    commitAuthor: PullRequestSettingsValues['commitAuthor']
    user: CommitIdentity | null
}): { author: CommitIdentity; coAuthor: CommitIdentity | null } => {
    const { commitAuthor, user } = data
    if (commitAuthor === 'both' && user) return { author: user, coAuthor: DECEMBER_IDENTITY }
    return { author: DECEMBER_IDENTITY, coAuthor: null }
}

export const gitIdentityCommand = (identity: CommitIdentity, global = false): string => {
    const scope = global ? ' --global' : ''
    return `git config${scope} user.name ${sh(identity.name)} && git config${scope} user.email ${sh(identity.email)}`
}

export const gitCommitCommand = (data: {
    subject: string
    coAuthor: CommitIdentity | null
}): string => {
    const { subject, coAuthor } = data
    const trailer = coAuthor
        ? ` -m ${sh(`Co-authored-by: ${coAuthor.name} <${coAuthor.email}>`)}`
        : ''
    return `git add -A && git commit -m ${sh(subject)}${trailer}`
}

/**
 * The tokens to open the pull request with, in order. "december" opens it as the December
 * GitHub App when the app is on the repository; the user's token is the fallback. GitLab
 * has no December app, so it always uses the user's token.
 */
export const pickPullRequestTokens = (data: {
    prAuthor: PullRequestSettingsValues['prAuthor']
    provider: GitProviderName
    userToken: string
    appToken: string | null
}): string[] => {
    const { prAuthor, provider, userToken, appToken } = data
    if (wantsAppToken({ prAuthor, provider }) && appToken) {
        return [appToken, userToken]
    }
    return [userToken]
}
