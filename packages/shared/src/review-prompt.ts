/**
 * /review <link> (#632): the link of a GitHub pull request or GitLab merge request, and
 * the first prompt of the session that reviews it. The server and the web build the
 * same prompt.
 */
export type ParsedPullRequestUrl = {
    gitProvider: 'GITHUB' | 'GITLAB'
    repoUrl: string
    repoPath: string
    number: number
}

/** a GitHub pull request or GitLab merge request link */
export const parsePullRequestUrl = (url: string): ParsedPullRequestUrl | null => {
    const github = url
        .trim()
        .match(/^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/i)
    if (github) {
        const repoPath = `${github[1]}/${github[2]}`
        return {
            gitProvider: 'GITHUB',
            repoUrl: `https://github.com/${repoPath}`,
            repoPath,
            number: Number(github[3]),
        }
    }
    const gitlab = url.trim().match(/^https?:\/\/gitlab\.com\/(.+?)\/-\/merge_requests\/(\d+)/i)
    if (gitlab) {
        return {
            gitProvider: 'GITLAB',
            repoUrl: `https://gitlab.com/${gitlab[1]}`,
            repoPath: gitlab[1] ?? '',
            number: Number(gitlab[2]),
        }
    }
    return null
}

/** the first prompt of a review session: check out the pull request, review, change nothing */
export const buildReviewPrompt = (data: ParsedPullRequestUrl): string => {
    const { gitProvider, repoPath, number } = data
    const fetchRef =
        gitProvider === 'GITLAB'
            ? `git fetch origin merge-requests/${number}/head:review-${number}`
            : `git fetch origin pull/${number}/head:review-${number}`
    const what = gitProvider === 'GITLAB' ? 'merge request' : 'pull request'
    return `Review ${what} #${number} of ${repoPath}.

1. Run \`${fetchRef} && git checkout review-${number}\`, then compare it with the base branch (\`git log\` and \`git diff\` against the merge base).
2. Read the changed code and the code around it. Run the tests or the type check if the project has them.
3. Do not change, commit or push any file.
4. Reply with a review: a one-line verdict, then the problems you found, most severe first, each with the file and line, what goes wrong and a suggested fix. Say plainly when you found nothing that needs a change.`
}
