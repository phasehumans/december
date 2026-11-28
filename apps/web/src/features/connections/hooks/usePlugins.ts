import { useQuery, useQueryClient } from '@tanstack/react-query'
import React from 'react'

import { pluginsAPI, type ApiPlugin } from '../api/plugins'

import { PROMPT_BOX_CONNECTIONS_KEY } from '@/features/home/api/promptBoxConnections'
import { CACHE_PRESETS } from '@/shared/lib/query-cache'

// the plugins of the account and the built-in marketplace. every action calls the api and
// puts the answer in the cached list; the prompt box reads again after each change

export const CONNECTIONS_PLUGINS_KEY = ['connections', 'plugins'] as const
export const CONNECTIONS_MARKETPLACE_KEY = ['connections', 'plugins', 'marketplace'] as const

const byName = (a: ApiPlugin, b: ApiPlugin) => a.name.localeCompare(b.name)

export const usePlugins = (options: { withMarketplace?: boolean } = {}) => {
    const { withMarketplace = false } = options
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: CONNECTIONS_PLUGINS_KEY,
        queryFn: pluginsAPI.listPlugins,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })
    const marketplace = useQuery({
        queryKey: CONNECTIONS_MARKETPLACE_KEY,
        queryFn: pluginsAPI.listMarketplace,
        enabled: withMarketplace,
        staleTime: CACHE_PRESETS.DYNAMIC,
    })

    /** puts a change in the cached list; a read still on its way is dropped first */
    const change = React.useCallback(
        async (next: (list: ApiPlugin[]) => ApiPlugin[]) => {
            await queryClient.cancelQueries({ queryKey: CONNECTIONS_PLUGINS_KEY, exact: true })
            queryClient.setQueryData<ApiPlugin[]>(CONNECTIONS_PLUGINS_KEY, (list) =>
                next(list ?? [])
            )
        },
        [queryClient]
    )

    const refreshOthers = React.useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: CONNECTIONS_MARKETPLACE_KEY })
        void queryClient.invalidateQueries({ queryKey: PROMPT_BOX_CONNECTIONS_KEY })
    }, [queryClient])

    const putPlugin = React.useCallback(
        (plugin: ApiPlugin) =>
            change((list) =>
                [...list.filter((row) => row.name !== plugin.name), plugin].sort(byName)
            ),
        [change]
    )

    const install = React.useCallback(
        async (source: string) => {
            const plugin = await pluginsAPI.installPlugin(source)
            await putPlugin(plugin)
            refreshOthers()
            return plugin
        },
        [putPlugin, refreshOthers]
    )

    /** the switch moves at once and moves back when the server refuses */
    const setEnabled = React.useCallback(
        async (name: string, enabled: boolean) => {
            const patch = (value: boolean) =>
                change((list) =>
                    list.map((row) => (row.name === name ? { ...row, enabled: value } : row))
                )
            await patch(enabled)
            try {
                await putPlugin(await pluginsAPI.setPluginEnabled(name, enabled))
            } catch (error) {
                await patch(!enabled)
                throw error
            } finally {
                refreshOthers()
            }
        },
        [change, putPlugin, refreshOthers]
    )

    const update = React.useCallback(
        async (name: string) => {
            const { plugin, changed } = await pluginsAPI.updatePlugin(name)
            await putPlugin(plugin)
            refreshOthers()
            return { plugin, changed }
        },
        [putPlugin, refreshOthers]
    )

    const uninstall = React.useCallback(
        async (name: string) => {
            await pluginsAPI.uninstallPlugin(name)
            await change((list) => list.filter((row) => row.name !== name))
            refreshOthers()
        },
        [change, refreshOthers]
    )

    return {
        plugins: query.data ?? [],
        isLoading: query.isPending,
        loadFailed: query.isError && !query.data,
        marketplaces: marketplace.data ?? [],
        marketplaceLoading: withMarketplace && marketplace.isPending,
        marketplaceFailed: marketplace.isError && !marketplace.data,
        install,
        setEnabled,
        update,
        uninstall,
    }
}
