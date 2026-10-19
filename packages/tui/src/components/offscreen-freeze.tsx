import { Box } from 'ink'
import React, { useRef } from 'react'

import { useTerminalViewport } from '../hooks/use-terminal-viewport'

export interface OffscreenFreezeProps {
    children: React.ReactNode
    /**
     * Set to true to disable freezing (always render live children).
     */
    disabled?: boolean
}

/**
 * Freezes children when they scroll above the terminal viewport (into scrollback).
 *
 * Any content change above the viewport forces log-update into a full terminal
 * reset (it cannot partially update rows that have scrolled out). For content that
 * updates on a timer - spinners, elapsed counters - this produces a reset per tick.
 *
 * When offscreen, returns the same ReactElement reference that was cached during
 * the last visible render. React's reconciler bails on identical element refs, so
 * the subtree never re-renders, producing zero diff and zero log-update redraw flashes.
 */
export function OffscreenFreeze({
    children,
    disabled = false,
}: OffscreenFreezeProps): React.ReactNode {
    const [ref, { isVisible }] = useTerminalViewport()
    const cachedRef = useRef(children)

    if (disabled || isVisible) {
        cachedRef.current = children
    }

    return <Box ref={ref}>{cachedRef.current}</Box>
}
