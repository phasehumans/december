/** "just now", "5m ago", "3h ago", "2d ago", then a short date. the same wording as the sidebar */
export const formatRelativeTime = (isoString?: string | null): string => {
    if (!isoString) return 'just now'
    const date = new Date(isoString)
    if (isNaN(date.getTime())) return 'just now'
    const mins = Math.floor(Math.max(0, Date.now() - date.getTime()) / (1000 * 60))
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
