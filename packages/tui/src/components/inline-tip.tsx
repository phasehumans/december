import { Text } from 'ink'
import React from 'react'

import { useDelayedTip, type UseDelayedTipOptions } from '../hooks/use-delayed-tip'
import { THEME } from '../theme'

export interface InlineTipProps {
    active?: boolean
    options?: UseDelayedTipOptions
}

/**
 * Subtle single-line tip component rendered inline next to active loaders/spinners.
 * Displays with a dim middle-dot separator and muted styling after the latency threshold.
 */
export function InlineTip({ active = true, options }: InlineTipProps) {
    const tip = useDelayedTip(active, options)

    if (!tip) {
        return null
    }

    return (
        <Text>
            <Text color={THEME.colors.dim}>· </Text>
            <Text color={THEME.colors.subtle}>tip: </Text>
            <Text color={THEME.colors.dim}>{tip}</Text>
        </Text>
    )
}
