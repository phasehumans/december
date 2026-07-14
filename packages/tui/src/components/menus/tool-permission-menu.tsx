import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import React from 'react'

import { CustomIndicator, CustomItem } from './menu-items'

export interface ToolPermissionMenuProps {
    questions: Array<{
        question: string
        options: string[]
    }>
    onComplete: (answer: string) => void
}

export function ToolPermissionMenu({ questions, onComplete }: ToolPermissionMenuProps) {
    const currentQ = questions[0]
    if (!currentQ) return null

    const items = currentQ.options.map((opt) => ({ label: opt, value: opt }))

    const handleSelect = (item: any) => {
        onComplete(item.value)
    }

    return (
        <Box flexDirection="column" paddingX={1}>
            <Box marginBottom={1}>
                <Text color="white" bold>
                    {currentQ.question}
                </Text>
            </Box>
            <SelectInput
                items={items}
                onSelect={handleSelect}
                indicatorComponent={CustomIndicator}
                itemComponent={CustomItem}
            />
            <Box paddingTop={1}>
                <Box gap={1}>
                    <Text color="#89B4F8">↑↓</Text>
                    <Text color="#AAAAAA">Navigate</Text>
                    <Text color="#AAAAAA">·</Text>
                    <Text color="#89B4F8">enter</Text>
                    <Text color="#AAAAAA">Select</Text>
                </Box>
            </Box>
        </Box>
    )
}
