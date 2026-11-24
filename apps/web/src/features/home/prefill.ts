import type { GithubRepo } from '@/features/profile/api/profile'

/**
 * Hands a prompt (and optionally a repo) to the Home prompt input from
 * elsewhere in the app, such as the search modal. Home may not be mounted
 * yet when this runs, so the value waits here until Home reads it.
 */
type HomePrefill = {
    prompt?: string
    repo?: GithubRepo
    /** the branch to start from. without it the default branch of the repo is set */
    branch?: string
}

const PREFILL_EVENT = 'december:home-prefill'

let pending: HomePrefill | null = null

export const requestHomePrefill = (prefill: HomePrefill) => {
    pending = prefill
    window.dispatchEvent(new CustomEvent(PREFILL_EVENT))
}

export const takeHomePrefill = (): HomePrefill | null => {
    const value = pending
    pending = null
    return value
}

export const onHomePrefill = (handler: () => void) => {
    window.addEventListener(PREFILL_EVENT, handler)
    return () => window.removeEventListener(PREFILL_EVENT, handler)
}
