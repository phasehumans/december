import { useCallback, useEffect, useRef } from 'react'

import type { MutableRefObject } from 'react'

import { profileAPI, type GithubRepo } from '@/features/profile/api/profile'
import { repoKey } from '@/features/profile/hooks/useConnectedRepos'

const LAST_USED = 'last-used'
const DEFAULT_BRANCH = 'default'

/** true when the account names a repository for new sessions ("Last used" names none) */
export const hasDefaultRepository = (defaultRepository?: string): defaultRepository is string =>
    Boolean(defaultRepository) && defaultRepository !== LAST_USED

/**
 * The repository and the base branch a new prompt box starts with (#637), from the defaults
 * saved on the account.
 *
 * - The default repository is put in the box one time, when the repository list is there.
 *   A repository that is in the box already (a prefill, a pick by hand) stays.
 * - The base branch starts on the default branch of the repository. The default base
 *   branch of the account replaces it only when the host says the repository has it.
 */
export const useRepoStartValues = (data: {
    /** false for the prompt box of a running session: it has no repository to pick */
    enabled: boolean
    defaultRepository?: string
    defaultBaseBranch?: string
    repos: GithubRepo[]
    selectedCount: number
    /** true when a repository came from somewhere else (a prefill): the default stays out */
    startedRef: MutableRefObject<boolean>
    setSelectedRepos: (repos: GithubRepo[]) => void
    setSelectedBranch: (update: string | ((current: string) => string)) => void
}) => {
    const {
        enabled,
        defaultRepository,
        defaultBaseBranch,
        repos,
        selectedCount,
        startedRef,
        setSelectedRepos,
        setSelectedBranch,
    } = data
    // the repository of the last branch check: an answer for an older one is dropped
    const checkedRepoRef = useRef<string | null>(null)

    const startBranchFor = useCallback(
        (repo: GithubRepo) => {
            const repoBranch = repo.defaultBranch || 'main'
            setSelectedBranch(repoBranch)
            checkedRepoRef.current = repoKey(repo)

            const wanted = defaultBaseBranch
            if (!wanted || wanted === DEFAULT_BRANCH || wanted === repoBranch) return
            profileAPI
                .checkRepoBranch({
                    repository: repo.fullName,
                    branch: wanted,
                    provider: repo.provider,
                })
                .then(({ exists }) => {
                    if (!exists || checkedRepoRef.current !== repoKey(repo)) return
                    // a branch the user typed in the meantime stays
                    setSelectedBranch((current) => (current === repoBranch ? wanted : current))
                })
                .catch(() => {
                    // Intentionally swallowed: the default branch of the repository stays
                })
        },
        [defaultBaseBranch, setSelectedBranch]
    )

    useEffect(() => {
        if (!enabled || startedRef.current || !hasDefaultRepository(defaultRepository)) return
        if (selectedCount > 0) {
            startedRef.current = true
            return
        }
        const name = defaultRepository.toLowerCase()
        const repo = repos.find((item) => item.fullName?.toLowerCase() === name)
        if (!repo) return
        startedRef.current = true
        setSelectedRepos([repo])
        startBranchFor(repo)
    }, [
        enabled,
        defaultRepository,
        repos,
        selectedCount,
        startedRef,
        setSelectedRepos,
        startBranchFor,
    ])

    return { startBranchFor }
}
