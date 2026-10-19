import { Text } from 'ink'
import React from 'react'

export interface RawAnsiProps {
    lines: string[]
    width?: number
}

/**
 * Bypass nested React / Yoga layout tree calculation for content that
 * is already formatted as terminal-ready ANSI strings.
 *
 * Emits a single Text leaf element that joins pre-rendered ANSI lines,
 * reducing layout node allocations from O(lines * spans) to O(1).
 */
export const RawAnsi = React.memo(function RawAnsi({ lines, width }: RawAnsiProps) {
    if (!lines || lines.length === 0) {
        return null
    }

    const content = lines.join('\n')

    return <Text wrap="truncate-end">{content}</Text>
})
