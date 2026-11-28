import { formatRelativeTime } from '@/shared/lib/relativeTime'

/** an app path (same tab) or a link to another site (new tab) */
export const isAppLink = (link: string) => link.startsWith('/')

/**
 * The Open button says where it goes (M3-b, I1). Same words on the phone sheet and the
 * desktop popover; unknown links fall back to "Open".
 */
export const openLabelForLink = (link: string) => {
    if (!isAppLink(link)) {
        if (/^https:\/\/github\.com\//.test(link)) return 'Open on GitHub'
        return 'Open'
    }
    if (link.startsWith('/pull-requests')) return 'View pull requests'
    if (link.startsWith('/settings/billing')) return 'Open billing'
    if (link.startsWith('/settings/usage')) return 'Open usage'
    if (link.startsWith('/settings/connections')) return 'Open connections'
    if (link.startsWith('/settings')) return 'Open settings'
    if (link.startsWith('/sessions/') || link.startsWith('/session/')) return 'Open session'
    if (link.startsWith('/sessions')) return 'View sessions'
    return 'Open'
}

/** I3: the short time beside a row's title: "now", "5m", "3h", "2d", then "Nov 24" */
export const shortTime = (iso?: string | null) => {
    const label = formatRelativeTime(iso)
    if (label === 'just now') return 'now'
    return label.replace(/ ago$/, '')
}
