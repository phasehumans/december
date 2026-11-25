/**
 * Asks the session workspace to show one of its tabs, from outside the workspace
 * (a pull request row, the /diff, /tasks and /open commands). The workspace may not be
 * mounted yet, so the request waits here until the workspace reads it.
 */
type RequestedWorkspaceTab = 'changes' | 'pull_requests' | 'shell' | 'file'

const REQUEST_EVENT = 'december:workspace-tab'
// a request for a session that never loads must not land on the next session opened
const MAX_AGE_MS = 20_000

let pending: { tab: RequestedWorkspaceTab; path?: string; at: number } | null = null

export const requestWorkspaceTab = (tab: Exclude<RequestedWorkspaceTab, 'file'>) => {
    pending = { tab, at: Date.now() }
    window.dispatchEvent(new CustomEvent(REQUEST_EVENT))
}

/** shows a file of the session workspace in the file tab (the /open command) */
export const requestWorkspaceFile = (path: string) => {
    pending = { tab: 'file', path, at: Date.now() }
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

/** the file of a pending file tab request */
export const peekWorkspaceFilePath = (): string | null =>
    peekWorkspaceTabRequest() === 'file' ? (pending?.path ?? null) : null

export const clearWorkspaceTabRequest = () => {
    pending = null
}

export const onWorkspaceTabRequest = (handler: () => void) => {
    window.addEventListener(REQUEST_EVENT, handler)
    return () => window.removeEventListener(REQUEST_EVENT, handler)
}
