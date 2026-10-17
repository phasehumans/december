import { Box, Text, useInput } from 'ink'
import React, { useState } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface MenuMenuProps {
    handleAuthMenuSelect?: (item: { label: string; value: string; force?: boolean }) => void
    setAuthMode?: (mode: string) => void
    detectedSubscriptions?: Record<string, any> | string[]
    userEmail?: string
    currentEmail?: string
    isAuthenticated?: boolean
    authMethod?: string
    hasBothAuth?: boolean
    addToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function MenuMenu(props: MenuMenuProps) {
    const {
        handleAuthMenuSelect,
        setAuthMode,
        userEmail,
        currentEmail,
        isAuthenticated,
        authMethod,
        hasBothAuth,
        addToast,
    } = props
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [confirmSwitch, setConfirmSwitch] = useState(false)

    const email = currentEmail || userEmail
    const isDecemberLoggedIn = Boolean(
        isAuthenticated && email && (authMethod === 'december' || hasBothAuth || !authMethod)
    )

    const items = [
        {
            label: 'Bring Your Own Key or Subscription',
            value: 'byok',
        },
        {
            label: isDecemberLoggedIn
                ? `Login via December (Logged in as ${email})`
                : 'Login via December',
            value: 'december',
        },
    ]

    useInput((input, key) => {
        // Confirmation mode: "Do you want to switch to a different account? (y/N)"
        if (confirmSwitch) {
            if (input === 'y' || input === 'Y') {
                setConfirmSwitch(false)
                if (handleAuthMenuSelect) {
                    handleAuthMenuSelect({
                        label: 'Login via December',
                        value: 'december',
                        force: true,
                    })
                }
                return
            }

            if (input === 'n' || input === 'N' || key.escape || input === '\u001B' || key.return) {
                setConfirmSwitch(false)
                if (setAuthMode) {
                    setAuthMode('none')
                }
                if (addToast && email) {
                    addToast(`Already logged in as ${email}.`, 'info')
                }
                return
            }
            return
        }

        if (key.upArrow || input === 'k') {
            if (selectedIndex > 0) {
                setSelectedIndex(selectedIndex - 1)
            }
            return
        }

        if (key.downArrow || input === 'j') {
            if (selectedIndex < items.length - 1) {
                setSelectedIndex(selectedIndex + 1)
            }
            return
        }

        if (key.return) {
            const currentItem = items[selectedIndex]
            if (!currentItem) return

            if (currentItem.value === 'december' && isDecemberLoggedIn) {
                setConfirmSwitch(true)
                return
            }

            if (handleAuthMenuSelect) {
                handleAuthMenuSelect(currentItem)
            }
            return
        }

        if (key.escape || input === '\u001B') {
            if (setAuthMode) {
                setAuthMode('none')
            }
            return
        }
    })

    if (confirmSwitch) {
        return (
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text color={THEME.colors.text}>
                        You are already logged in as{' '}
                        <Text color={THEME.colors.brand} bold>
                            {email}
                        </Text>
                        .
                    </Text>
                </Box>
                <Box marginBottom={1}>
                    <Text color={THEME.colors.warning}>
                        Do you want to switch to a different account? (y/N)
                    </Text>
                </Box>

                <MenuFooter
                    items={[
                        { key: 'y', label: 'Switch Account' },
                        { key: 'n / esc', label: 'Cancel' },
                    ]}
                />
            </Box>
        )
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text color={THEME.colors.text}>Select authentication method:</Text>
            </Box>

            {items.map((item, idx) => {
                const isSelected = idx === selectedIndex
                return (
                    <Box key={item.value} paddingLeft={0}>
                        <Box marginRight={1}>
                            <Text color={THEME.colors.brand}>
                                {isSelected ? THEME.glyphs.selector : ' '}
                            </Text>
                        </Box>
                        <Text color={isSelected ? THEME.colors.brand : THEME.colors.text}>
                            {item.label}
                        </Text>
                    </Box>
                )
            })}

            <MenuFooter
                items={[
                    { key: '↑/↓', label: 'Navigate' },
                    { key: 'enter', label: 'Select' },
                    { key: 'esc', label: 'Cancel' },
                ]}
            />
        </Box>
    )
}
