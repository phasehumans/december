import { QueryClientContext } from '@tanstack/react-query'
import React from 'react'

import type { BackendSession } from '@/features/sessions/api/session'

import { toRepoList } from '@/features/profile/api/profile'
import { pullRequestUrlOf } from '@/features/pullrequests/lib/pullRequests'
import {
    openExternal,
    repoOfSession,
    startSessionInRepo,
} from '@/features/sessions/lib/sessionLinks'

/** the "open" rows of the session menu. a row with no handler does not show */
export interface SessionLinks {
    /** only when the session has a pull request */
    onOpenPullRequest?: () => void
    /** only when the session has a repository */
    onNewInRepo?: () => void
}

/**
 * gives the "open" rows of the session menu for one session. the query client is only
 * read for the user's repository list, so a row also renders where there is no client
 */
export const useSessionLinks = () => {
    const queryClient = React.useContext(QueryClientContext)
    return React.useCallback(
        (session: BackendSession): SessionLinks => {
            const prUrl = pullRequestUrlOf(session)
            const repo = repoOfSession(
                session,
                toRepoList(queryClient?.getQueryData(['github-repos'])).repos
            )
            return {
                onOpenPullRequest: prUrl ? () => openExternal(prUrl) : undefined,
                onNewInRepo: repo ? () => startSessionInRepo(repo, session.branch) : undefined,
            }
        },
        [queryClient]
    )
}
