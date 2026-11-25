/**
 * Connections demo mode
 *
 * The Apps, Skills and MCPs tabs have a backend. The other tabs (plugins, hooks,
 * rules, memory) run on local demo data and stay hidden behind this flag: normal
 * users see a "coming soon" state on those tabs. With the flag on, Skills and MCPs
 * also read the local demo data, because the sample plugins add skills and servers.
 *
 * To turn it on: open any /connections page with ?demo, or set
 * localStorage.preview_connections = 'true'. To turn it off: ?demo=off.
 */
const STORAGE_KEY = 'preview_connections'

let demoOverride: boolean | null = null

export const setConnectionsDemo = (active: boolean | null) => {
    demoOverride = active
}

export const isConnectionsDemoActive = (): boolean => {
    if (demoOverride !== null) return demoOverride
    if (typeof window === 'undefined') return false
    try {
        const param = new URLSearchParams(window.location.search).get('demo')
        if (param === 'off') {
            window.localStorage.removeItem(STORAGE_KEY)
            return false
        }
        if (param !== null) {
            window.localStorage.setItem(STORAGE_KEY, 'true')
            return true
        }
        return window.localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
        // Intentionally swallowed: storage can be blocked, demo mode then stays off
        return false
    }
}
