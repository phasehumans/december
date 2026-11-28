import { useQuery } from '@tanstack/react-query'

import { useGitlabConnection } from './useGitlabConnection'

import { profileAPI, toRepoList, type GithubRepo } from '@/features/profile/api/profile'
import { ApiError } from '@/shared/api/client'

/** a key that stays unique across hosts (a GitHub and a GitLab repo can share an id) */
export const repoKey = (repo: Pick<GithubRepo, 'id' | 'provider'>) =>
    `${repo.provider ?? 'GITHUB'}:${repo.id}`

/**
 * A full list can be 10 calls to GitHub, so the prompt box, settings and search share one
 * list for 5 minutes. The refresh button on the Repositories page fetches at once.
 */
export const REPO_LIST_STALE_MS = 5 * 60 * 1000

/** how one host's list ended: loaded, failed, or the host wants to be connected again */
export type RepoHostState = 'off' | 'loading' | 'ok' | 'error' | 'reconnect'

const hostState = (query: {
    isEnabled: boolean
    isLoading: boolean
    isError: boolean
    error: unknown
}): RepoHostState => {
    if (!query.isEnabled) return 'off'
    if (query.isLoading) return 'loading'
    if (query.isError) {
        // the server answers 409 when the host refused the saved token (B9)
        return query.error instanceof ApiError && query.error.status === 409 ? 'reconnect' : 'error'
    }
    return 'ok'
}

const updatedAtOf = (repo: GithubRepo) => {
    const time = Date.parse(repo.updatedAt)
    return Number.isFinite(time) ? time : 0
}

/**
 * The user's repositories on every connected git host, newest first (B11). Each host is only
 * asked when it is connected, and one host failing keeps the other host's repositories (B3).
 */
export const useConnectedRepos = (data: { enabled: boolean; isGithubConnected: boolean }) => {
    const { enabled, isGithubConnected } = data
    const gitlab = useGitlabConnection(enabled)
    const githubEnabled = enabled && isGithubConnected
    const gitlabEnabled = enabled && gitlab.isConnected

    const github = useQuery({
        queryKey: ['github-repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: githubEnabled,
        staleTime: REPO_LIST_STALE_MS,
        // a cache saved before the list had its own fields is a plain array
        select: toRepoList,
    })
    const gitlabRepos = useQuery({
        queryKey: ['gitlab-repos'],
        queryFn: profileAPI.getGitlabRepos,
        enabled: gitlabEnabled,
        staleTime: REPO_LIST_STALE_MS,
        select: toRepoList,
    })

    const githubState = hostState({ ...github, isEnabled: githubEnabled })
    const gitlabState = hostState({ ...gitlabRepos, isEnabled: gitlabEnabled })
    const repos = [...(github.data?.repos ?? []), ...(gitlabRepos.data?.repos ?? [])].sort(
        (a, b) => updatedAtOf(b) - updatedAtOf(a)
    )

    return {
        repos,
        isLoading: githubState === 'loading' || gitlabState === 'loading',
        isGitlabConnected: gitlab.isConnected,
        isGitlabReady: gitlab.isReady,
        githubState,
        gitlabState,
        /** GitHub accounts whose install could not be read (B12) */
        unavailableAccounts: github.data?.unavailable ?? [],
        /** a host has more than 1,000 repositories */
        isTruncated: Boolean(github.data?.truncated || gitlabRepos.data?.truncated),
        // refetch() ignores `enabled`, so only ask the hosts that are connected
        refetch: () =>
            Promise.all([
                githubEnabled ? github.refetch() : null,
                gitlabEnabled ? gitlabRepos.refetch() : null,
            ]),
        isRefetching: github.isRefetching || gitlabRepos.isRefetching,
        /** every connected host failed */
        isError:
            (githubState === 'error' || githubState === 'reconnect' || !githubEnabled) &&
            (gitlabState === 'error' || gitlabState === 'reconnect' || !gitlabEnabled) &&
            (githubEnabled || gitlabEnabled),
    }
}
