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
}

const AUTHORIZED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR'])

export function extractBotMention(commentBody: string): BotMentionResult {
    if (!commentBody) {
        return { isMentioned: false, instruction: '' }
    }

    const mentionRegex = /@(trydecember|december)(?:\[bot\])?(?=[\s:;,.]|$)/i
    if (!mentionRegex.test(commentBody)) {
        return { isMentioned: false, instruction: '' }
    }

    const stripped = commentBody
        .replace(/@(trydecember|december)(?:\[bot\])?(?=[\s:;,.]|$)/gi, '')
        .trim()
    const instruction =
        stripped.length > 0
            ? stripped
            : 'Fix the issue described in the issue description and ensure tests pass.'

    return {
        isMentioned: true,
        instruction,
    }
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
    const { token, owner, repo, title, head, base, body } = params

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'December-App',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, head, base, body }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to create pull request (${response.status}): ${errorText}`)
    }

    return response.json()
}
