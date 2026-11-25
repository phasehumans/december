import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { isPluginOff, useConnectionsStore } from '@/features/connections/hooks/useConnectionsStore'
import { isConnectionsDemoActive } from '@/features/connections/lib/connectionsDemo'
import { apiRequest } from '@/shared/api/client'

// the skills, plugins and MCP servers the prompt box lists (#632 section 2). with the
// preview off they come from GET /connections/prompt-box. with the preview on they are
// the sample values of useConnectionsStore.

/** the answer of GET /connections/prompt-box */
export interface PromptBoxConnectionsAnswer {
    /** enabled skills only */
    skills: Array<{ name: string; description: string; plugin: string | null }>
    /** always empty for now: installing plugins is not built */
    plugins: Array<{ name: string; enabled: boolean }>
    mcps: Array<{ name: string; enabled: boolean; status: string; lastError: string | null }>
}

/** what the prompt box shows: only the items that are turned on */
export interface PromptBoxConnections {
    skills: Array<{ name: string; description: string; plugin?: string }>
    plugins: Array<{ name: string }>
    /** status: `connected`, `error`, `unknown` (no session has used it yet) or `needs-signin` */
    mcps: Array<{ name: string; status: string; lastError?: string }>
    isLoading: boolean
}

/** the connections page clears this key after a change */
export const PROMPT_BOX_CONNECTIONS_KEY = ['connections', 'prompt-box'] as const

export const promptBoxConnectionsAPI = {
    get: () => apiRequest<PromptBoxConnectionsAnswer>('/connections/prompt-box'),
}

export const usePromptBoxConnections = (enabled = true): PromptBoxConnections => {
    const [demo] = React.useState(isConnectionsDemoActive)
    const demoSkills = useConnectionsStore((s) => s.skills)
    const demoPlugins = useConnectionsStore((s) => s.plugins)
    const demoMcps = useConnectionsStore((s) => s.mcps)

    const { data, isLoading } = useQuery({
        queryKey: PROMPT_BOX_CONNECTIONS_KEY,
        queryFn: promptBoxConnectionsAPI.get,
        enabled: enabled && !demo,
        staleTime: 30_000,
    })

    return React.useMemo<PromptBoxConnections>(() => {
        if (demo) {
            return {
                skills: demoSkills
                    .filter((skill) => skill.enabled && !isPluginOff(demoPlugins, skill.plugin))
                    .map(({ name, description, plugin }) => ({ name, description, plugin })),
                plugins: demoPlugins
                    .filter((plugin) => plugin.installed && plugin.enabled)
                    .map(({ name }) => ({ name })),
                mcps: demoMcps
                    .filter((mcp) => mcp.enabled)
                    .map(({ name, status, lastError }) => ({ name, status, lastError })),
                isLoading: false,
            }
        }
        return {
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
        }
    }, [demo, demoSkills, demoPlugins, demoMcps, data, enabled, isLoading])
}
