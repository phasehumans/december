import { useEffect, useState } from 'react'

import { getNextTip } from '../constants/tips'

import { useTerminalColumns } from './use-terminal-columns'

export interface UseDelayedTipOptions {
    minColumns?: number
    delayMs?: number
}

const DEFAULT_DELAY_MS = 2000
const DEFAULT_MIN_COLUMNS = 75

/**
 * Hook that presents a subtle tip when an operation runs longer than delayMs (default 2s).
 * Enforces a minimum terminal column width (default 75), respects cooldowns, and resets
 * to null as soon as the operation becomes inactive.
 *
 * @param active Whether the loader/operation is currently running
 * @param options Configurable minimum columns and delay threshold in ms
 * @returns The tip string if active and eligible, otherwise null
 */
export function useDelayedTip(active: boolean, options?: UseDelayedTipOptions): string | null {
    const minColumns = options?.minColumns ?? DEFAULT_MIN_COLUMNS
    const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS

    const columns = useTerminalColumns()
    const [tip, setTip] = useState<string | null>(null)

    useEffect(() => {
        if (!active || columns < minColumns) {
            setTip(null)
            return
        }

        const timer = setTimeout(() => {
            const nextTip = getNextTip()
            if (nextTip) {
                setTip(nextTip)
            }
        }, delayMs)

        return () => {
            clearTimeout(timer)
            setTip(null)
        }
    }, [active, columns, minColumns, delayMs])

    if (!active || columns < minColumns) {
        return null
    }

    return tip
}
