import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { memoryAPI, type ApiMemory, type MemoryList } from '../api/memory'
import { rulesAPI, type ApiRule, type SaveRuleInput } from '../api/rules'

import { CACHE_PRESETS } from '@/shared/lib/query-cache'

// the account rules and the agent memory (connections, rules and memory tabs). every change
// goes to the api, and the cached list takes the answer

export const CONNECTIONS_RULES_KEY = ['connections', 'rules'] as const
export const CONNECTIONS_MEMORY_KEY = ['connections', 'memory'] as const

const byName = (a: ApiRule, b: ApiRule) => a.name.localeCompare(b.name)

export const useRules = () => {
    const queryClient = useQueryClient()
    const query = useQuery({
        queryKey: CONNECTIONS_RULES_KEY,
        queryFn: rulesAPI.listRules,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })

    /** puts a change in the cached list; a read still on its way is dropped first */
    const change = React.useCallback(
        async (update: (list: ApiRule[]) => ApiRule[]) => {
            if (queryClient.getQueryData(CONNECTIONS_RULES_KEY) === undefined) {
                await queryClient.invalidateQueries({ queryKey: CONNECTIONS_RULES_KEY })
                return
            }
            await queryClient.cancelQueries({ queryKey: CONNECTIONS_RULES_KEY })
            queryClient.setQueryData<ApiRule[]>(CONNECTIONS_RULES_KEY, (list) =>
                list ? update(list) : list
            )
        },
        [queryClient]
    )

    /** creates or saves a rule. `previousName` is the saved name when it is renamed */
    const saveRule = React.useCallback(
        async (rule: SaveRuleInput, previousName?: string) => {
            const currentName = previousName ?? rule.name
            const saved = await rulesAPI.saveRule(currentName, rule)
            await change((list) =>
                [
                    ...list.filter((row) => row.name !== currentName && row.name !== saved.name),
                    saved,
                ].sort(byName)
            )
            return saved
        },
        [change]
    )

    /** the switch moves at once and moves back when the server refuses */
    const setRuleEnabled = React.useCallback(
        async (name: string, enabled: boolean) => {
            const patch = (value: boolean) =>
                change((list) =>
                    list.map((row) => (row.name === name ? { ...row, enabled: value } : row))
                )
            await patch(enabled)
            try {
                const saved = await rulesAPI.setRuleEnabled(name, enabled)
                await change((list) => list.map((row) => (row.name === name ? saved : row)))
            } catch (error) {
                await patch(!enabled)
                throw error
            }
        },
        [change]
    )

    const deleteRule = React.useCallback(
        async (name: string) => {
            await rulesAPI.deleteRule(name)
            await change((list) => list.filter((row) => row.name !== name))
        },
        [change]
    )

    return {
        rules: query.data ?? [],
        isLoading: query.isPending,
        loadFailed: query.isError && !query.data,
        retry: query.refetch,
        saveRule,
        setRuleEnabled,
        deleteRule,
    }
}

export const useMemories = () => {
    const queryClient = useQueryClient()
    const query = useQuery({
        queryKey: CONNECTIONS_MEMORY_KEY,
        queryFn: memoryAPI.listMemories,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })

    const change = React.useCallback(
        async (update: (data: MemoryList) => MemoryList) => {
            if (queryClient.getQueryData(CONNECTIONS_MEMORY_KEY) === undefined) {
                await queryClient.invalidateQueries({ queryKey: CONNECTIONS_MEMORY_KEY })
                return
            }
            await queryClient.cancelQueries({ queryKey: CONNECTIONS_MEMORY_KEY })
            queryClient.setQueryData<MemoryList>(CONNECTIONS_MEMORY_KEY, (data) =>
                data ? update(data) : data
            )
        },
        [queryClient]
    )

    /** the switch moves at once and moves back when the server refuses */
    const setEnabled = React.useCallback(
        async (enabled: boolean) => {
            await change((data) => ({ ...data, enabled }))
            try {
                const saved = await memoryAPI.setMemoryEnabled(enabled)
                await change((data) => ({ ...data, enabled: saved.enabled }))
            } catch (error) {
                await change((data) => ({ ...data, enabled: !enabled }))
                throw error
            }
        },
        [change]
    )

    const addMemory = React.useCallback(
        async (content: string) => {
            const saved = await memoryAPI.addMemory(content)
            await change((data) => ({
                ...data,
                memories: [saved, ...data.memories.filter((row) => row.id !== saved.id)],
            }))
            return saved
        },
        [change]
    )

    const updateMemory = React.useCallback(
        async (id: string, content: string) => {
            const saved = await memoryAPI.updateMemory(id, content)
            // an edited memory is the newest, like the api sorts it
            await change((data) => ({
                ...data,
                memories: [saved, ...data.memories.filter((row) => row.id !== id)],
            }))
            return saved
        },
        [change]
    )

    const deleteMemory = React.useCallback(
        async (id: string) => {
            await memoryAPI.deleteMemory(id)
            await change((data) => ({
                ...data,
                memories: data.memories.filter((row) => row.id !== id),
            }))
        },
        [change]
    )

    const deleteAll = React.useCallback(async () => {
        await memoryAPI.deleteAllMemories()
        await change((data) => ({ ...data, memories: [] }))
    }, [change])

    return {
        enabled: query.data?.enabled ?? false,
        memories: query.data?.memories ?? ([] as ApiMemory[]),
        isLoading: query.isPending,
        loadFailed: query.isError && !query.data,
        retry: query.refetch,
        setEnabled,
        addMemory,
        updateMemory,
        deleteMemory,
        deleteAll,
    }
}
