import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { hooksAPI, type ApiHook, type HookInput } from '../api/hooks'

import { CACHE_PRESETS } from '@/shared/lib/query-cache'

// the user hooks of the account. every action calls the api and puts the answer in the
// cached list, in the saved order

export const CONNECTIONS_HOOKS_KEY = ['connections', 'hooks'] as const

export const useHooks = () => {
    const queryClient = useQueryClient()
    const query = useQuery({
        queryKey: CONNECTIONS_HOOKS_KEY,
        queryFn: hooksAPI.listHooks,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })

    const change = React.useCallback(
        async (next: (list: ApiHook[]) => ApiHook[]) => {
            await queryClient.cancelQueries({ queryKey: CONNECTIONS_HOOKS_KEY })
            queryClient.setQueryData<ApiHook[]>(CONNECTIONS_HOOKS_KEY, (list) => next(list ?? []))
        },
        [queryClient]
    )

    const putHook = React.useCallback(
        (hook: ApiHook) =>
            change((list) =>
                list.some((row) => row.id === hook.id)
                    ? list.map((row) => (row.id === hook.id ? hook : row))
                    : [...list, hook]
            ),
        [change]
    )

    /** creates a hook, or saves the hook with `id` */
    const saveHook = React.useCallback(
        async (hook: HookInput, id?: string) => {
            const saved = id ? await hooksAPI.updateHook(id, hook) : await hooksAPI.createHook(hook)
            await putHook(saved)
            return saved
        },
        [putHook]
    )

    /** the switch moves at once and moves back when the server refuses */
    const setHookEnabled = React.useCallback(
        async (id: string, enabled: boolean) => {
            const patch = (value: boolean) =>
                change((list) =>
                    list.map((row) => (row.id === id ? { ...row, enabled: value } : row))
                )
            await patch(enabled)
            try {
                await putHook(await hooksAPI.updateHook(id, { enabled }))
            } catch (error) {
                await patch(!enabled)
                throw error
            }
        },
        [change, putHook]
    )

    const deleteHook = React.useCallback(
        async (id: string) => {
            await hooksAPI.deleteHook(id)
            await change((list) => list.filter((row) => row.id !== id))
        },
        [change]
    )

    const replaceHooks = React.useCallback(
        async (hooks: HookInput[]) => {
            const saved = await hooksAPI.replaceHooks(hooks)
            await change(() => saved)
            return saved
        },
        [change]
    )

    return {
        hooks: query.data ?? [],
        isLoading: query.isPending,
        loadFailed: query.isError && !query.data,
        saveHook,
        setHookEnabled,
        deleteHook,
        replaceHooks,
    }
}
