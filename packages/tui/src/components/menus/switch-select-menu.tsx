import { Box, Text, useInput } from 'ink'
import React, { useState, useRef } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface SwitchSelectMenuProps {
    handleSwitchSelect: (value: string) => void
    handleDeleteProvider?: (value: string) => void
    switchItems?: { label: string; value: string; model?: string; isActive?: boolean }[]
    setAuthMode?: (mode: string) => void
    previousAuthMode?: string
}

export interface SwitchItemProps {
    label: string
    isSelected?: boolean
    isActive?: boolean
}

export const SwitchItem = ({ label, isSelected, isActive }: SwitchItemProps) => (
    <Box>
        <Text color={isSelected ? THEME.colors.brand : THEME.colors.text}>{label}</Text>
        {isActive ? <Text color={THEME.colors.success}> (Active)</Text> : null}
    </Box>
)

export function SwitchSelectMenu(props: SwitchSelectMenuProps) {
    const {
        handleSwitchSelect,
        handleDeleteProvider,
        switchItems = [],
        setAuthMode,
        previousAuthMode,
    } = props

    const [selectedIndex, setSelectedIndex] = useState(0)
    const [confirmDeleteValue, setConfirmDeleteValue] = useState<string | null>(null)

    const selectedIdxRef = useRef(selectedIndex)
    selectedIdxRef.current = selectedIndex

    const confirmDeleteValueRef = useRef(confirmDeleteValue)
    confirmDeleteValueRef.current = confirmDeleteValue

    const switchItemsRef = useRef(switchItems)
    switchItemsRef.current = switchItems

    useInput((input, key) => {
        // 1. Delete confirmation mode
        if (confirmDeleteValueRef.current) {
            if (input === 'y' || input === 'Y') {
                const targetValue = confirmDeleteValueRef.current
                setConfirmDeleteValue(null)
                if (handleDeleteProvider) {
                    handleDeleteProvider(targetValue)
                }
                if (selectedIdxRef.current >= switchItemsRef.current.length - 1) {
                    setSelectedIndex(Math.max(0, switchItemsRef.current.length - 2))
                }
                return
            }

            if (input === 'n' || input === 'N' || key.escape) {
                setConfirmDeleteValue(null)
                return
            }

            return
        }

        // 2. Trigger delete confirmation
        if (input === 'd' || input === 'D') {
            const currentItem = switchItemsRef.current[selectedIdxRef.current]
            if (currentItem) {
                setConfirmDeleteValue(currentItem.value)
            }
            return
        }

        // 3. Navigation
        if (key.upArrow || input === 'k') {
            if (selectedIdxRef.current > 0) {
                setSelectedIndex(selectedIdxRef.current - 1)
            }
            return
        }

        if (key.downArrow || input === 'j') {
            if (selectedIdxRef.current < switchItemsRef.current.length - 1) {
                setSelectedIndex(selectedIdxRef.current + 1)
            }
            return
        }

        if (key.return) {
            const currentItem = switchItemsRef.current[selectedIdxRef.current]
            if (currentItem) {
                handleSwitchSelect(currentItem.value)
            }
            return
        }

        if (key.escape) {
            if (setAuthMode) {
                const target =
                    previousAuthMode && previousAuthMode !== 'switch_select'
                        ? previousAuthMode
                        : 'none'
                setAuthMode(target)
            }
            return
        }
    })

    const safeIndex = Math.min(selectedIndex, Math.max(0, switchItems.length - 1))

    const isReturningBack = Boolean(
        previousAuthMode && previousAuthMode !== 'none' && previousAuthMode !== 'switch_select'
    )

    const footerItems = confirmDeleteValue
        ? [
              { key: 'y', label: 'confirm' },
              { key: 'n / esc', label: 'cancel' },
          ]
        : [
              { key: '↑/↓', label: 'navigate' },
              { key: 'enter', label: 'switch' },
              { key: 'd', label: 'delete' },
              { key: 'esc', label: isReturningBack ? 'back' : 'close' },
          ]

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color={THEME.colors.text}>
                    Switch Provider
                </Text>
            </Box>

            {switchItems.map((item, idx) => {
                const isSelected = idx === safeIndex
                const isConfirmingDelete = item.value === confirmDeleteValue

                return (
                    <Box key={item.value} flexDirection="row">
                        <Box marginRight={1}>
                            <Text color={THEME.colors.brand}>
                                {isSelected ? THEME.glyphs.selector : ' '}
                            </Text>
                        </Box>
                        <Box>
                            <Text wrap="truncate">
                                <Text color={isSelected ? THEME.colors.brand : THEME.colors.text}>
                                    {item.label}
                                </Text>
                                {item.isActive && (
                                    <Text color={THEME.colors.success}> (Active)</Text>
                                )}
                                {isConfirmingDelete && (
                                    <Text color={THEME.colors.error}> [Delete? (y/n)]</Text>
                                )}
                            </Text>
                        </Box>
                    </Box>
                )
            })}

            {switchItems.length === 0 && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>No configured providers found.</Text>
                </Box>
            )}

            <MenuFooter items={footerItems} />
        </Box>
    )
}
