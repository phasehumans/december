import {
    joinRepoFullName,
    SPEND_LIMIT_CONTINUE,
    SPEND_LIMIT_STOP,
    spendLimitQuestion,
} from '@december/shared'
import { detectGitProvider, getGitProvider } from '@december/shared/git'

import { smartSearchFiltersSchema } from './session.schema'

import type {
    BuildSmartSearchPrompt,
    DecidePromptRoute,
    HeldRunParts,
    LimitQuestionPrompt,
    MergeHeldRun,
    MessageWhileWorking,
    PromptRoute,
    PullRequestCursor,
    PullRequestSortBy,
    RepoFilter,
    SavedPullRequestRow,
    SessionPullRequest,
    SessionFacetRepoRow,
    SessionFacetRows,
    SessionFacets,
    SmartSearchFilters,
    StoredSessionFile,
    ToLimitQuestionPrompt,
} from './session.types'
import type { SessionEffort } from '@december/shared'

/**
 * What a new prompt does (#637). With no active run it starts one. During a run it reaches
 * the running agent ("send now"), or it waits in the web until the run ends ("queue"): two
 * runs never work on one session.
 */
export const decidePromptRoute = (data: DecidePromptRoute): PromptRoute => {
    const { runActive, mode } = data
    if (!runActive) return 'run'
    return mode === 'send' ? 'steer' : 'queued'
}

/**
 * True when an answer with this question id is an answer to the spend limit question
 * (`spend-limit:<kind>`). An answer with no id comes from a client from before question
 * ids. An answer to another card (an older agent question) is not.
 */
export const isLimitQuestionId = (questionId: string | undefined): boolean =>
    questionId === undefined || questionId.startsWith('spend-limit:')

/** the files and skills of a run that was held at a spend limit, or null when it had none */
export const toHeldRunParts = (heldRun: unknown): HeldRunParts | null => {
    if (!heldRun || typeof heldRun !== 'object') return null
    const { attachments, skills } = heldRun as { attachments?: unknown; skills?: unknown }
    const parts = {
        attachments: Array.isArray(attachments) ? attachments : [],
        skills: Array.isArray(skills)
            ? skills.filter((name): name is string => typeof name === 'string')
            : [],
    }
    return parts.attachments.length > 0 || parts.skills.length > 0 ? parts : null
}

/**
 * The files and skills of the run of a new prompt that replaces a held prompt: the held
 * ones first, each skill once. The text of the held prompt is saved in the conversation.
 */
export const mergeHeldRun = (data: MergeHeldRun): HeldRunParts => {
    const { heldRun, attachments, skills } = data
    if (!heldRun) return { attachments, skills }
    return {
        attachments: [...heldRun.attachments, ...attachments],
        skills: [...new Set([...heldRun.skills, ...skills])],
    }
}

/** the saved preference, or "queue" when the account has none */
export const readMessageWhileWorking = (preferences: unknown): MessageWhileWorking =>
    (preferences as { messageWhileWorking?: unknown } | null)?.messageWhileWorking === 'send'
        ? 'send'
        : 'queue'

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
 * how long the pull requests list waits for the host, and how long one refresh of a user
 * holds the place of the next one. an object, so tests can make them short
 */
export const PULL_REQUEST_REFRESH_TIMING = {
    /** the list answers after this, the refresh ends in the background */
    waitMs: 2000,
    /** a refresh that hangs this long no longer stops a new one */
    lockMs: 30_000,
}

/** the column that orders rows with the same, or no, value of the sort column */
export const PULL_REQUEST_SORT_FALLBACK: Record<PullRequestSortBy, PullRequestSortBy | null> = {
    prOpenedAt: 'createdAt',
    prUpdatedAt: 'updatedAt',
    updatedAt: null,
    createdAt: null,
}

/** the cursor as text for the url */
export const encodePullRequestCursor = (cursor: PullRequestCursor): string =>
    Buffer.from(JSON.stringify(cursor)).toString('base64url')

const isIsoDate = (value: unknown): value is string =>
    typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** the cursor from the url, or null when it is not one this server made */
export const decodePullRequestCursor = (text: string): PullRequestCursor | null => {
    let parsed: any
    try {
        parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'))
    } catch {
        // Intentionally swallowed: not a cursor, the caller answers 400
        return null
    }
    if (!parsed || typeof parsed !== 'object') return null
    const { sortBy, sortOrder, value, fallback, id } = parsed
    // own keys only: "__proto__" or "toString" are not sorts
    if (typeof sortBy !== 'string' || !Object.hasOwn(PULL_REQUEST_SORT_FALLBACK, sortBy)) {
        return null
    }
    if (sortOrder !== 'asc' && sortOrder !== 'desc') return null
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null
    const hasFallback = PULL_REQUEST_SORT_FALLBACK[sortBy as PullRequestSortBy] !== null
    // a sort with no fallback is on a column that is never empty
    if (hasFallback ? value !== null && !isIsoDate(value) : !isIsoDate(value)) return null
    if (hasFallback ? !isIsoDate(fallback) : fallback !== null) return null
    return { sortBy: sortBy as PullRequestSortBy, sortOrder, value, fallback, id }
}

/** the largest value of an Int column (prNumber): a longer number cannot match a row */
export const MAX_DB_INT = 2_147_483_647

/** a pull request number typed in the search ("42" or "#42"), or null */
export const searchedPullRequestNumber = (needle: string): number | null => {
    if (!/^\d+$/.test(needle)) return null
    const value = Number(needle)
    return value >= 1 && value <= MAX_DB_INT ? value : null
}

/**
 * the link when it is a web link, else null. only http and https reach an href, so a
 * saved `javascript:` or `data:` link never runs in the page
 */
export const webLinkOrNull = (url: string | null | undefined): string | null => {
    if (!url) return null
    const trimmed = url.trim()
    try {
        const parsed = new URL(trimmed)
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null
    } catch {
        // Intentionally swallowed: not a valid link, so no link is shown
        return null
    }
}

/** the agent of the session starts or works: "Running" in the list and the counts */
export const isWorkingVmStatus = (vmStatus: unknown): boolean =>
    vmStatus === 'PROVISIONING' || vmStatus === 'RUNNING'

const LIST_TITLE_CHARS = 50

/**
 * The title of a row in the sessions list: the saved title, else the start of the first
 * prompt of the user, else "New Chat". The newest message is often the agent's answer, so
 * it does not name the session.
 */
export const toListTitle = (title: string | null | undefined, firstPrompt?: string | null) => {
    const saved = title?.trim()
    if (saved) return saved
    const prompt = firstPrompt?.trim().replace(/\s+/g, ' ')
    if (!prompt) return 'New Chat'
    return prompt.length > LIST_TITLE_CHARS ? `${prompt.slice(0, LIST_TITLE_CHARS)}...` : prompt
}

/**
 * The tags of a list request as one part of its cache key (#641): sorted, so the order in
 * the request does not matter, and encoded, so a tag cannot look like another key part.
 */
export const toTagsCacheKey = (tags: string[] | undefined): string =>
    tags && tags.length > 0
        ? `tags=${[...new Set(tags)].sort().map(encodeURIComponent).join(',')}`
        : 'any-tag'

/**
 * The repository filter of the sessions list (#641): `owner/name`, or a name alone. The
 * name is the part after the last slash, because a GitLab owner can be a group path.
 */
export const splitRepoFilter = (repo: string): RepoFilter => {
    const parts = repo.split('/').filter(Boolean)
    const name = parts.pop() ?? ''
    return { owner: parts.length > 0 ? parts.join('/') : null, name }
}

/** a to z without case; the same letters in another case keep a fixed order */
const byName = (a: string, b: string): number => {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()]
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : a > b ? 1 : 0
}

/** `owner/name`, the name alone when the owner is not known, or the path of an old link */
const toFacetRepo = (row: SessionFacetRepoRow): string | null => {
    if (row.githubRepoName) {
        return joinRepoFullName(row.githubRepoOwner, row.githubRepoName) ?? row.githubRepoName
    }
    if (!row.repoUrl) return null
    const gitProvider = detectGitProvider(row.repoUrl)
    return gitProvider
        ? (getGitProvider(gitProvider).parseRepoUrl(row.repoUrl)?.path ?? null)
        : null
}

/**
 * The repositories and tags of a user's sessions for the sort and filter menu (#641),
 * both sorted by name. The list filter matches a repository without case, so one that
 * was saved in two spellings is listed once, as the spelling on the most sessions.
 */
export const toSessionFacets = (rows: SessionFacetRows): SessionFacets => {
    const repos = new Map<string, string>()
    const bySessions = [...rows.repos].sort((a, b) => b.sessions - a.sessions)
    for (const row of bySessions) {
        const repo = toFacetRepo(row)
        if (repo && !repos.has(repo.toLowerCase())) repos.set(repo.toLowerCase(), repo)
    }
    const tags = new Set(rows.tags.filter((tag) => tag.trim().length > 0))

    return { repos: [...repos.values()].sort(byName), tags: [...tags].sort(byName) }
}

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

/** the spend limit question (#638), in the shape of the agent's question */
export const toLimitQuestionPrompt = (data: ToLimitQuestionPrompt): LimitQuestionPrompt => {
    const { sessionId, kind, limitCents } = data
    return {
        type: 'AskQuestionPrompt',
        source: 'spend-limit',
        kind,
        sessionId,
        questionId: `spend-limit:${kind}`,
        questions: [
            {
                question: spendLimitQuestion({ kind, limitCents }),
                options: [SPEND_LIMIT_CONTINUE, SPEND_LIMIT_STOP],
            },
        ],
    }
}

/** the pull request the worker saved on the session row, or null when it opened none */
export const toSavedPullRequest = (session: SavedPullRequestRow): SessionPullRequest | null => {
    if (!session.prNumber) return null
    const url = webLinkOrNull(session.prUrl)
    // GitLab does not count lines: a saved count there is not real
    const hasLineCounts =
        session.gitProvider === 'GITHUB' &&
        session.prAdditions !== null &&
        session.prDeletions !== null
    return {
        prNumber: session.prNumber,
        gitProvider: session.gitProvider,
        ...(url ? { url } : {}),
        title: session.prTitle || session.title || `Pull request #${session.prNumber}`,
        state: toPullRequestState(session.prState),
        // only the branch of the pull request: session.branch is the base branch
        headRef: session.prBranch || '',
        ...(hasLineCounts
            ? {
                  diffSummary: {
                      additions: session.prAdditions as number,
                      deletions: session.prDeletions as number,
                  },
              }
            : {}),
        ...(session.prOpenedAt ? { createdAt: session.prOpenedAt.toISOString() } : {}),
        ...(session.prUpdatedAt ? { updatedAt: session.prUpdatedAt.toISOString() } : {}),
    }
}

/**
 * the cached pull request with a web link only, and no line counts from GitLab (the
 * worker cached 0 there, which is not a real count). the checks are left out: the cache
 * keeps the checks of the run's end, so "Checks running" would show for ever
 */
export const cleanCachedPullRequest = (
    pullRequest: SessionPullRequest,
    gitProvider: 'GITHUB' | 'GITLAB'
): SessionPullRequest => {
    const { url, diffSummary, ciStatus, ...rest } = pullRequest
    const link = webLinkOrNull(url)
    const changedFiles = diffSummary?.changedFiles
    const lineCounts =
        gitProvider === 'GITHUB' &&
        typeof diffSummary?.additions === 'number' &&
        typeof diffSummary?.deletions === 'number'
            ? { additions: diffSummary.additions, deletions: diffSummary.deletions }
            : {}
    const summary = { ...lineCounts, ...(changedFiles !== undefined ? { changedFiles } : {}) }
    return {
        ...rest,
        gitProvider,
        ...(link ? { url: link } : {}),
        ...(Object.keys(summary).length > 0 ? { diffSummary: summary } : {}),
    }
}

/** the cached pull request, with what the session row keeps current put over it */
export const withSavedPullRequest = (
    cached: SessionPullRequest,
    saved: SessionPullRequest,
    savedPrTitle: string | null
): SessionPullRequest => {
    const clean = cleanCachedPullRequest(cached, saved.gitProvider ?? 'GITHUB')
    const changedFiles = clean.diffSummary?.changedFiles
    const diffSummary = saved.diffSummary
        ? { ...saved.diffSummary, ...(changedFiles !== undefined ? { changedFiles } : {}) }
        : clean.diffSummary
    return {
        ...clean,
        state: saved.state,
        // an edit on the host changes the saved title; a row with none keeps the cached one
        ...(savedPrTitle ? { title: savedPrTitle } : {}),
        ...(saved.url ? { url: saved.url } : {}),
        ...(diffSummary ? { diffSummary } : {}),
        ...(saved.updatedAt ? { updatedAt: saved.updatedAt } : {}),
    }
}

/**
 * the pull request of one session: the cached one of the run's end (it has the base
 * branch) with what the row keeps current put over it, else the saved one. a cached result
 * with no number (a run that pushed only a branch, or whose pull request was not opened)
 * is no pull request, so it never shows as one
 */
export const pickSessionPullRequest = (data: {
    cached: SessionPullRequest | null
    saved: SessionPullRequest | null
    savedPrTitle: string | null
    gitProvider: 'GITHUB' | 'GITLAB'
}): SessionPullRequest | null => {
    const { cached, saved, savedPrTitle, gitProvider } = data
    if (cached?.prNumber && saved && cached.prNumber === saved.prNumber) {
        return withSavedPullRequest(cached, saved, savedPrTitle)
    }
    if (saved) return saved
    return cached?.prNumber ? cleanCachedPullRequest(cached, gitProvider) : null
}
