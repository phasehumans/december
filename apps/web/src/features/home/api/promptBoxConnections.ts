import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { apiRequest } from '@/shared/api/client'

// the skills, plugins and MCP servers the prompt box lists (#632 section 2), from
// GET /connections/prompt-box. a skill of an installed plugin names its plugin.

/** the answer of GET /connections/prompt-box */
export interface PromptBoxConnectionsAnswer {
    /** enabled skills only */
    skills: Array<{ name: string; description: string; plugin: string | null }>
    /** the installed plugins; one that is off is listed with enabled false */
    plugins: Array<{ name: string; enabled: boolean }>
    mcps: Array<{ name: string; enabled: boolean; status: string; lastError: string | null }>
}

/** what the prompt box shows: only the items that are turned on */
export interface PromptBoxConnections {
    skills: Array<{ name: string; description: string; plugin?: string }>
    plugins: Array<{ name: string }>
    /** status: `connected`, `error` or `unknown` (no session has used it yet) */
    mcps: Array<{ name: string; status: string; lastError?: string }>
    isLoading: boolean
}

/** the connections page clears this key after a change */
export const PROMPT_BOX_CONNECTIONS_KEY = ['connections', 'prompt-box'] as const

export const promptBoxConnectionsAPI = {
    get: () => apiRequest<PromptBoxConnectionsAnswer>('/connections/prompt-box'),
}

export const usePromptBoxConnections = (enabled = true): PromptBoxConnections => {
    const { data, isLoading } = useQuery({
        queryKey: PROMPT_BOX_CONNECTIONS_KEY,
        queryFn: promptBoxConnectionsAPI.get,
        enabled,
        staleTime: 30_000,
    })

    return React.useMemo<PromptBoxConnections>(
        () => ({
            skills: (data?.skills ?? []).map(({ name, description, plugin }) => ({
                name,
                description,
                plugin: plugin ?? undefined,
            })),
            plugins: (data?.plugins ?? [])
                .filter((plugin) => plugin.enabled)
                .map(({ name }) => ({ name })),
            mcps: (data?.mcps ?? [])
                .filter((mcp) => mcp.enabled)
                .map(({ name, status, lastError }) => ({
                    name,
                    status,
                    lastError: lastError ?? undefined,
                })),
            isLoading: enabled && isLoading,
        }),
        [data, enabled, isLoading]
    )
}
