import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState, useMemo, useRef } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

const WINDOW_SIZE = 7

export const PROVIDER_MENU_ITEMS = [
    { label: 'AgentRouter', value: 'agentrouter' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'Arcee AI', value: 'arcee' },
    { label: 'Cerebras', value: 'cerebras' },
    { label: 'Cohere', value: 'cohere' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'Fireworks AI', value: 'fireworks' },
    { label: 'Google AI Studio', value: 'google' },
    { label: 'Groq', value: 'groq' },
    { label: 'Hugging Face', value: 'huggingface' },
    { label: 'Hyperbolic', value: 'hyperbolic' },
    { label: 'Kimi', value: 'kimi' },
    { label: 'LM Studio', value: 'lmstudio' },
    { label: 'llama.cpp', value: 'llamacpp' },
    { label: 'Meta', value: 'meta' },
    { label: 'MiniMax', value: 'minimax' },
    { label: 'Mistral AI', value: 'mistral' },
    { label: 'NVIDIA NIM', value: 'nvidia' },
    { label: 'Ollama', value: 'ollama' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'OpenRouter', value: 'openrouter' },
    { label: 'Perplexity AI', value: 'perplexity' },
    { label: 'Qwen (DashScope)', value: 'dashscope' },
    { label: 'SambaNova Cloud', value: 'sambanova' },
    { label: 'SiliconFlow', value: 'siliconflow' },
    { label: 'Together AI', value: 'together' },
    { label: 'xAI', value: 'xai' },
    { label: 'ZAI', value: 'zai' },
]

export interface ByokProviderMenuProps {
    handleProviderSelect?: (item: { label: string; value: string }) => void
    handleByokSelect?: (item: { label: string; value: string }) => void
    setAuthMode?: (mode: string) => void
    items?: { label: string; value: string }[]
}

export function ByokProviderMenu(props: ByokProviderMenuProps) {
    const {
        handleProviderSelect,
        handleByokSelect,
        setAuthMode,
        items = PROVIDER_MENU_ITEMS,
    } = props
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [windowStart, setWindowStart] = useState(0)
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    const onSelect = handleByokSelect || handleProviderSelect

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

        if (key.upArrow || input === 'k') {
            if (selectedIndex > 0) {
                const next = selectedIndex - 1
                setSelectedIndex(next)
                if (next < windowStart) {
                    setWindowStart(next)
                }
            }
            return
        }

        if (key.downArrow || input === 'j') {
            if (selectedIndex < filteredItems.length - 1) {
                const next = selectedIndex + 1
                setSelectedIndex(next)
                if (next >= windowStart + WINDOW_SIZE) {
                    setWindowStart(next - WINDOW_SIZE + 1)
                }
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
                setWindowStart(0)
                return
            }
            if (setAuthMode) {
                setAuthMode('menu')
            }
            return
        }
    })

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, filteredItems.length)
    const visibleItems = filteredItems.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = filteredItems.length - windowEnd

    const footerItems = isSearching
        ? [
              { key: 'enter / ↓', label: 'Focus List' },
              { key: 'esc', label: 'Exit Search' },
          ]
        : [
              { key: '↑/↓', label: 'Navigate' },
              { key: 'enter', label: 'Select' },
              { key: '/', label: 'Search' },
              { key: 'esc', label: 'Back' },
          ]

    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            <Box marginBottom={1} flexDirection="column" gap={1}>
                <Text color={THEME.colors.text}>Select API Provider (BYOK):</Text>
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

            {/* ↑ n more */}
            {itemsAbove > 0 && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>↑ {itemsAbove} more</Text>
                </Box>
            )}

            {/* visible items */}
            {visibleItems.map((item, relIdx) => {
                const absIdx = windowStart + relIdx
                const isSelected = absIdx === selectedIndex
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

            {/* ↓ n more */}
            {itemsBelow > 0 && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>↓ {itemsBelow} more</Text>
                </Box>
            )}

            {filteredItems.length === 0 && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>No providers found.</Text>
                </Box>
            )}

            <MenuFooter items={footerItems} />
        </Box>
    )
}
