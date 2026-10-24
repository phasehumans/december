import { Box, Text, useInput } from 'ink'
import React, { useState, useMemo, useRef } from 'react'

import { THEME } from '../../theme'
import TextInput from '../text-input'

import { MenuFooter } from './menu-footer'

const WINDOW_SIZE = 7

export const PROVIDER_MENU_ITEMS = [
    { label: 'Abacus', value: 'abacus' },
    { label: 'Abliteration AI', value: 'abliteration' },
    { label: 'above.dev', value: 'above' },
    { label: 'AgentRouter', value: 'agentrouter' },
    { label: 'Agnes AI', value: 'agnes' },
    { label: 'AI&', value: 'aiand' },
    { label: 'AI21 Labs', value: 'ai21' },
    { label: 'AKI.IO', value: 'aki' },
    { label: 'Ambient', value: 'ambient' },
    { label: 'AMD', value: 'amd' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'AnyAPI', value: 'anyapi' },
    { label: 'Arcee AI', value: 'arcee' },
    { label: 'Auriko', value: 'auriko' },
    { label: 'Baseten', value: 'baseten' },
    { label: 'Berget.AI', value: 'berget' },
    { label: 'Blue Claw', value: 'blueclaw' },
    { label: 'Cerebras', value: 'cerebras' },
    { label: 'Charm Hyper', value: 'hyper' },
    { label: 'Chutes', value: 'chutes' },
    { label: 'Clarifai', value: 'clarifai' },
    { label: 'CloudFerro Sherlock', value: 'cloudferro-sherlock' },
    { label: 'Cloudflare AI Gateway', value: 'cloudflare-ai-gateway' },
    { label: 'Cohere', value: 'cohere' },
    { label: 'CoralBricks', value: 'coralbricks' },
    { label: 'Cortecs', value: 'cortecs' },
    { label: 'Crusoe', value: 'crusoe' },
    { label: 'D.Run (China)', value: 'drun' },
    { label: 'Deep Infra', value: 'deepinfra' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'DevPass (LLM Gateway)', value: 'llmgateway' },
    { label: 'DigitalOcean', value: 'digitalocean' },
    { label: 'DInference', value: 'dinference' },
    { label: 'Eden AI', value: 'edenai' },
    { label: 'EmpirioLabs AI', value: 'empiriolabs' },
    { label: 'evroc', value: 'evroc' },
    { label: 'FastRouter', value: 'fastrouter' },
    { label: 'Fireworks AI', value: 'fireworks' },
    { label: 'Friendli', value: 'friendli' },
    { label: 'Google AI Studio', value: 'google' },
    { label: 'Groq', value: 'groq' },
    { label: 'Helicone', value: 'helicone' },
    { label: 'Hetzner', value: 'hetzner' },
    { label: 'HPC-AI', value: 'hpc-ai' },
    { label: 'Hugging Face', value: 'huggingface' },
    { label: 'Hyperbolic', value: 'hyperbolic' },
    { label: 'Inception', value: 'inception' },
    { label: 'Inco', value: 'inco' },
    { label: 'IO.NET', value: 'io-net' },
    { label: 'IteraCompute', value: 'iteracompute' },
    { label: 'Kilo Gateway', value: 'kilo' },
    { label: 'Kimi', value: 'kimi' },
    { label: 'Kimi For Coding (kimi.ai)', value: 'kimi-code-plan-global' },
    { label: 'Kimi For Coding (kimi.com)', value: 'kimi-code-plan-cn' },
    { label: 'Kosmik Compute', value: 'kosmik' },
    { label: 'Merge Gateway', value: 'merge-gateway' },
    { label: 'Meta', value: 'meta' },
    { label: 'MiniMax', value: 'minimax' },
    { label: 'Mistral AI', value: 'mistral' },
    { label: 'Modal', value: 'modal' },
    { label: 'ModelScope', value: 'modelscope' },
    { label: 'Moonshot AI', value: 'moonshot' },
    { label: 'Morph', value: 'morph' },
    { label: 'NanoGPT', value: 'nano-gpt' },
    { label: 'NEAR AI Cloud', value: 'nearai' },
    { label: 'Nebius Token Factory', value: 'nebius' },
    { label: 'NovitaAI', value: 'novita-ai' },
    { label: 'NVIDIA NIM', value: 'nvidia' },
    { label: 'OpenAI', value: 'openai' },
    { label: 'OpenCode Go', value: 'opencode-go' },
    { label: 'OpenCode Zen', value: 'opencode' },
    { label: 'OpenReason', value: 'openreason' },
    { label: 'OpenRouter', value: 'openrouter' },
    { label: 'Opper', value: 'opper' },
    { label: 'OrcaRouter', value: 'orcarouter' },
    { label: 'OVHcloud AI Endpoints', value: 'ovhcloud' },
    { label: 'Pendra', value: 'pendra' },
    { label: 'Perplexity Agent', value: 'perplexity-agent' },
    { label: 'Perplexity AI', value: 'perplexity' },
    { label: 'Poe', value: 'poe' },
    { label: 'Qiniu', value: 'qiniu-ai' },
    { label: 'Qwen (DashScope)', value: 'dashscope' },
    { label: 'Regolo AI', value: 'regolo-ai' },
    { label: 'Requesty', value: 'requesty' },
    { label: 'RunInfra', value: 'runinfra' },
    { label: 'Sakana AI', value: 'sakana' },
    { label: 'SaladCloud AI Gateway', value: 'salad-cloud' },
    { label: 'SambaNova Cloud', value: 'sambanova' },
    { label: 'Sarvam AI', value: 'sarvam' },
    { label: 'Scaleway', value: 'scaleway' },
    { label: 'SiliconFlow', value: 'siliconflow' },
    { label: 'STACKIT', value: 'stackit' },
    { label: 'Standard Compute', value: 'standardcompute' },
    { label: 'StepFun (Global)', value: 'stepfun' },
    { label: 'Subconscious', value: 'subconscious' },
    { label: 'Synthetic', value: 'synthetic' },
    { label: 'Tencent TokenHub', value: 'tencent-tokenhub' },
    { label: 'The Grid AI', value: 'the-grid-ai' },
    { label: 'Thinking Machines (Tinker)', value: 'thinkingmachines' },
    { label: 'Tinfoil', value: 'tinfoil' },
    { label: 'Together AI', value: 'together' },
    { label: 'Upstage Solar', value: 'upstage' },
    { label: 'Venice AI', value: 'venice' },
    { label: 'Vercel AI Gateway', value: 'vercel' },
    { label: 'Vivgrid', value: 'vivgrid' },
    { label: 'Volcengine Ark', value: 'volcengine' },
    { label: 'Vultr', value: 'vultr' },
    { label: 'Wafer', value: 'wafer.ai' },
    { label: 'watsonx.ai', value: 'watsonx' },
    { label: 'xAI', value: 'xai' },
    { label: 'Xiaomi', value: 'xiaomi' },
    { label: 'ZAI', value: 'zai' },
]

export interface ProviderMenuItem {
    label: string
    value: string
    isSubscription?: boolean
    section?: 'subscription' | 'popular' | 'all'
}

export const POPULAR_PROVIDER_VALUES = [
    'anthropic',
    'openai',
    'google',
    'openrouter',
    'deepseek',
    'groq',
    'mistral',
    'xai',
    'perplexity',
    'cohere',
    'together',
    'fireworks',
    'cerebras',
    'sambanova',
]

export const SUBSCRIPTION_PROVIDER_ITEMS: ProviderMenuItem[] = [
    { label: 'Anthropic (Claude)', value: 'claude', isSubscription: true, section: 'subscription' },
    { label: 'GitHub (Copilot)', value: 'copilot', isSubscription: true, section: 'subscription' },
    {
        label: 'Google (Antigravity)',
        value: 'gemini',
        isSubscription: true,
        section: 'subscription',
    },
    { label: 'OpenAI (ChatGPT)', value: 'codex', isSubscription: true, section: 'subscription' },
]

export const POPULAR_BYOK_ITEMS: ProviderMenuItem[] = POPULAR_PROVIDER_VALUES.map((val) => {
    const found = PROVIDER_MENU_ITEMS.find((item) => item.value === val)
    return found ? { ...found, section: 'popular' as const } : null
}).filter(Boolean) as ProviderMenuItem[]

export const REMAINING_BYOK_ITEMS: ProviderMenuItem[] = PROVIDER_MENU_ITEMS.filter(
    (item) => !POPULAR_PROVIDER_VALUES.includes(item.value)
).map((item) => ({ ...item, section: 'all' as const }))

export const UNIFIED_PROVIDER_MENU_ITEMS: ProviderMenuItem[] = [
    ...SUBSCRIPTION_PROVIDER_ITEMS,
    ...POPULAR_BYOK_ITEMS,
    ...REMAINING_BYOK_ITEMS,
]

export function getSubscriptionAccount(
    provider: string,
    detectedSubscriptions?: Record<string, any> | string[],
    configuredSubscriptions?: Record<string, any>,
    unlinkedSubscriptions?: string[]
): string | null {
    const norm = (provider || '').toLowerCase().trim()
    const targetKeys = [norm]
    if (norm === 'claude' || norm === 'anthropic') targetKeys.push('claude', 'anthropic')
    if (norm === 'codex' || norm === 'openai' || norm === 'chatgpt')
        targetKeys.push('codex', 'openai', 'chatgpt')
    if (norm === 'gemini' || norm === 'google' || norm === 'antigravity')
        targetKeys.push('gemini', 'google', 'antigravity')
    if (norm === 'copilot' || norm === 'github') targetKeys.push('copilot', 'github')

    if (unlinkedSubscriptions?.some((u) => targetKeys.includes(u.toLowerCase()))) {
        return null
    }

    const detectedMap = Array.isArray(detectedSubscriptions)
        ? Object.fromEntries(detectedSubscriptions.map((k) => [k, { provider: k }]))
        : detectedSubscriptions

    for (const key of targetKeys) {
        const conf = configuredSubscriptions?.[key]
        if (conf?.email || conf?.accountName) return conf.email || conf.accountName
        const det = detectedMap?.[key]
        if (det?.email || det?.accountName) return det.email || det.accountName
        if (det?.accessToken || conf?.accessToken || det || conf) return 'local session'
    }
    return null
}

export function hasConfiguredApiKey(
    provider: string,
    configuredProviders?: Record<string, string>
): boolean {
    if (!configuredProviders) return false
    const norm = (provider || '').toLowerCase().trim()
    if (configuredProviders[norm]) return true
    if (norm === 'google' && configuredProviders['gemini']) return true
    if (norm === 'gemini' && configuredProviders['google']) return true
    if (norm === 'claude' && configuredProviders['anthropic']) return true
    if (norm === 'chatgpt' && configuredProviders['openai']) return true
    return false
}

export interface ByokProviderMenuProps {
    handleProviderSelect?: (item: ProviderMenuItem & { forceNewKey?: boolean }) => void
    handleByokSelect?: (item: ProviderMenuItem & { forceNewKey?: boolean }) => void
    handleSubscriptionSelect?: (item: ProviderMenuItem & { forceLogin?: boolean }) => void
    setAuthMode?: (mode: string) => void
    items?: ProviderMenuItem[]
    title?: string
    detectedSubscriptions?: Record<string, any> | string[]
    configuredProviders?: Record<string, string>
    configuredSubscriptions?: Record<string, any>
    unlinkedSubscriptions?: string[]
}

export function ByokProviderMenu(props: ByokProviderMenuProps) {
    const {
        handleProviderSelect,
        handleByokSelect,
        handleSubscriptionSelect,
        setAuthMode,
        items = UNIFIED_PROVIDER_MENU_ITEMS,
    } = props
    const menuTitle = props.title || 'Providers'
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [windowStart, setWindowStart] = useState(0)
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmSubItem, setConfirmSubItem] = useState<{
        item: ProviderMenuItem
        account: string
    } | null>(null)
    const [confirmByKeyItem, setConfirmByKeyItem] = useState<ProviderMenuItem | null>(null)

    const onSelect = handleByokSelect || handleProviderSelect

    const isSearchingRef = useRef(isSearching)
    isSearchingRef.current = isSearching

    const confirmSubItemRef = useRef(confirmSubItem)
    confirmSubItemRef.current = confirmSubItem

    const confirmByKeyItemRef = useRef(confirmByKeyItem)
    confirmByKeyItemRef.current = confirmByKeyItem

    const handleSubscriptionSelectRef = useRef(handleSubscriptionSelect)
    handleSubscriptionSelectRef.current = handleSubscriptionSelect

    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return items
        const q = searchQuery.toLowerCase()
        return items.filter((item) => {
            const labelMatch = (item.label || '').toLowerCase().includes(q)
            const valueMatch = (item.value || '').toLowerCase().includes(q)
            return labelMatch || valueMatch
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
                if (handleSubscriptionSelectRef.current) {
                    handleSubscriptionSelectRef.current({ ...target, forceLogin: true })
                }
                return
            }

            if (input === 'n' || input === 'N' || key.return) {
                const target = confirmSubItemRef.current.item
                setConfirmSubItem(null)
                if (handleSubscriptionSelectRef.current) {
                    handleSubscriptionSelectRef.current(target)
                }
                return
            }

            if (key.escape) {
                setConfirmSubItem(null)
                return
            }

            return
        }

        // Confirmation mode: BYOK key replacement
        if (confirmByKeyItemRef.current) {
            if (input === 'y' || input === 'Y') {
                const target = confirmByKeyItemRef.current
                setConfirmByKeyItem(null)
                if (onSelectRef.current) {
                    onSelectRef.current({ ...target, forceNewKey: true })
                }
                return
            }

            if (input === 'n' || input === 'N' || key.return) {
                const target = confirmByKeyItemRef.current
                setConfirmByKeyItem(null)
                if (onSelectRef.current) {
                    onSelectRef.current(target)
                }
                return
            }

            if (key.escape) {
                setConfirmByKeyItem(null)
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
            if (selectedIndexRef.current > 0) {
                const next = Math.max(0, selectedIndexRef.current - count)
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
            if (selectedIndexRef.current < filteredItemsRef.current.length - 1) {
                const next = Math.min(
                    filteredItemsRef.current.length - 1,
                    selectedIndexRef.current + count
                )
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
            const item = filteredItemsRef.current[selectedIndexRef.current]
            if (item) {
                if (item.isSubscription && handleSubscriptionSelectRef.current) {
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
                    handleSubscriptionSelectRef.current(item)
                    return
                }
                if (onSelectRef.current) {
                    const hasKey = hasConfiguredApiKey(item.value, props.configuredProviders)
                    if (hasKey) {
                        setConfirmByKeyItem(item)
                        return
                    }
                    onSelectRef.current(item)
                }
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

    const hasInlineHeader = visibleItems.some((item, relIdx) => {
        const absIdx = windowStart + relIdx
        const prevItem = absIdx > 0 ? filteredItems[absIdx - 1] : null
        return Boolean(item.section && (!prevItem || prevItem.section !== item.section))
    })

    const topSection = visibleItems[0]?.section
    let stickyHeader: string | null = null
    if (!hasInlineHeader && topSection) {
        if (topSection === 'subscription') {
            stickyHeader = `${THEME.glyphs.bullet} Subscriptions`
        } else if (topSection === 'popular') {
            stickyHeader = `${THEME.glyphs.bullet} Popular`
        } else if (topSection === 'all') {
            stickyHeader = `${THEME.glyphs.bullet} All Providers`
        }
    }

    const footerItems = isSearching
        ? [
              { key: 'enter / ↓', label: 'focus list' },
              { key: 'esc', label: 'exit search' },
          ]
        : [
              { key: '↑/↓', label: 'navigate' },
              { key: 'enter', label: 'select' },
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

    if (confirmByKeyItem) {
        return (
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text color={THEME.colors.text}>
                        An API key for{' '}
                        <Text bold color={THEME.colors.brand}>
                            {confirmByKeyItem.label}
                        </Text>{' '}
                        is already configured.
                    </Text>
                </Box>
                <Box marginBottom={1}>
                    <Text color={THEME.colors.warning}>
                        Do you want to replace it with a new key? (y/n)
                    </Text>
                </Box>
                <MenuFooter
                    items={[
                        { key: 'y', label: 'enter new key' },
                        { key: 'n / enter', label: 'use existing key' },
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
                    {menuTitle}
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

            {/* List container with minHeight to prevent layout shift during navigation and search */}
            <Box flexDirection="column" minHeight={10}>
                {/* Sticky section header when scrolled into a section */}
                {stickyHeader && (
                    <Box paddingLeft={2} marginY={0}>
                        <Text color={THEME.colors.subtle}>{stickyHeader}</Text>
                    </Box>
                )}

                {/* visible items */}
                {visibleItems.map((item, relIdx) => {
                    const absIdx = windowStart + relIdx
                    const isSelected = absIdx === selectedIndex
                    const prevItem = absIdx > 0 ? filteredItems[absIdx - 1] : null
                    const isFirstInSection =
                        item.section && (!prevItem || prevItem.section !== item.section)

                    let sectionHeader: string | null = null
                    if (isFirstInSection) {
                        if (item.section === 'subscription') {
                            sectionHeader = `${THEME.glyphs.bullet} Subscriptions`
                        } else if (item.section === 'popular') {
                            sectionHeader = `${THEME.glyphs.bullet} Popular`
                        } else if (item.section === 'all') {
                            sectionHeader = `${THEME.glyphs.bullet} All Providers`
                        }
                    }

                    return (
                        <React.Fragment key={`${item.value}-${absIdx}`}>
                            {sectionHeader && (
                                <Box paddingLeft={2} marginY={0}>
                                    <Text color={THEME.colors.subtle}>{sectionHeader}</Text>
                                </Box>
                            )}
                            <Box paddingLeft={0}>
                                <Box marginRight={1}>
                                    <Text color={THEME.colors.brand}>
                                        {isSelected ? THEME.glyphs.selector : ' '}
                                    </Text>
                                </Box>
                                <Text color={isSelected ? THEME.colors.brand : THEME.colors.text}>
                                    {item.label}
                                </Text>
                            </Box>
                        </React.Fragment>
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
                        <Text color={THEME.colors.muted}>No providers found.</Text>
                    </Box>
                )}
            </Box>

            <MenuFooter items={footerItems} />
        </Box>
    )
}
