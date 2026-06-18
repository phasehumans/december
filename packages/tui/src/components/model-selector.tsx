import { Box, Text, useInput } from 'ink'
import { useState } from 'react'

const MODELS = [
    { id: 'claude-opus-4-6', label: 'claude-opus-4-6' },
    { id: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
    { id: 'claude-haiku-4-6', label: 'claude-haiku-4-6' },
    { id: 'gpt-4o', label: 'gpt-4o' },
    { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
    { id: 'gemini-2.5-flash', label: 'gemini-2.5-flash' },
    { id: 'gemini-2.5-pro', label: 'gemini-2.5-pro' },
]

const WINDOW_SIZE = 5

export function ModelSelector() {
    const [open, setOpen] = useState(false)
    const [selectedId, setSelectedId] = useState(MODELS[0]!.id)
    const [cursor, setCursor] = useState(0)
    const [windowStart, setWindowStart] = useState(0)

    const currentModel = MODELS.find((m) => m.id === selectedId) ?? MODELS[0]!

    useInput((_input, key) => {
        if (!open) return

        if (key.escape) {
            setOpen(false)
        } else if (key.upArrow) {
            setCursor((c) => {
                const next = Math.max(0, c - 1)
                setWindowStart((ws) => (next < ws ? next : ws))
                return next
            })
        } else if (key.downArrow) {
            setCursor((c) => {
                const next = Math.min(MODELS.length - 1, c + 1)
                setWindowStart((ws) => (next >= ws + WINDOW_SIZE ? next - WINDOW_SIZE + 1 : ws))
                return next
            })
        } else if (key.return) {
            setSelectedId(MODELS[cursor]!.id)
            setOpen(false)
        }
    })

    if (open) {
        const windowEnd = Math.min(windowStart + WINDOW_SIZE, MODELS.length)
        const visibleModels = MODELS.slice(windowStart, windowEnd)
        const itemsAbove = windowStart
        const itemsBelow = MODELS.length - windowEnd

        return (
            <Box flexDirection="column">
                {itemsAbove > 0 && (
                    <Box>
                        <Text color="gray">↑ {itemsAbove} more</Text>
                    </Box>
                )}
                {visibleModels.map((model, relIdx) => {
                    const absIdx = windowStart + relIdx
                    const isActive = absIdx === cursor
                    return (
                        <Box key={model.id}>
                            <Text color={isActive ? 'white' : 'gray'}>
                                {isActive ? '> ' : '  '}
                                {model.label}
                            </Text>
                        </Box>
                    )
                })}
                {itemsBelow > 0 && (
                    <Box>
                        <Text color="gray">↓ {itemsBelow} more</Text>
                    </Box>
                )}
                <Box marginTop={1} gap={1}>
                    <Text color="gray">↑↓</Text>
                    <Text color="white">Navigate</Text>
                    <Text color="gray">·</Text>
                    <Text color="gray">enter</Text>
                    <Text color="white">Select</Text>
                    <Text color="gray">·</Text>
                    <Text color="gray">esc</Text>
                    <Text color="white">Cancel</Text>
                </Box>
            </Box>
        )
    }

    return (
        <Box>
            <Text color="gray">{currentModel.label}</Text>
        </Box>
    )
}
