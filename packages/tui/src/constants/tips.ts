// Tips rotate in the activity line's hint slot with no "tip:" label (L18-A), so each one
// reads like the other hints: a command or key first, then what it does.
export const TIPS: readonly string[] = [
    '/switch changes the active provider',
    '/plan writes a step-by-step plan first',
    '/tasks lists background work',
    '/context shows what fills the context',
    '/fork branches this chat',
    '/copy copies the last reply',
    '/resume opens a past session',
    '/usage shows token usage',
    '/memory shows your AGENTS.md',
    '/learn saves a lesson to AGENTS.md',
    'ctrl+t shows background tasks',
    'ctrl+b moves a running command to the background',
    'tab completes commands and paths',
    'shift+enter adds a new line',
    'ctrl+c cancels a running command',
    'shift+drag selects text to copy',
    'AGENTS.md at the repo root holds project rules',
    '/plugin installs plugins, skills and MCP servers',
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
