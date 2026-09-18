export const TIPS: readonly string[] = [
    '/switch changes active LLM providers',
    '/plan generates a step-by-step implementation plan',
    '/grill-me interviews you to align on design decisions',
    '/tasks lists running background processes',
    '/context shows token breakdown and active file sizes',
    '/fork branches your conversation without losing history',
    '/copy copies the last assistant response to your clipboard',
    '/resume lets you browse and switch to past sessions',
    '/usage displays your token consumption and quota',
    'press Ctrl+O to expand or collapse thoughts and tool outputs',
    'press Tab to autocomplete slash commands and file paths',
    'press Ctrl+J or Shift+Enter to insert a newline',
    'press Ctrl+C once to cancel a running tool or command',
    'place persistent project rules in AGENTS.md at repo root',
    'install skills into .december/skills to add specialized tools',
] as const

export const TIP_COOLDOWN_MS = 3 * 60 * 1000 // 3 minutes
export const MAX_SESSION_TIPS = 4

interface TipSessionState {
    lastTipTimestamp: number
    tipsShownCount: number
    seenIndices: Set<number>
}

const state: TipSessionState = {
    lastTipTimestamp: 0,
    tipsShownCount: 0,
    seenIndices: new Set<number>(),
}

/**
 * Resets the in-memory tip session state.
 */
export function resetTipSession(): void {
    state.lastTipTimestamp = 0
    state.tipsShownCount = 0
    state.seenIndices.clear()
}

/**
 * Retrieves the next unseen tip if the cooldown and session cap conditions are met.
 *
 * @param now Optional timestamp for testing or deterministic time calculation.
 * @returns The tip string, or null if gated by cooldown, session cap, or empty pool.
 */
export function getNextTip(now = Date.now()): string | null {
    if (state.tipsShownCount >= MAX_SESSION_TIPS) {
        return null
    }

    if (state.lastTipTimestamp > 0 && now - state.lastTipTimestamp < TIP_COOLDOWN_MS) {
        return null
    }

    // Filter available unseen indices
    const unseenIndices: number[] = []
    for (let i = 0; i < TIPS.length; i++) {
        if (!state.seenIndices.has(i)) {
            unseenIndices.push(i)
        }
    }

    if (unseenIndices.length === 0) {
        // All tips have been seen in this session; reset seen set to allow round-robin
        state.seenIndices.clear()
        for (let i = 0; i < TIPS.length; i++) {
            unseenIndices.push(i)
        }
    }

    // Pick random index from unseen pool
    const randomPick = Math.floor(Math.random() * unseenIndices.length)
    const selectedIndex = unseenIndices[randomPick]

    state.seenIndices.add(selectedIndex)
    state.tipsShownCount++
    state.lastTipTimestamp = now

    return TIPS[selectedIndex]
}
