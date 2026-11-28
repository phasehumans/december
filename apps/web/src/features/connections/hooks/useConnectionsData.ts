import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import React from 'react'

import {
    connectionsAPI,
    type ApiMcpServer,
    type ApiSkill,
    type ImportRepo,
} from '../api/connections'

import { CONNECTIONS_RULES_KEY } from './useAccountContext'

import type { ConnectionsMcp, ConnectionsSkill } from '../types'

import { PROMPT_BOX_CONNECTIONS_KEY } from '@/features/home/api/promptBoxConnections'
import { CACHE_PRESETS } from '@/shared/lib/query-cache'

// the skills and mcp servers of the account (#632 section 2). they come from the api and
// every action calls it.

export const CONNECTIONS_SKILLS_KEY = ['connections', 'skills'] as const
export const CONNECTIONS_MCPS_KEY = ['connections', 'mcps'] as const

// the same words for a failed request as every other page
export { apiErrorMessage as connectionErrorMessage } from '@/shared/lib/apiErrorMessage'

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name)

/** puts a saved row in the list in place of the row named `currentName`, sorted like the api */
const withSaved = <T extends { name: string }>(list: T[], saved: T, currentName: string) =>
    [...list.filter((row) => row.name !== currentName && row.name !== saved.name), saved].sort(
        byName
    )

const withPatch = <T extends { name: string }>(list: T[], name: string, patch: Partial<T>) =>
    list.map((row) => (row.name === name ? { ...row, ...patch } : row))

/**
 * Puts a change in the cached list. A read of the list that is still on its way can be
 * older than the change, so it is dropped first. With no list yet, the list is read again.
 */
const commit = async <T>(
    queryClient: QueryClient,
    queryKey: readonly string[],
    change: (list: T[]) => T[]
) => {
    if (queryClient.getQueryData(queryKey) === undefined) {
        await queryClient.invalidateQueries({ queryKey })
        return
    }
    await queryClient.cancelQueries({ queryKey })
    queryClient.setQueryData<T[]>(queryKey, (list) => (list ? change(list) : list))
}

const toSkill = (skill: ApiSkill): ConnectionsSkill => ({
    name: skill.name,
    description: skill.description,
    runs: skill.runs,
    body: skill.body,
    enabled: skill.enabled,
})

const toMcp = (server: ApiMcpServer): ConnectionsMcp => ({
    name: server.name,
    url: server.url,
    transport: server.transport,
    auth: server.auth,
    // the api returns header names only. an empty value keeps the saved value
    headers: server.headerKeys.map((key) => ({ key, value: '' })),
    status: server.status,
    enabled: server.enabled,
    tools: server.tools.map((name) => ({ name, enabled: !server.disabledTools.includes(name) })),
    lastError: server.lastError ?? undefined,
})

export const useSkills = () => {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: CONNECTIONS_SKILLS_KEY,
        queryFn: connectionsAPI.listSkills,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })
    const apiSkills = React.useMemo(() => (query.data ?? []).map(toSkill), [query.data])

    /** the prompt box lists enabled skills, so it reads again after every change */
    const refreshPromptBox = React.useCallback(
        () => void queryClient.invalidateQueries({ queryKey: PROMPT_BOX_CONNECTIONS_KEY }),
        [queryClient]
    )

    /** creates or saves a skill. `previousName` is the saved name when the skill is renamed */
    const saveSkill = React.useCallback(
        async (skill: ConnectionsSkill, previousName?: string): Promise<ConnectionsSkill> => {
            const currentName = previousName ?? skill.name
            const saved = await connectionsAPI.saveSkill(currentName, {
                name: skill.name,
                description: skill.description,
                body: skill.body,
                runs: skill.runs,
                enabled: skill.enabled,
            })
            await commit<ApiSkill>(queryClient, CONNECTIONS_SKILLS_KEY, (list) =>
                withSaved(list, saved, currentName)
            )
            refreshPromptBox()
            return toSkill(saved)
        },
        [queryClient, refreshPromptBox]
    )

    /** the switch moves at once and moves back when the server refuses */
    const setSkillEnabled = React.useCallback(
        async (name: string, enabled: boolean) => {
            const change = (patch: Partial<ApiSkill>) =>
                commit<ApiSkill>(queryClient, CONNECTIONS_SKILLS_KEY, (list) =>
                    withPatch(list, name, patch)
                )
            await change({ enabled })
            try {
                await change(await connectionsAPI.setSkillEnabled(name, enabled))
            } catch (error) {
                await change({ enabled: !enabled })
                throw error
            } finally {
                refreshPromptBox()
            }
        },
        [queryClient, refreshPromptBox]
    )

    const deleteSkill = React.useCallback(
        async (name: string) => {
            await connectionsAPI.deleteSkill(name)
            await commit<ApiSkill>(queryClient, CONNECTIONS_SKILLS_KEY, (list) =>
                list.filter((row) => row.name !== name)
            )
            refreshPromptBox()
        },
        [queryClient, refreshPromptBox]
    )

    return {
        skills: apiSkills,
        isLoading: query.isPending,
        loadFailed: query.isError && !query.data,
        retry: query.refetch,
        saveSkill,
        setSkillEnabled,
        deleteSkill,
    }
}

export const useMcps = () => {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: CONNECTIONS_MCPS_KEY,
        queryFn: connectionsAPI.listMcpServers,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })
    const apiMcps = React.useMemo(() => (query.data ?? []).map(toMcp), [query.data])

    /** the prompt box lists the mcp servers, so it reads again after every change */
    const refreshPromptBox = React.useCallback(
        () => void queryClient.invalidateQueries({ queryKey: PROMPT_BOX_CONNECTIONS_KEY }),
        [queryClient]
    )

    const savedServer = React.useCallback(
        (name: string) =>
            queryClient
                .getQueryData<ApiMcpServer[]>(CONNECTIONS_MCPS_KEY)
                ?.find((row) => row.name === name),
        [queryClient]
    )

    /** sends a part of a server at once, and puts the old value back when the server refuses */
    const patchServer = React.useCallback(
        async (name: string, patch: { enabled?: boolean; disabledTools?: string[] }) => {
            const before = savedServer(name)
            const change = (next: Partial<ApiMcpServer>) =>
                commit<ApiMcpServer>(queryClient, CONNECTIONS_MCPS_KEY, (list) =>
                    withPatch(list, name, next)
                )
            await change(patch)
            try {
                await change(await connectionsAPI.updateMcpServer(name, patch))
            } catch (error) {
                if (before) {
                    await change({ enabled: before.enabled, disabledTools: before.disabledTools })
                }
                throw error
            } finally {
                refreshPromptBox()
            }
        },
        [queryClient, refreshPromptBox, savedServer]
    )

    /** creates or saves a server. `previousName` is the saved name when it is renamed */
    const saveMcp = React.useCallback(
        async (mcp: ConnectionsMcp, previousName?: string): Promise<ConnectionsMcp> => {
            const currentName = previousName ?? mcp.name
            const saved = await connectionsAPI.saveMcpServer(currentName, {
                name: mcp.name,
                url: mcp.url,
                transport: mcp.transport,
                auth: mcp.auth,
                headers: mcp.auth === 'header' ? mcp.headers : [],
                enabled: mcp.enabled,
                disabledTools: savedServer(currentName)?.disabledTools ?? [],
            })
            await commit<ApiMcpServer>(queryClient, CONNECTIONS_MCPS_KEY, (list) =>
                withSaved(list, saved, currentName)
            )
            refreshPromptBox()
            return toMcp(saved)
        },
        [queryClient, refreshPromptBox, savedServer]
    )

    const setMcpEnabled = React.useCallback(
        (name: string, enabled: boolean) => patchServer(name, { enabled }),
        [patchServer]
    )

    /** a tool that is off is a name in `disabledTools` of the server */
    const setMcpToolEnabled = React.useCallback(
        async (name: string, tool: string, enabled: boolean) => {
            const others = (savedServer(name)?.disabledTools ?? []).filter((t) => t !== tool)
            await patchServer(name, { disabledTools: enabled ? others : [...others, tool] })
        },
        [patchServer, savedServer]
    )

    const removeMcp = React.useCallback(
        async (name: string) => {
            await connectionsAPI.deleteMcpServer(name)
            await commit<ApiMcpServer>(queryClient, CONNECTIONS_MCPS_KEY, (list) =>
                list.filter((row) => row.name !== name)
            )
            refreshPromptBox()
        },
        [queryClient, refreshPromptBox]
    )

    return {
        mcps: apiMcps,
        isLoading: query.isPending,
        loadFailed: query.isError && !query.data,
        retry: query.refetch,
        saveMcp,
        setMcpEnabled,
        setMcpToolEnabled,
        removeMcp,
    }
}

/** what a repository has to import (#637 section 6). read again each time it is picked */
export const useImportPreview = (repo: ImportRepo | null) =>
    useQuery({
        queryKey: ['connections', 'import-preview', repo?.provider, repo?.repoFullName],
        queryFn: () => connectionsAPI.previewImport(repo as ImportRepo),
        enabled: repo !== null,
        staleTime: 0,
        gcTime: 0,
        retry: false,
        // a new answer would move the ticks the user has set
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
    })

/** imports the ticked names. the skills, the mcp servers and the prompt box read again */
export const useImportSetup = () => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: connectionsAPI.importSetup,
        onSuccess: () => {
            for (const queryKey of [
                CONNECTIONS_SKILLS_KEY,
                CONNECTIONS_MCPS_KEY,
                CONNECTIONS_RULES_KEY,
                PROMPT_BOX_CONNECTIONS_KEY,
            ]) {
                void queryClient.invalidateQueries({ queryKey })
            }
        },
    })
}
