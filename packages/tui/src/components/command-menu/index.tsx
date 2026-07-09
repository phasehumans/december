import { Box, Text } from 'ink'

import { getFilteredCommands } from './filter-commands'

const WINDOW_SIZE = 5
const CMD_COL_WIDTH = 24

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
                <Text color="#AAAAAA">No matching commands</Text>
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
                    <Text color="#AAAAAA">↑ {itemsAbove} more</Text>
                </Box>
            )}

            {/* Command rows */}
            {visibleItems.map((cmd, relIdx) => {
                const absIdx = windowStart + relIdx
                const isSelected = absIdx === selectedIndex
                return (
                    <Box key={cmd.value} paddingLeft={2}>
                        <Text color={isSelected ? '#89B4F8' : '#AAAAAA'}>
                            {isSelected ? '❭ ' : '  '}
                        </Text>
                        <Box width={CMD_COL_WIDTH}>
                            <Text color={isSelected ? '#89B4F8' : '#AAAAAA'} bold={false}>
                                /{cmd.name}
                            </Text>
                        </Box>
                        <Text color="#AAAAAA">{cmd.description}</Text>
                    </Box>
                )
            })}

            {/* ↓ N more */}
            {itemsBelow > 0 && (
                <Box paddingLeft={2}>
                    <Text color="#AAAAAA">↓ {itemsBelow} more</Text>
                </Box>
            )}

            {/* Footer */}
            <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
                <Box gap={1}>
                    <Text color="#89B4F8">↑/↓</Text>
                    <Text color="#AAAAAA">Navigate</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">enter</Text>
                    <Text color="#AAAAAA">Select</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">tab</Text>
                    <Text color="#AAAAAA">Complete</Text>
                </Box>
                <Box gap={1}>
                    <Text color="#AAAAAA">esc to cancel</Text>
                </Box>
            </Box>
        </Box>
    )
}
