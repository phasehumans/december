export type MobileBadge = 'unread' | 'running' | null

interface MenuBadgeInput {
    /** the home top bar shows its own inbox bell, so unread goes there instead */
    hasInboxButton: boolean
    unread: boolean
    running: boolean
}

// badge on the closed menu button (R6): unread wins over running, except when the
// screen already shows the inbox bell, which then carries the unread dot itself
export const menuButtonBadge = (input: MenuBadgeInput): MobileBadge => {
    const { hasInboxButton, unread, running } = input
    if (unread && !hasInboxButton) return 'unread'
    if (running) return 'running'
    return null
}
