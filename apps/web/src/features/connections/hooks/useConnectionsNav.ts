import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CONNECTIONS_BASE_PATH } from '../lib/paths'

import type { ConnectionsTab } from '../types'

/** links inside the connections page, plus the ?add flag that opens a tab's add modal */
export const useConnectionsNav = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const addParam = searchParams.get('add')

    const toTab = React.useCallback(
        (tab: ConnectionsTab) => navigate(`${CONNECTIONS_BASE_PATH}/${tab}`),
        [navigate]
    )
    const toItem = React.useCallback(
        (tab: ConnectionsTab, id: string, options?: { replace?: boolean }) =>
            navigate(`${CONNECTIONS_BASE_PATH}/${tab}/${encodeURIComponent(id)}`, options),
        [navigate]
    )
    const openAdd = React.useCallback(
        (kind = '1') =>
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    next.set('add', kind)
                    return next
                },
                { replace: true }
            ),
        [setSearchParams]
    )
    const closeAdd = React.useCallback(
        () =>
            setSearchParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    next.delete('add')
                    return next
                },
                { replace: true }
            ),
        [setSearchParams]
    )

    return { navigate, toTab, toItem, addParam, openAdd, closeAdd }
}
