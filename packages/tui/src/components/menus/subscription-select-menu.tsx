import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState, useMemo, useRef } from 'react'

import { THEME } from '../../theme'

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
        label: 'Google (Gemini / Antigravity)',
        value: 'gemini',
    },
    {
        label: 'OpenAI (ChatGPT)',
        value: 'codex',
    },
]

export interface SubscriptionSelectMenuProps {
    handleProviderSelect?: (item: { label: string; value: string }) => void
    handleSubscriptionSelect?: (item: { label: string; value: string }) => void
    setAuthMode?: (mode: string) => void
    detectedSubscriptions?: Record<string, any> | string[]
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

    const onSelect = handleSubscriptionSelect || handleProviderSelect

    const isSearchingRef = useRef(isSearching)
    isSearchingRef.current = isSearching

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

    useInput((input, key) => {
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

        if (key.upArrow || input === 'k') {
            if (selectedIndex > 0) {
                setSelectedIndex(selectedIndex - 1)
            }
            return
        }

        if (key.downArrow || input === 'j') {
            if (selectedIndex < filteredItems.length - 1) {
                setSelectedIndex(selectedIndex + 1)
            }
            return
        }

        if (key.return) {
            if (onSelect && filteredItems[selectedIndex]) {
                onSelect(filteredItems[selectedIndex])
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
              { key: 'enter / ↓', label: 'Focus List' },
              { key: 'esc', label: 'Exit Search' },
          ]
        : [
              { key: '↑/↓', label: 'Navigate' },
              { key: 'enter', label: 'Connect' },
              { key: '/', label: 'Search' },
              { key: 'esc', label: 'Back' },
          ]

    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            <Box marginBottom={1} flexDirection="column" gap={1}>
                <Text color={THEME.colors.text}>Select AI Subscription Provider:</Text>
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
                    </Box>
                )
            })}

            {filteredItems.length === 0 && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>No providers found.</Text>
                </Box>
            )}

            <MenuFooter items={footerItems} />
        </Box>
    )
}
