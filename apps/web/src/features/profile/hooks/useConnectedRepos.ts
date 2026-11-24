import { useQuery } from '@tanstack/react-query'

import { useGitlabConnection } from './useGitlabConnection'

import { profileAPI, type GithubRepo } from '@/features/profile/api/profile'

/** a key that stays unique across hosts (a GitHub and a GitLab repo can share an id) */
export const repoKey = (repo: Pick<GithubRepo, 'id' | 'provider'>) =>
    `${repo.provider ?? 'GITHUB'}:${repo.id}`

/**
 * The user's repositories on every connected git host: GitHub first, then GitLab.
 * Each host is only asked when it is connected.
 */
export const useConnectedRepos = (data: { enabled: boolean; isGithubConnected: boolean }) => {
    const { enabled, isGithubConnected } = data
    const gitlab = useGitlabConnection(enabled)

    const github = useQuery({
        queryKey: ['github-repos'],
        queryFn: profileAPI.getGithubRepos,
        enabled: enabled && isGithubConnected,
    })
    const gitlabRepos = useQuery({
        queryKey: ['gitlab-repos'],
        queryFn: profileAPI.getGitlabRepos,
        enabled: enabled && gitlab.isConnected,
    })

    return {
        repos: [...(github.data ?? []), ...(gitlabRepos.data ?? [])],
        isLoading: github.isLoading || gitlabRepos.isLoading,
        isGitlabConnected: gitlab.isConnected,
        isGitlabReady: gitlab.isReady,
        // refetch() ignores `enabled`, so only ask the hosts that are connected
        refetch: () =>
            Promise.all([
                enabled && isGithubConnected ? github.refetch() : null,
                enabled && gitlab.isConnected ? gitlabRepos.refetch() : null,
            ]),
        isRefetching: github.isRefetching || gitlabRepos.isRefetching,
        isError: github.isError || gitlabRepos.isError,
    }
}
