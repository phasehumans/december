/**
 * Asks the session workspace to show one of its tabs, from outside the workspace
 * (a pull request row, the /diff and /tasks commands). The workspace may not be mounted yet,
 * so the request waits here until the workspace reads it.
 */
export type RequestedWorkspaceTab = 'changes' | 'pull_requests' | 'shell'

const REQUEST_EVENT = 'december:workspace-tab'
// a request for a session that never loads must not land on the next session opened
const MAX_AGE_MS = 20_000

let pending: { tab: RequestedWorkspaceTab; at: number } | null = null

export const requestWorkspaceTab = (tab: RequestedWorkspaceTab) => {
    pending = { tab, at: Date.now() }
    window.dispatchEvent(new CustomEvent(REQUEST_EVENT))
}

export const peekWorkspaceTabRequest = (): RequestedWorkspaceTab | null => {
    if (!pending) return null
    if (Date.now() - pending.at > MAX_AGE_MS) {
        pending = null
        return null
    }
    return pending.tab
}

export const clearWorkspaceTabRequest = () => {
    pending = null
}

export const onWorkspaceTabRequest = (handler: () => void) => {
    window.addEventListener(REQUEST_EVENT, handler)
    return () => window.removeEventListener(REQUEST_EVENT, handler)
}
