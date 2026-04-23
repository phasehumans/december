type ParsedGitHubRepo =
    | {
          ok: true
          owner: string
          repo: string
          normalizedUrl: string
      }
    | {
          ok: false
          error: string
          code: 'EMPTY_INPUT' | 'INVALID_URL' | 'NOT_GITHUB' | 'NOT_REPO_URL'
      }

export type VerifiedGitHubRepoAccess =
    | {
          ok: true
          owner: string
          repo: string
          normalizedUrl: string
          cloneUrl: string
          defaultBranch: string | null
          archived: boolean
          disabled: boolean
          visibility: 'public' | 'private'
          canAccess: true
      }
    | {
          ok: false
          error: string
          code: 'NOT_FOUND_OR_NO_ACCESS' | 'RATE_LIMITED' | 'GITHUB_API_ERROR' | 'NETWORK_ERROR'
      }

type GitHubRepoApiResponse = {
    name?: string
    html_url?: string
    clone_url?: string
    default_branch?: string
    private?: boolean
    archived?: boolean
    disabled?: boolean
    owner?: {
        login?: string
    }
}

export function parseGitHubRepoUrl(repoUrl: string): ParsedGitHubRepo {
    const raw = repoUrl.trim()

    if (!raw) {
        return {
            ok: false,
            error: 'Repository URL is required',
            code: 'EMPTY_INPUT',
        }
    }

    const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
    if (sshMatch) {
        const owner = sshMatch[1] as string
        const repo = sshMatch[2] as string

        return {
            ok: true,
            owner,
            repo,
            normalizedUrl: `https://github.com/${owner}/${repo}`,
        }
    }

    let candidate = raw

    if (/^www\.github\.com\//i.test(candidate)) {
        candidate = `https://${candidate}`
    } else if (/^github\.com\//i.test(candidate)) {
        candidate = `https://${candidate}`
    }

    let url: URL

    try {
        url = new URL(candidate)
    } catch {
        return {
            ok: false,
            error: 'Invalid URL format',
            code: 'INVALID_URL',
        }
    }

    const host = url.hostname.toLowerCase()

    if (host !== 'github.com' && host !== 'www.github.com') {
        return {
            ok: false,
            error: 'URL must be a github.com repository URL',
            code: 'NOT_GITHUB',
        }
    }

    const parts = url.pathname
        .replace(/^\/+|\/+$/g, '') // trim leading/trailing slashes
        .split('/')
        .filter(Boolean)

    if (parts.length < 2) {
        return {
            ok: false,
            error: 'URL is not a repository URL',
            code: 'NOT_REPO_URL',
        }
    }

    const [owner, repoRaw] = parts

    const repo = repoRaw!.replace(/\.git$/i, '')

    if (!owner || !repo) {
        return {
            ok: false,
            error: 'URL is not a repository URL',
            code: 'NOT_REPO_URL',
        }
    }

    return {
        ok: true,
        owner,
        repo,
        normalizedUrl: `https://github.com/${owner}/${repo}`,
    }
}

export async function verifyGitHubRepoAccess(
    owner: string,
    repo: string,
    accessToken?: string
): Promise<VerifiedGitHubRepoAccess> {
    const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'phasehumans',
    }

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
    }

    let response: Response

    try {
        response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            method: 'GET',
            headers,
        })
    } catch {
        return {
            ok: false,
            error: 'Network error while contacting GitHub',
            code: 'NETWORK_ERROR',
        }
    }

    if (response.status === 404) {
        return {
            ok: false,
            error: 'Repository not found or you do not have access',
            code: 'NOT_FOUND_OR_NO_ACCESS',
        }
    }

    if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining')

        if (remaining === '0') {
            return {
                ok: false,
                error: 'GitHub API rate limit exceeded',
                code: 'RATE_LIMITED',
            }
        }
    }

    if (!response.ok) {
        return {
            ok: false,
            error: `GitHub API error: ${response.status}`,
            code: 'GITHUB_API_ERROR',
        }
    }

    const data = (await response.json()) as GitHubRepoApiResponse

    const resolvedOwner = data.owner?.login ?? owner
    const resolvedRepo = data.name ?? repo
    const isPrivate = Boolean(data.private)

    return {
        ok: true,
        owner: resolvedOwner,
        repo: resolvedRepo,
        normalizedUrl: data.html_url ?? `https://github.com/${resolvedOwner}/${resolvedRepo}`,
        cloneUrl: data.clone_url ?? `https://github.com/${resolvedOwner}/${resolvedRepo}.git`,
        defaultBranch: data.default_branch ?? null,
        archived: Boolean(data.archived),
        disabled: Boolean(data.disabled),
        visibility: isPrivate ? 'private' : 'public',
        canAccess: true,
    }
}
