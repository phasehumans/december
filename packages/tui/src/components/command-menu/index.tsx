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
                <Text color="gray">No matching commands</Text>
            </Box>
        )
    }

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, filtered.length)
    const visibleItems = filtered.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = filtered.length - windowEnd

    return (
        <Box flexDirection="column">
            {/* ↑ N more above */}
            {itemsAbove > 0 && (
                <Box paddingLeft={4}>
                    <Text color="gray">↑ {itemsAbove} more</Text>
                </Box>
            )}

            {/* Visible command rows */}
            {visibleItems.map((cmd, relIdx) => {
                const absIdx = windowStart + relIdx
                const isSelected = absIdx === selectedIndex
                return (
                    <Box key={cmd.value} paddingLeft={2}>
                        <Text color={isSelected ? 'white' : 'gray'}>
                            {isSelected ? '> ' : '  '}
                        </Text>
                        <Box width={CMD_COL_WIDTH}>
                            <Text color={isSelected ? 'white' : 'gray'} bold={isSelected}>
                                /{cmd.name}
                            </Text>
                        </Box>
                        <Text color="gray">{cmd.description}</Text>
                    </Box>
                )
            })}

            {/* ↓ N more below */}
            {itemsBelow > 0 && (
                <Box paddingLeft={4}>
                    <Text color="gray">↓ {itemsBelow} more</Text>
                </Box>
            )}

            {/* Single-line footer: ↑↓ Navigate · enter Select · tab Complete · esc Cancel */}
            <Box paddingLeft={2} paddingTop={1} paddingBottom={1} gap={1}>
                <Text color="gray">↑↓</Text>
                <Text color="white">Navigate</Text>
                <Text color="gray">·</Text>
                <Text color="gray">enter</Text>
                <Text color="white">Select</Text>
                <Text color="gray">·</Text>
                <Text color="gray">tab</Text>
                <Text color="white">Complete</Text>
                <Text color="gray">·</Text>
                <Text color="gray">esc</Text>
                <Text color="white">Cancel</Text>
            </Box>
        </Box>
    )
}
