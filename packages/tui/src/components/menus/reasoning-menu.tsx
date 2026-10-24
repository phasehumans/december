import { Box, Text, useInput } from 'ink'
import React, { useState } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export type ReasoningLevel = 'auto' | 'off' | 'low' | 'medium' | 'high'

export interface ReasoningMenuProps {
    activeModel?: string
    settingsThinkingLevel?: 'auto' | 'off' | 'minimal' | 'low' | 'medium' | 'high'
    handleReasoningSelect?: (level: ReasoningLevel) => void
    setAuthMode?: (mode: string) => void
    previousAuthMode?: string
    agent?: any
}

const REASONING_OPTIONS: { label: string; value: ReasoningLevel }[] = [
    { label: 'Auto', value: 'auto' },
    { label: 'Off', value: 'off' },
    { label: 'Low', value: 'low' },
    { label: 'Medium', value: 'medium' },
    { label: 'High', value: 'high' },
]

export function ReasoningMenu(props: ReasoningMenuProps) {
    const {
        activeModel,
        settingsThinkingLevel = 'auto',
        handleReasoningSelect,
        setAuthMode,
        previousAuthMode,
        agent,
    } = props

    // Normalize 'minimal' to 'low' for backwards compatibility
    const currentLevel: ReasoningLevel =
        settingsThinkingLevel === 'minimal' ? 'low' : settingsThinkingLevel

    const initialIdx = REASONING_OPTIONS.findIndex((item) => item.value === currentLevel)
    const [selectedIndex, setSelectedIndex] = useState(initialIdx >= 0 ? initialIdx : 0)

    useInput((input, key) => {
        if (key.upArrow || input === 'k') {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : REASONING_OPTIONS.length - 1))
            return
        }

        if (key.downArrow || input === 'j') {
            setSelectedIndex((prev) => (prev < REASONING_OPTIONS.length - 1 ? prev + 1 : 0))
            return
        }

        if (key.return) {
            const currentItem = REASONING_OPTIONS[selectedIndex]
            if (currentItem && handleReasoningSelect) {
                handleReasoningSelect(currentItem.value)
            }
            return
        }

        if (key.escape || input === '\u001B') {
            if (setAuthMode) {
                const backTarget =
                    previousAuthMode && previousAuthMode !== 'reasoning_select'
                        ? previousAuthMode
                        : 'none'
                setAuthMode(backTarget)
            }
            return
        }
    })

    const modelLabel = activeModel || agent?.modelOptions?.model || 'default'

    return (
        <Box flexDirection="column">
            <Box marginBottom={1} gap={1}>
                <Text bold color={THEME.colors.text}>
                    Reasoning
                </Text>
                <Text color={THEME.colors.muted}>·</Text>
                <Text color={THEME.colors.brand}>{modelLabel}</Text>
            </Box>

            {REASONING_OPTIONS.map((item, idx) => {
                const isSelected = idx === selectedIndex
                const isCurrent = item.value === currentLevel
                return (
                    <Box key={item.value}>
                        <Box marginRight={1}>
                            <Text color={THEME.colors.brand}>
                                {isSelected ? THEME.glyphs.selector : ' '}
                            </Text>
                        </Box>
                        <Text color={isSelected ? THEME.colors.brand : THEME.colors.text}>
                            {item.label}
                        </Text>
                        {isCurrent && <Text color={THEME.colors.success}> (Current)</Text>}
                    </Box>
                )
            })}

            <MenuFooter
                items={[
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'select' },
                    { key: 'esc', label: 'close' },
                ]}
            />
        </Box>
    )
}
