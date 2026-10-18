import { Box, Text } from 'ink'
import React from 'react'

import { THEME } from '../../theme'

import { getFilteredCommands } from './filter-commands'

const WINDOW_SIZE = 5
const CMD_COL_WIDTH = 32

type CommandMenuProps = {
    query: string
    selectedIndex: number
    windowStart: number
    totalFiltered: number
    onSelect: (index: number) => void
    onExecute: (index: number) => void
}

export function CommandMenu({ query, selectedIndex, windowStart }: CommandMenuProps) {
    const filtered = getFilteredCommands(query)

    if (filtered.length === 0) {
        return (
            <Box paddingLeft={2}>
                <Text color={THEME.colors.muted}>No matching commands</Text>
            </Box>
        )
    }

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, filtered.length)
    const visibleItems = filtered.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = filtered.length - windowEnd
    const hasOverflow = filtered.length > WINDOW_SIZE

    let statusText = ''
    if (hasOverflow) {
        if (itemsAbove > 0 && itemsBelow > 0) {
            statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
        } else if (itemsAbove > 0) {
            statusText = `↑ ${itemsAbove} more`
        } else if (itemsBelow > 0) {
            statusText = `↓ ${itemsBelow} more`
        }
    }

    return (
        <Box flexDirection="column">
            {/* command rows */}
            {visibleItems.map((cmd, relIdx) => {
                const absIdx = windowStart + relIdx
                const isSelected = absIdx === selectedIndex
                return (
                    <Box key={cmd.value}>
                        <Text color={isSelected ? THEME.colors.brand : THEME.colors.muted}>
                            {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                        </Text>
                        <Box width={CMD_COL_WIDTH} marginRight={2} flexShrink={0}>
                            <Text
                                color={isSelected ? THEME.colors.brand : THEME.colors.muted}
                                bold={false}
                                wrap="truncate-end"
                            >
                                /{cmd.name}
                            </Text>
                        </Box>
                        <Box flexShrink={1}>
                            <Text color={THEME.colors.muted} wrap="truncate-end">
                                {cmd.description}
                            </Text>
                        </Box>
                    </Box>
                )
            })}

            {/* bottom status line for overflow pagination */}
            {hasOverflow && statusText && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>{statusText}</Text>
                </Box>
            )}
        </Box>
    )
}
