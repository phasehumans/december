export interface BotMentionResult {
    isMentioned: boolean
    instruction: string
}

export interface CommentReactionParams {
    token: string
    owner: string
    repo: string
    commentId: number | string
    reaction?: string
}

export interface IssueReactionParams {
    token: string
    owner: string
    repo: string
    issueNumber: number | string
    reaction?: string
}

export interface IssueCommentParams {
    token: string
    owner: string
    repo: string
    issueNumber: number | string
    body: string
}

export interface PullRequestParams {
    token: string
    owner: string
    repo: string
    title: string
    head: string
    base: string
    body: string
    draft?: boolean
}

// what a comment asks December to do: review a pull request, or any other task
export type BotCommandIntent = 'review' | 'task'

export interface BotCommand {
    isMentioned: boolean
    intent: BotCommandIntent
    instruction: string
}

export interface ReviewLineComment {
    path: string
    line: number
    body: string
}

export interface PullRequestReviewParams {
    token: string
    owner: string
    repo: string
    pullNumber: number
    body: string
    commitId?: string
    comments?: ReviewLineComment[]
}

export interface GetPullRequestParams {
    token: string
    owner: string
    repo: string
    pullNumber: number
}

// the parts of a pull request December needs to start a run on it
export interface PullRequestInfo {
    number: number
    title: string
    body: string
    draft: boolean
    authorLogin: string
    headRef: string
    headSha: string
    headRepoFullName: string
    baseRef: string
}

export interface InstallationTokenParams {
    appId: string
    privateKey: string
    installationId: string
}

const AUTHORIZED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

export function extractBotMention(commentBody: string): BotMentionResult {
    if (!commentBody) {
        return { isMentioned: false, instruction: '' }
    }

    // Only @trydecember: the @december handle belongs to an unrelated GitHub user
    const mentionRegex = /@trydecember(?:\[bot\])?(?=[\s:;,.]|$)/i
    if (!mentionRegex.test(commentBody)) {
        return { isMentioned: false, instruction: '' }
    }

    const stripped = commentBody.replace(/@trydecember(?:\[bot\])?(?=[\s:;,.]|$)/gi, '').trim()
    const instruction =
        stripped.length > 0
            ? stripped
            : 'Fix the issue described in the issue description and ensure tests pass.'

    return {
        isMentioned: true,
        instruction,
    }
}

// the first word after the mention decides the intent: "review" reviews, anything else is a task
export function parseBotCommand(commentBody: string): BotCommand {
    const { isMentioned, instruction } = extractBotMention(commentBody)
    if (!isMentioned) {
        return { isMentioned: false, intent: 'task', instruction: '' }
    }

    const stripped = (commentBody || '')
        .replace(/@trydecember(?:\[bot\])?(?=[\s:;,.]|$)/gi, '')
        .replace(/^[\s:;,.]+/, '')
        .trim()
    const isReview = /^review\b/i.test(stripped)
    if (isReview) {
        return {
            isMentioned: true,
            intent: 'review',
            instruction: stripped.replace(/^review\b[\s:;,.]*/i, '').trim(),
        }
    }

    return { isMentioned: true, intent: 'task', instruction }
}

export function isAuthorizedGithubSender(authorAssociation?: string | null): boolean {
    if (!authorAssociation) {
        return false
    }
    return AUTHORIZED_ASSOCIATIONS.has(authorAssociation.trim().toUpperCase())
}

export async function createCommentReaction(params: CommentReactionParams): Promise<any> {
    const { token, owner, repo, commentId, reaction = 'eyes' } = params

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/comments/${commentId}/reactions`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: reaction }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create comment reaction (${response.status}): ${errorText}`)
    }

    return response.json()
}

export async function createIssueReaction(params: IssueReactionParams): Promise<any> {
    const { token, owner, repo, issueNumber, reaction = 'eyes' } = params

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/reactions`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: reaction }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create issue reaction (${response.status}): ${errorText}`)
    }

    return response.json()
}

export async function createIssueComment(params: IssueCommentParams): Promise<any> {
    const { token, owner, repo, issueNumber, body } = params

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'User-Agent': 'December-App',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ body }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create issue comment (${response.status}): ${errorText}`)
    }

    return response.json()
}

export async function createPullRequest(params: PullRequestParams): Promise<any> {
    const { token, owner, repo, title, head, base, body, draft } = params

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'December-App',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, head, base, body, ...(draft ? { draft: true } : {}) }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create pull request (${response.status}): ${errorText}`)
    }

    return response.json()
}

const githubHeaders = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'December-App',
    'Content-Type': 'application/json',
})

export async function getPullRequest(params: GetPullRequestParams): Promise<PullRequestInfo> {
    const { token, owner, repo, pullNumber } = params

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
        {
            headers: githubHeaders(token),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to read pull request (${response.status}): ${errorText}`)
    }

    const pr = (await response.json()) as any
    return {
        number: pr.number,
        title: pr.title || '',
        body: pr.body || '',
        draft: Boolean(pr.draft),
        authorLogin: pr.user?.login || '',
        headRef: pr.head?.ref || '',
        headSha: pr.head?.sha || '',
        headRepoFullName: pr.head?.repo?.full_name || '',
        baseRef: pr.base?.ref || 'main',
    }
}

/**
 * Posts one review that only comments: it never approves and never requests changes, so it
 * cannot block a merge. GitHub refuses the whole review when one comment points at a line
 * outside the diff, so on a 422 the comments move into the review body and it is sent again.
 */
export async function createPullRequestReview(params: PullRequestReviewParams): Promise<any> {
    const { token, owner, repo, pullNumber, body, commitId, comments = [] } = params
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`

    const send = (payload: Record<string, unknown>) =>
        fetch(url, {
            method: 'POST',
            headers: githubHeaders(token),
            body: JSON.stringify({
                event: 'COMMENT',
                ...(commitId ? { commit_id: commitId } : {}),
                ...payload,
            }),
        })

    const lineComments = comments.map((c) => ({
        path: c.path,
        line: c.line,
        side: 'RIGHT',
        body: c.body,
    }))

    let response = await send({ body, comments: lineComments })
    if (response.status === 422 && lineComments.length > 0) {
        const inBody = comments.map((c) => `**${c.path}:${c.line}**\n${c.body}`).join('\n\n')
        response = await send({ body: `${body}\n\n${inBody}` })
    }

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create pull request review (${response.status}): ${errorText}`)
    }

    return response.json()
}

export interface FailedCheckRun {
    name: string
    conclusion: string
    summary: string
}

// the checks that failed on one commit, with a short summary of each (for the fix prompt)
export async function listFailedCheckRuns(params: {
    token: string
    owner: string
    repo: string
    sha: string
}): Promise<FailedCheckRun[]> {
    const { token, owner, repo, sha } = params

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=50`,
        { headers: githubHeaders(token) }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to list check runs (${response.status}): ${errorText}`)
    }

    const json = (await response.json()) as { check_runs?: any[] }
    return (json.check_runs || [])
        .filter((run) => ['failure', 'timed_out', 'cancelled'].includes(run?.conclusion))
        .map((run) => ({
            name: String(run.name || 'check'),
            conclusion: String(run.conclusion),
            summary: String(run.output?.title || run.output?.summary || '').slice(0, 500),
        }))
}

// a reaction on a comment on a line of a pull request (a different api from issue comments)
export async function createReviewCommentReaction(params: CommentReactionParams): Promise<any> {
    const { token, owner, repo, commentId, reaction = 'eyes' } = params

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/comments/${commentId}/reactions`,
        {
            method: 'POST',
            headers: githubHeaders(token),
            body: JSON.stringify({ content: reaction }),
        }
    )

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
            `Failed to create review comment reaction (${response.status}): ${errorText}`
        )
    }

    return response.json()
}
