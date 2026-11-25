import { smartSearchFiltersSchema } from './session.schema'

import type { BuildSmartSearchPrompt, SmartSearchFilters, StoredSessionFile } from './session.types'
import type { SessionEffort } from '@december/shared'

export const parseStoredSessionFiles = (value: unknown): StoredSessionFile[] => {
    if (!Array.isArray(value)) {
        return []
    }

    return value.reduce<StoredSessionFile[]>((files, item) => {
        if (!item || typeof item !== 'object') {
            return files
        }

        const candidate = item as Partial<StoredSessionFile>

        if (typeof candidate.path !== 'string' || typeof candidate.key !== 'string') {
            return files
        }

        files.push({
            path: candidate.path,
            key: candidate.key,
            ...(typeof candidate.contentType === 'string'
                ? { contentType: candidate.contentType }
                : {}),
            size: typeof candidate.size === 'number' ? candidate.size : 0,
        })

        return files
    }, [])
}

/** system prompt that turns a typed description into session filters */
export const buildSmartSearchPrompt = (data: BuildSmartSearchPrompt): string => {
    const { today, repoNames } = data
    const date = today.toISOString().slice(0, 10)
    const weekday = today.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const repos = repoNames.length > 0 ? repoNames.join(', ') : 'none'

    return [
        'You turn a search for coding sessions into JSON filters.',
        `Today is ${date} (${weekday}). The user's repositories: ${repos}.`,
        'Reply with one JSON object and nothing else, in this shape:',
        '{"topic": string[], "updatedWithinDays": number | null, "repo": string | null, "running": boolean, "archived": boolean, "sort": "newest" | "oldest"}',
        'Rules:',
        '- topic: up to 5 lowercase words that would appear in a session title. Leave out filler words such as "sessions", "about", "from", "the", and words about time, status or repository.',
        '- updatedWithinDays: today is 1, yesterday is 2, this week or last week is 7, this month or last month is 31. Use null when no time is given.',
        '- repo: a name from the repository list only, else null.',
        '- running: true only when the user asks for sessions that run now.',
        '- archived: true only when the user asks for archived sessions.',
        '- sort: "oldest" only when the user asks for the oldest or first sessions.',
    ].join('\n')
}

/** reads the model reply; returns null when it is not valid filter JSON */
export const parseSmartSearchFilters = (
    text: string,
    repoNames: string[]
): SmartSearchFilters | null => {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start < 0 || end <= start) return null

    let raw: unknown
    try {
        raw = JSON.parse(text.slice(start, end + 1))
    } catch {
        // a reply that is not JSON means plain search only
        return null
    }

    const parsed = smartSearchFiltersSchema.safeParse(raw)
    if (!parsed.success) return null

    const filters = parsed.data
    // a repo name the user does not have would hide every session
    const repo = filters.repo
        ? (repoNames.find((name) => name.toLowerCase() === filters.repo!.toLowerCase()) ?? null)
        : null

    return { ...filters, repo }
}

export const isEmptySmartSearchFilters = (filters: SmartSearchFilters): boolean =>
    filters.topic.length === 0 &&
    filters.updatedWithinDays === null &&
    filters.repo === null &&
    !filters.running &&
    !filters.archived

const PULL_REQUEST_STATES = ['open', 'draft', 'merged', 'closed'] as const
export type PullRequestState = (typeof PULL_REQUEST_STATES)[number]

/** the saved GitHub state, or open when it was never set or is unknown */
export const toPullRequestState = (value: unknown): PullRequestState =>
    PULL_REQUEST_STATES.includes(value as PullRequestState) ? (value as PullRequestState) : 'open'

/**
 * The models behind fast and deep on december credits. Change them here: the web sends
 * only the tier, so no web release is needed.
 */
export const CREDIT_TIER_MODELS: Record<SessionEffort, { model: string; provider: string }> = {
    fast: { model: 'gemini-2.5-flash', provider: 'gemini' },
    deep: { model: 'gemini-2.5-pro', provider: 'gemini' },
}

/** the credit tier of a model the web picked before it sent tiers: the fast model, or deep */
export const toCreditTier = (model: string | undefined): SessionEffort =>
    model === CREDIT_TIER_MODELS.fast.model ? 'fast' : 'deep'
