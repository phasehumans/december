import { Box, Text } from 'ink'

import { getFilteredCommands } from './filter-commands'

const WINDOW_SIZE = 5
const CMD_COL_WIDTH = 14

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
            <Box paddingLeft={2} paddingY={1}>
                <Text color="#888888">No matching commands</Text>
            </Box>
        )
    }

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, filtered.length)
    const visibleItems = filtered.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = filtered.length - windowEnd

    return (
        <Box flexDirection="column">
            {/* ↑ N more */}
            {itemsAbove > 0 && (
                <Box paddingLeft={2}>
                    <Text color="#888888">↑ {itemsAbove} more</Text>
                </Box>
            )}

            {/* Command rows */}
            {visibleItems.map((cmd, relIdx) => {
                const absIdx = windowStart + relIdx
                const isSelected = absIdx === selectedIndex
                return (
                    <Box key={cmd.value} paddingLeft={2}>
                        <Text color={isSelected ? '#FFFFFF' : '#888888'}>
                            {isSelected ? '● ' : '  '}
                        </Text>
                        <Box width={CMD_COL_WIDTH}>
                            <Text color={isSelected ? '#FFFFFF' : '#888888'} bold={isSelected}>
                                /{cmd.name}
                            </Text>
                        </Box>
                        <Text color="#888888">{cmd.description}</Text>
                    </Box>
                )
            })}

            {/* ↓ N more */}
            {itemsBelow > 0 && (
                <Box paddingLeft={2}>
                    <Text color="#888888">↓ {itemsBelow} more</Text>
                </Box>
            )}

            {/* Single-line footer */}
            <Box paddingLeft={2} paddingTop={1} paddingBottom={1} gap={1}>
                <Text color="#888888">↑↓</Text>
                <Text color="#FFFFFF">Navigate</Text>
                <Text color="#888888">·</Text>
                <Text color="#888888">enter</Text>
                <Text color="#FFFFFF">Select</Text>
                <Text color="#888888">·</Text>
                <Text color="#888888">tab</Text>
                <Text color="#FFFFFF">Complete</Text>
                <Text color="#888888">·</Text>
                <Text color="#888888">esc</Text>
                <Text color="#FFFFFF">Cancel</Text>
            </Box>
        </Box>
    )
}
