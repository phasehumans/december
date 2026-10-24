import { Box, Text, useInput } from 'ink'
import React, { useState, useMemo, useRef } from 'react'

import { THEME } from '../../theme'
import TextInput from '../text-input'

import { getSubscriptionAccount } from './byok-provider-menu'
import { MenuFooter } from './menu-footer'

export interface SubscriptionItem {
    label: string
    value: string
    hint?: string
}

export const SUBSCRIPTION_MENU_ITEMS: SubscriptionItem[] = [
    {
        label: 'Anthropic (Claude)',
        value: 'claude',
    },
    {
        label: 'GitHub (Copilot)',
        value: 'copilot',
    },
    {
        label: 'Google (Antigravity)',
        value: 'gemini',
    },
    {
        label: 'OpenAI (ChatGPT)',
        value: 'codex',
    },
]

export interface SubscriptionSelectMenuProps {
    handleProviderSelect?: (item: { label: string; value: string; forceLogin?: boolean }) => void
    handleSubscriptionSelect?: (item: {
        label: string
        value: string
        forceLogin?: boolean
    }) => void
    setAuthMode?: (mode: string) => void
    detectedSubscriptions?: Record<string, any> | string[]
    configuredSubscriptions?: Record<string, any>
    unlinkedSubscriptions?: string[]
    items?: SubscriptionItem[]
}

export function SubscriptionSelectMenu(props: SubscriptionSelectMenuProps) {
    const {
        handleProviderSelect,
        handleSubscriptionSelect,
        setAuthMode,
        items = SUBSCRIPTION_MENU_ITEMS,
    } = props
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmSubItem, setConfirmSubItem] = useState<{
        item: SubscriptionItem
        account: string
    } | null>(null)

    const onSelect = handleSubscriptionSelect || handleProviderSelect

    const isSearchingRef = useRef(isSearching)
    isSearchingRef.current = isSearching

    const confirmSubItemRef = useRef(confirmSubItem)
    confirmSubItemRef.current = confirmSubItem

    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items
        const q = searchQuery.toLowerCase()
        return items.filter((item) => {
            const labelMatch = (item.label || '').toLowerCase().includes(q)
            const valueMatch = (item.value || '').toLowerCase().includes(q)
            const hintMatch = (item.hint || '').toLowerCase().includes(q)
            return labelMatch || valueMatch || hintMatch
        })
    }, [items, searchQuery])

    const filteredItemsRef = useRef(filteredItems)
    filteredItemsRef.current = filteredItems

    const selectedIndexRef = useRef(selectedIndex)
    selectedIndexRef.current = selectedIndex

    useInput((input, key) => {
        // Confirmation mode: Subscription account switch
        if (confirmSubItemRef.current) {
            if (input === 'y' || input === 'Y') {
                const target = confirmSubItemRef.current.item
                setConfirmSubItem(null)
                if (onSelectRef.current) {
                    onSelectRef.current({ ...target, forceLogin: true })
                }
                return
            }

            if (input === 'n' || input === 'N' || key.return) {
                const target = confirmSubItemRef.current.item
                setConfirmSubItem(null)
                if (onSelectRef.current) {
                    onSelectRef.current(target)
                }
                return
            }

            if (key.escape) {
                setConfirmSubItem(null)
                return
            }

            return
        }
        // 1. Search Mode
        if (isSearchingRef.current) {
            if (key.escape) {
                setIsSearching(false)
                return
            }
            if (key.downArrow || key.return) {
                setIsSearching(false)
                return
            }
            return
        }

        // 2. Normal / Navigation Mode
        if (input === '/' || input === 's') {
            setIsSearching(true)
            return
        }

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            const count = isWheelUp
                ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                : 1
            if (selectedIndex > 0) {
                setSelectedIndex(Math.max(0, selectedIndex - count))
            }
            return
        }

        if (key.downArrow || input === 'j' || isWheelDown) {
            const count = isWheelDown
                ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                : 1
            if (selectedIndex < filteredItems.length - 1) {
                setSelectedIndex(Math.min(filteredItems.length - 1, selectedIndex + count))
            }
            return
        }

        // Ignore unhandled mouse sequences
        if (
            input.includes('[<') ||
            input.includes('\x1b[<') ||
            input.includes('[M') ||
            input.includes('\x1b[M')
        ) {
            return
        }

        if (key.return) {
            const item = filteredItemsRef.current[selectedIndexRef.current]
            if (item) {
                const account = getSubscriptionAccount(
                    item.value,
                    props.detectedSubscriptions,
                    props.configuredSubscriptions,
                    props.unlinkedSubscriptions
                )
                if (account) {
                    setConfirmSubItem({ item, account })
                    return
                }
                if (onSelectRef.current) {
                    onSelectRef.current(item)
                }
            }
            return
        }

        if (key.escape) {
            if (searchQuery) {
                setSearchQuery('')
                setSelectedIndex(0)
                return
            }
            if (setAuthMode) {
                setAuthMode('menu')
            }
            return
        }
    })

    const footerItems = isSearching
        ? [
              { key: 'enter / ↓', label: 'focus list' },
              { key: 'esc', label: 'exit search' },
          ]
        : [
              { key: '↑/↓', label: 'navigate' },
              { key: 'enter', label: 'connect' },
              { key: '/', label: 'search' },
              { key: 'esc', label: 'close' },
          ]

    if (confirmSubItem) {
        return (
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text color={THEME.colors.text}>
                        Existing credentials detected for{' '}
                        <Text bold color={THEME.colors.brand}>
                            {confirmSubItem.item.label}
                        </Text>
                        {confirmSubItem.account && confirmSubItem.account !== 'local session' ? (
                            <Text> ({confirmSubItem.account})</Text>
                        ) : null}
                        .
                    </Text>
                </Box>
                <Box marginBottom={1}>
                    <Text color={THEME.colors.warning}>
                        Do you want to switch to a different account? (y/n)
                    </Text>
                </Box>
                <MenuFooter
                    items={[
                        { key: 'y', label: 'switch account' },
                        { key: 'n / enter', label: 'keep current' },
                        { key: 'esc', label: 'cancel' },
                    ]}
                />
            </Box>
        )
    }

    return (
        <Box flexDirection="column">
            <Box marginBottom={1} flexDirection="column" gap={1}>
                <Text bold color={THEME.colors.text}>
                    Subscriptions
                </Text>
                <Box flexDirection="row" gap={1}>
                    <Text color={isSearching ? THEME.colors.brand : THEME.colors.muted}>
                        Search:
                    </Text>
                    {isSearching ? (
                        <TextInput
                            value={searchQuery}
                            onChange={(val) => {
                                setSearchQuery(val)
                                setSelectedIndex(0)
                            }}
                            onSubmit={() => setIsSearching(false)}
                            placeholder="Filter providers..."
                            focus={true}
                        />
                    ) : (
                        <Text color={searchQuery ? THEME.colors.text : THEME.colors.muted}>
                            {searchQuery ? (
                                <Text>
                                    {searchQuery}{' '}
                                    <Text color={THEME.colors.muted}>[/ to filter]</Text>
                                </Text>
                            ) : (
                                '[/ to filter]'
                            )}
                        </Text>
                    )}
                </Box>
            </Box>

            {/* List container with minHeight to prevent layout shifts during search filtering */}
            <Box flexDirection="column" minHeight={4}>
                {filteredItems.map((item, idx) => {
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
                            {item.hint && (
                                <Box marginLeft={1}>
                                    <Text color={THEME.colors.muted}>({item.hint})</Text>
                                </Box>
                            )}
                        </Box>
                    )
                })}

                {filteredItems.length === 0 && (
                    <Box paddingLeft={2}>
                        <Text color={THEME.colors.muted}>No providers found.</Text>
                    </Box>
                )}
            </Box>

            <MenuFooter items={footerItems} />
        </Box>
    )
}
