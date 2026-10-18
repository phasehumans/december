import { Box, Text, useInput } from 'ink'
import React, { useState, useMemo, useRef } from 'react'

import { THEME } from '../../theme'
import TextInput from '../text-input'

import { MenuFooter } from './menu-footer'

const WINDOW_SIZE = 7

export interface ModelSelectMenuProps {
    handleModelSelect: (item: { label: string; value: string }) => void
    setAuthMode?: (mode: string) => void
    previousAuthMode?: string
    selectedProvider: string
    openRouterModels?: { label: string; value: string }[]
    ollamaModels?: { label: string; value: string }[]
    getProviderModels?: (provider: string) => { label: string; value: string }[]
    items?: { label: string; value: string }[]
}

export function ModelSelectMenu(props: ModelSelectMenuProps) {
    const {
        handleModelSelect,
        setAuthMode,
        previousAuthMode,
        selectedProvider,
        openRouterModels,
        ollamaModels,
        getProviderModels,
        items: customItems,
    } = props

    const items = useMemo(() => {
        if (customItems && customItems.length > 0) {
            return customItems
        }
        if (selectedProvider === 'openrouter') {
            if (openRouterModels && openRouterModels.length > 0) {
                return openRouterModels
            }
            return typeof getProviderModels === 'function'
                ? getProviderModels('openrouter')
                : [{ label: 'Loading models...', value: 'loading' }]
        }
        if (selectedProvider === 'ollama') {
            if (ollamaModels && ollamaModels.length > 0) {
                return ollamaModels
            }
            return typeof getProviderModels === 'function'
                ? getProviderModels('ollama')
                : [{ label: 'Loading models...', value: 'loading' }]
        }
        return typeof getProviderModels === 'function' ? getProviderModels(selectedProvider) : []
    }, [customItems, selectedProvider, openRouterModels, ollamaModels, getProviderModels])

    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [windowStart, setWindowStart] = useState(0)

    const isSearchingRef = useRef(isSearching)
    isSearchingRef.current = isSearching

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items
        const q = searchQuery.toLowerCase()
        return items.filter((item) => {
            const labelMatch = (item.label || '').toLowerCase().includes(q)
            const valueMatch = (item.value || '').toLowerCase().includes(q)
            return labelMatch || valueMatch
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

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            const count = isWheelUp
                ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                : 1
            if (selectedIndex > 0) {
                const next = Math.max(0, selectedIndex - count)
                setSelectedIndex(next)
                if (next < windowStart) {
                    setWindowStart(next)
                }
            }
            return
        }

        if (key.downArrow || input === 'j' || isWheelDown) {
            const count = isWheelDown
                ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                : 1
            if (selectedIndex < filteredItems.length - 1) {
                const next = Math.min(filteredItems.length - 1, selectedIndex + count)
                setSelectedIndex(next)
                if (next >= windowStart + WINDOW_SIZE) {
                    setWindowStart(Math.max(0, next - WINDOW_SIZE + 1))
                }
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
            const item = filteredItems[selectedIndex]
            if (handleModelSelect && item && item.value !== 'loading') {
                handleModelSelect(item)
            }
            return
        }

        if (key.escape || input === '\u001B') {
            if (searchQuery) {
                setSearchQuery('')
                setSelectedIndex(0)
                setWindowStart(0)
                return
            }
            if (setAuthMode) {
                const backTarget =
                    previousAuthMode && previousAuthMode !== 'model_select'
                        ? previousAuthMode
                        : 'none'
                setAuthMode(backTarget)
            }
            return
        }
    })

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, filteredItems.length)
    const visibleItems = filteredItems.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = filteredItems.length - windowEnd
    const hasOverflow = filteredItems.length > WINDOW_SIZE

    let statusText = ''
    if (hasOverflow) {
        if (itemsAbove > 0 && itemsBelow > 0) {
            statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
        } else if (itemsAbove > 0) {
            statusText = `↑ ${itemsAbove} more`
        } else if (itemsBelow > 0) {
            statusText = `↓ ${itemsBelow} more`
        }
    }

    const footerItems = isSearching
        ? [
              { key: 'enter / ↓', label: 'Focus List' },
              { key: 'esc', label: 'Exit Search' },
          ]
        : [
              { key: '↑/↓', label: 'Navigate' },
              { key: 'enter', label: 'Select' },
              { key: '/', label: 'Search' },
              {
                  key: 'esc',
                  label: previousAuthMode && previousAuthMode !== 'none' ? 'Back' : 'Cancel',
              },
          ]

    return (
        <Box flexDirection="column">
            <Box marginBottom={1} flexDirection="column" gap={1}>
                <Text color={THEME.colors.text}>Select Model:</Text>
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
                                setWindowStart(0)
                            }}
                            onSubmit={() => setIsSearching(false)}
                            placeholder="Filter models..."
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

            {/* List container with minHeight to prevent layout shift during navigation and search */}
            <Box flexDirection="column" minHeight={9}>
                {/* visible items */}
                {visibleItems.map((item, relIdx) => {
                    const absIdx = windowStart + relIdx
                    const isSelected = absIdx === selectedIndex
                    return (
                        <Box key={`${item.value}-${absIdx}`} paddingLeft={0}>
                            <Box marginRight={1}>
                                <Text color={THEME.colors.brand}>
                                    {isSelected ? THEME.glyphs.selector : ' '}
                                </Text>
                            </Box>
                            <Text
                                color={isSelected ? THEME.colors.brand : THEME.colors.text}
                                bold={isSelected}
                            >
                                {item.label}
                            </Text>
                        </Box>
                    )
                })}

                {/* bottom status line for overflow pagination */}
                {hasOverflow && statusText && (
                    <Box paddingLeft={2}>
                        <Text color={THEME.colors.muted}>{statusText}</Text>
                    </Box>
                )}

                {filteredItems.length === 0 && (
                    <Box paddingLeft={2}>
                        <Text color={THEME.colors.muted}>No models found.</Text>
                    </Box>
                )}
            </Box>

            <MenuFooter items={footerItems} />
        </Box>
    )
}
