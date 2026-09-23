import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import React, { useState, useMemo, useRef } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

const WINDOW_SIZE = 7

export const PROVIDER_MENU_ITEMS = [
    { label: '302.AI', value: '302ai' },
    { label: 'Abacus', value: 'abacus' },
    { label: 'Abliteration AI', value: 'abliteration' },
    { label: 'above.dev', value: 'above' },
    { label: 'AgentRouter', value: 'agentrouter' },
    { label: 'Agnes AI', value: 'agnes' },
    { label: 'AI Router', value: 'airouter' },
    { label: 'AI&', value: 'aiand' },
    { label: 'AI21 Labs', value: 'ai21' },
    { label: 'AIHubMix', value: 'aihubmix' },
    { label: 'ainetcafe', value: 'ainetcafe' },
    { label: 'Aixy', value: 'aixy' },
    { label: 'AKI.IO', value: 'aki' },
    { label: 'Ambient', value: 'ambient' },
    { label: 'AMD', value: 'amd' },
    { label: 'Anthropic', value: 'anthropic' },
    { label: 'AnyAPI', value: 'anyapi' },
    { label: 'Arcee AI', value: 'arcee' },
    { label: 'Auriko', value: 'auriko' },
    { label: 'Bailing', value: 'bailing' },
    { label: 'Baseten', value: 'baseten' },
    { label: 'Berget.AI', value: 'berget' },
    { label: 'Blue Claw', value: 'blueclaw' },
    { label: 'Bothub', value: 'bothub' },
    { label: 'Cerebras', value: 'cerebras' },
    { label: 'Charm Hyper', value: 'hyper' },
    { label: 'Chutes', value: 'chutes' },
    { label: 'Clarifai', value: 'clarifai' },
    { label: 'Claudinio', value: 'claudinio' },
    { label: 'ClinePass', value: 'cline-pass' },
    { label: 'CloudFerro Sherlock', value: 'cloudferro-sherlock' },
    { label: 'Cloudflare AI Gateway', value: 'cloudflare-ai-gateway' },
    { label: 'Cohere', value: 'cohere' },
    { label: 'CoralBricks', value: 'coralbricks' },
    { label: 'CoreWeave', value: 'wandb' },
    { label: 'Cortecs', value: 'cortecs' },
    { label: 'CrofAI', value: 'crof' },
    { label: 'CrossModel', value: 'crossmodel' },
    { label: 'Crusoe', value: 'crusoe' },
    { label: 'D.Run (China)', value: 'drun' },
    { label: 'DaoXE', value: 'daoxe' },
    { label: 'Deep Infra', value: 'deepinfra' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'DevPass (LLM Gateway)', value: 'llmgateway' },
    { label: 'DigitalOcean', value: 'digitalocean' },
    { label: 'DInference', value: 'dinference' },
    { label: 'EBCloud', value: 'ebcloud' },
    { label: 'Echo', value: 'echo' },
    { label: 'Eden AI', value: 'edenai' },
    { label: 'EmpirioLabs AI', value: 'empiriolabs' },
    { label: 'evroc', value: 'evroc' },
    { label: 'FastRouter', value: 'fastrouter' },
    { label: 'Fireworks AI', value: 'fireworks' },
    { label: 'FreeModel', value: 'freemodel' },
    { label: 'Friendli', value: 'friendli' },
    { label: 'FrogBot', value: 'frogbot' },
    { label: 'GMI Cloud', value: 'gmicloud' },
    { label: 'Google AI Studio', value: 'google' },
    { label: 'GreenPT', value: 'greenpt' },
    { label: 'Groq', value: 'groq' },
    { label: 'Helicone', value: 'helicone' },
    { label: 'Hetzner', value: 'hetzner' },
    { label: 'HPC-AI', value: 'hpc-ai' },
    { label: 'Hugging Face', value: 'huggingface' },
    { label: 'Hyperbolic', value: 'hyperbolic' },
    { label: 'iFlow', value: 'iflowcn' },
    { label: 'Impossibl', value: 'impossibl' },
    { label: 'Inception', value: 'inception' },
    { label: 'Inceptron', value: 'inceptron' },
    { label: 'Inco', value: 'inco' },
    { label: 'Infer by Flow7', value: 'infer' },
    { label: 'Inference', value: 'inference' },
    { label: 'InferX', value: 'inferx' },
    { label: 'IO.NET', value: 'io-net' },
    { label: 'IteraCompute', value: 'iteracompute' },
    { label: 'Jalapeno Cloud', value: 'jalapeno' },
    { label: 'Jiekou.AI', value: 'jiekou' },
    { label: 'Kenari', value: 'kenari' },
    { label: 'Kilo Gateway', value: 'kilo' },
    { label: 'Kimi', value: 'kimi' },
    { label: 'Kimi For Coding (kimi.ai)', value: 'kimi-code-plan-global' },
    { label: 'Kimi For Coding (kimi.com)', value: 'kimi-code-plan-cn' },
    { label: 'klokintegration.se', value: 'klokintegration' },
    { label: 'Kosmik Compute', value: 'kosmik' },
    { label: 'Lilac', value: 'lilac' },
    { label: 'Llama', value: 'llama' },
    { label: 'llama.cpp', value: 'llamacpp' },
    { label: 'LLM Gateway', value: 'llmgateway-providers' },
    { label: 'LLM Tech', value: 'llmtech' },
    { label: 'LLMTR', value: 'llmtr' },
    { label: 'LM Studio', value: 'lmstudio' },
    { label: 'LongCat', value: 'longcat' },
    { label: 'LucidQuery', value: 'lucidquery' },
    { label: 'Meganova', value: 'meganova' },
    { label: 'Melious', value: 'melious' },
    { label: 'Merge Gateway', value: 'merge-gateway' },
    { label: 'Meta', value: 'meta' },
    { label: 'MiniMax', value: 'minimax' },
    { label: 'Mistral AI', value: 'mistral' },
    { label: 'Mixlayer', value: 'mixlayer' },
    { label: 'Moark', value: 'moark' },
    { label: 'Modal', value: 'modal' },
    { label: 'Model Oracle AI', value: 'model-oracle-ai' },
    { label: 'Modelis', value: 'modelis' },
    { label: 'ModelScope', value: 'modelscope' },
    { label: 'Moonshot AI', value: 'moonshot' },
    { label: 'Morph', value: 'morph' },
    { label: 'NaN', value: 'nan' },
    { label: 'NanoGPT', value: 'nano-gpt' },
    { label: 'NEAR AI Cloud', value: 'nearai' },
    { label: 'Nebius Token Factory', value: 'nebius' },
    { label: 'NeoSmith', value: 'neosmith' },
    { label: 'Neuralwatt', value: 'neuralwatt' },
    { label: 'Nova', value: 'nova' },
    { label: 'NovitaAI', value: 'novita-ai' },
    { label: 'NVIDIA NIM', value: 'nvidia' },
    { label: 'Ofox', value: 'ofox' },
    { label: 'Ollama', value: 'ollama' },
    { label: 'Ollama Cloud', value: 'ollama-cloud' },
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
    { label: 'Pioneer', value: 'pioneer' },
    { label: 'Poe', value: 'poe' },
    { label: 'Poolside', value: 'poolside' },
    { label: 'QiHang', value: 'qihang-ai' },
    { label: 'Qiniu', value: 'qiniu-ai' },
    { label: 'QVAC', value: 'qvac' },
    { label: 'Qwen (DashScope)', value: 'dashscope' },
    { label: 'Regolo AI', value: 'regolo-ai' },
    { label: 'Requesty', value: 'requesty' },
    { label: 'routing.run', value: 'routing-run' },
    { label: 'RunInfra', value: 'runinfra' },
    { label: 'Sakana AI', value: 'sakana' },
    { label: 'SaladCloud AI Gateway', value: 'salad-cloud' },
    { label: 'SambaNova Cloud', value: 'sambanova' },
    { label: 'Sarvam AI', value: 'sarvam' },
    { label: 'Scaleway', value: 'scaleway' },
    { label: 'SCX.ai', value: 'scx-ai' },
    { label: 'SenseNova (China)', value: 'sensenova' },
    { label: 'SiliconFlow', value: 'siliconflow' },
    { label: 'STACKIT', value: 'stackit' },
    { label: 'Standard Compute', value: 'standardcompute' },
    { label: 'StepFun (Global)', value: 'stepfun' },
    { label: 'Subconscious', value: 'subconscious' },
    { label: 'submodel', value: 'submodel' },
    { label: 'Synthetic', value: 'synthetic' },
    { label: 'Tempr', value: 'tempr' },
    { label: 'Tencent TokenHub', value: 'tencent-tokenhub' },
    { label: 'TensorX', value: 'tensorx' },
    { label: 'The Grid AI', value: 'the-grid-ai' },
    { label: 'Thinking Machines (Tinker)', value: 'thinkingmachines' },
    { label: 'Tinfoil', value: 'tinfoil' },
    { label: 'Together AI', value: 'together' },
    { label: 'TokenGo', value: 'tokengo' },
    { label: 'TokenRouter', value: 'tokenrouter' },
    { label: 'TrustedRouter', value: 'trustedrouter' },
    { label: 'Umans AI', value: 'umans-ai' },
    { label: 'UnoRouter', value: 'unorouter' },
    { label: 'Upstage Solar', value: 'upstage' },
    { label: 'v0', value: 'v0' },
    { label: 'Vancine', value: 'vancine' },
    { label: 'Venice AI', value: 'venice' },
    { label: 'Vercel AI Gateway', value: 'vercel' },
    { label: 'Vispark', value: 'vispark' },
    { label: 'Vivgrid', value: 'vivgrid' },
    { label: 'Volcengine Ark', value: 'volcengine' },
    { label: 'Vultr', value: 'vultr' },
    { label: 'Wafer', value: 'wafer.ai' },
    { label: 'Wallaby', value: 'wallaby' },
    { label: 'watsonx.ai', value: 'watsonx' },
    { label: 'xAI', value: 'xai' },
    { label: 'Xiaomi', value: 'xiaomi' },
    { label: 'Xpersona', value: 'xpersona' },
    { label: 'ZAI', value: 'zai' },
    { label: 'Zeldoc', value: 'zeldoc' },
    { label: 'Zenifra', value: 'zenifra' },
    { label: 'ZenMux', value: 'zenmux' },
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
