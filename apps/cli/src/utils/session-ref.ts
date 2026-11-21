export interface SessionRefCandidate {
    id: string
    title?: string
    preview?: string
}

/**
 * finds the session that `ref` names, for `december resume <ref>`.
 * candidates must be sorted most recent first. the order of checks is:
 * exact id, exact title (case-insensitive), then a title or id that contains `ref`.
 * returns undefined when nothing matches.
 */
export function resolveSessionRef<T extends SessionRefCandidate>(
    ref: string,
    sessions: T[]
): T | undefined {
    const raw = ref.trim()
    if (!raw) return undefined
    const q = raw.toLowerCase()

    const byId = sessions.find((s) => s.id === raw)
    if (byId) return byId

    const byTitle = sessions.find((s) => (s.title || '').trim().toLowerCase() === q)
    if (byTitle) return byTitle

    return sessions.find(
        (s) => (s.title || '').toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    )
}
