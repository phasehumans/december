/**
 * The settings preview flag. Settings sections that have no server yet stay behind it and
 * show a Demo pill (usePreviewOn in SettingsUi.tsx). Every Connections tab has a server now.
 *
 * To turn it on: open a settings page with ?demo, or set
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
