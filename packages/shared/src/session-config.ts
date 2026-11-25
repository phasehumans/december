/**
 * How a cloud session runs (#632). `openPullRequest` is fixed when the session starts,
 * `planFirst` and `effort` can change with every message. The values are saved in
 * `SessionSettings.config` and the worker reads them for each turn.
 */
export type SessionEffort = 'fast' | 'deep'

export interface SessionRunConfig {
    /** the agent writes a plan and waits for approval before it changes files */
    planFirst: boolean
    /** the reasoning depth of the model; on december credits it also picks the model */
    effort: SessionEffort
    /** false: branch and commits only, no pull request */
    openPullRequest: boolean
}

export const DEFAULT_SESSION_RUN_CONFIG: SessionRunConfig = {
    planFirst: false,
    effort: 'deep',
    openPullRequest: true,
}

export const isSessionEffort = (value: unknown): value is SessionEffort =>
    value === 'fast' || value === 'deep'

/** the run config saved on a session; a missing or bad field takes the fallback value */
export const readSessionRunConfig = (
    value: unknown,
    fallback: SessionRunConfig = DEFAULT_SESSION_RUN_CONFIG
): SessionRunConfig => {
    const saved =
        value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {}
    return {
        planFirst: typeof saved.planFirst === 'boolean' ? saved.planFirst : fallback.planFirst,
        effort: isSessionEffort(saved.effort) ? saved.effort : fallback.effort,
        openPullRequest:
            typeof saved.openPullRequest === 'boolean'
                ? saved.openPullRequest
                : fallback.openPullRequest,
    }
}

/** the + menu switches of a session: plugins and mcp servers turned off for it only */
export interface SessionSwitches {
    disabledPlugins: string[]
    disabledMcps: string[]
}

const readNames = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : []

export const readSessionSwitches = (value: unknown): SessionSwitches => {
    const saved =
        value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {}
    return {
        disabledPlugins: readNames(saved.disabledPlugins),
        disabledMcps: readNames(saved.disabledMcps),
    }
}
