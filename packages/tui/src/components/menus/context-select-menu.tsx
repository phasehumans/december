import { getModelContextWindow } from '@december/providers'
import { decomposeContext } from '@december/shared'
import { Box, Text, useInput } from 'ink'
import React from 'react'

import { useTerminalColumns } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

function getModelLabel(id: string) {
    return id
}

export interface ContextSelectMenuProps {
    agent?: any
    setAuthMode?: (mode: string) => void
    handleSubmit?: (text: string) => void
    onClose?: () => void
    onClear?: () => void
    onModelSelect?: () => void
    onNewSession?: () => void
}

export function ContextSelectMenu(props: ContextSelectMenuProps) {
    const { agent, setAuthMode, handleSubmit, onClose, onClear, onModelSelect, onNewSession } =
        props
    const columns = useTerminalColumns()
    const isNarrow = columns > 0 && columns < 88

    useInput((input, key) => {
        if (key.escape || input === '\u001B') {
            if (onClose) {
                onClose()
            } else if (setAuthMode) {
                setAuthMode('none')
            }
            return
        }

        if (input === 'c' || input === 'C') {
            if (onClear) {
                onClear()
            } else {
                if (setAuthMode) setAuthMode('none')
                if (handleSubmit) {
                    handleSubmit('/clear')
                } else if (agent?.clearContext) {
                    agent.clearContext()
                }
            }
            return
        }

        if (input === 'm' || input === 'M') {
            if (onModelSelect) {
                onModelSelect()
            } else if (handleSubmit) {
                handleSubmit('/model')
            } else if (setAuthMode) {
                setAuthMode('model_select')
            }
            return
        }

        if (input === 'n' || input === 'N') {
            if (onNewSession) {
                onNewSession()
            } else {
                if (setAuthMode) setAuthMode('none')
                if (handleSubmit) {
                    handleSubmit('/new')
                } else if (agent?.newContext) {
                    agent.newContext()
                }
            }
            return
        }
    })

    const activeModelId = agent?.modelOptions?.model || 'gemini-3.7-flash'
    const currentModelName = getModelLabel(activeModelId)
    const maxTokens = getModelContextWindow(activeModelId) || 1000000

    const decomp = decomposeContext({
        agent,
        model: activeModelId,
        maxTokens,
    })

    const basePromptTokens = decomp.basePrompt.tokens
    const rulesTokens = decomp.rules.tokens
    const skillsTokens = decomp.skills.tokens
    const toolsTokens = decomp.tools.tokens
    const conversationHistoryTokens = decomp.conversationHistory.totalTokens
    const totalTokens = decomp.totalTokens
    const freeTokens = decomp.freeTokens

    const pct = (n: number) => ((n / maxTokens) * 100).toFixed(1)
    const formatK = (n: number) => (n > 1000 ? (n / 1000).toFixed(1) + 'k' : n.toString())

    const barWidth = Math.min(48, Math.max(20, (columns > 0 ? columns : 80) - 10))
    const totalFilled =
        totalTokens > 0
            ? Math.max(1, Math.min(barWidth, Math.round((totalTokens / maxTokens) * barWidth)))
            : 0

    const categories = [
        { name: 'base', tokens: basePromptTokens, color: THEME.colors.muted },
        { name: 'rules', tokens: rulesTokens, color: THEME.colors.warning },
        { name: 'skills', tokens: skillsTokens, color: THEME.colors.error },
        { name: 'tools', tokens: toolsTokens, color: THEME.colors.brand },
        { name: 'history', tokens: conversationHistoryTokens, color: THEME.colors.success },
    ]

    let allocated = 0
    const catBlocks = categories.map((cat, idx) => {
        if (cat.tokens <= 0 || totalTokens <= 0) return 0
        if (idx === categories.length - 1) {
            return Math.max(0, totalFilled - allocated)
        }
        const count = Math.min(
            totalFilled - allocated,
            Math.round((cat.tokens / totalTokens) * totalFilled)
        )
        allocated += count
        return count
    })

    if (allocated < totalFilled) {
        let maxIdx = 0
        let maxVal = -1
        categories.forEach((cat, idx) => {
            if (cat.tokens > maxVal) {
                maxVal = cat.tokens
                maxIdx = idx
            }
        })
        catBlocks[maxIdx] += totalFilled - allocated
    }

    const barElements = []
    categories.forEach((cat, idx) => {
        const count = catBlocks[idx]
        if (count > 0) {
            barElements.push(
                <Text key={cat.name} color={cat.color}>
                    {'█'.repeat(count)}
                </Text>
            )
        }
    })

    const freeBlocks = Math.max(0, barWidth - totalFilled)
    if (freeBlocks > 0) {
        barElements.push(
            <Text key="free" color={THEME.colors.border}>
                {'░'.repeat(freeBlocks)}
            </Text>
        )
    }

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text bold color={THEME.colors.text}>
                    Context
                </Text>
                <Text color={THEME.colors.muted}>·</Text>
                <Text color={THEME.colors.brand}>{currentModelName}</Text>
                <Text color={THEME.colors.muted}>·</Text>
                <Text color={THEME.colors.muted}>
                    {formatK(totalTokens)}/{formatK(maxTokens)} tokens ({pct(totalTokens)}%)
                </Text>
            </Box>

            <Box marginTop={1}>{barElements}</Box>

            <Box flexDirection={isNarrow ? 'column' : 'row'} gap={isNarrow ? 1 : 3} marginTop={1}>
                <Box flexDirection="column">
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>■</Text>
                        <Text color={THEME.colors.muted}>
                            Base System Prompt: {formatK(basePromptTokens)} tokens (
                            {pct(basePromptTokens)}%)
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.warning}>■</Text>
                        <Text color={THEME.colors.muted}>
                            Project Rules: {formatK(rulesTokens)} tokens ({pct(rulesTokens)}%)
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.error}>■</Text>
                        <Text color={THEME.colors.muted}>
                            Workspace Skills: {formatK(skillsTokens)} tokens ({pct(skillsTokens)}%)
                        </Text>
                    </Box>
                </Box>

                <Box flexDirection="column">
                    <Box gap={1}>
                        <Text color={THEME.colors.brand}>■</Text>
                        <Text color={THEME.colors.muted}>
                            Tool Schemas: {formatK(toolsTokens)} tokens ({pct(toolsTokens)}%)
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.success}>■</Text>
                        <Text color={THEME.colors.muted}>
                            Conversation History: {formatK(conversationHistoryTokens)} tokens (
                            {pct(conversationHistoryTokens)}%)
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.border}>□</Text>
                        <Text color={THEME.colors.muted}>
                            Free space: {formatK(freeTokens)} ({pct(freeTokens)}%)
                        </Text>
                    </Box>
                </Box>
            </Box>

            <MenuFooter
                items={[
                    { key: 'esc', label: 'Cancel' },
                    { key: 'c', label: 'Clear history' },
                    { key: 'm', label: 'Model' },
                    { key: 'n', label: 'New session' },
                ]}
            />
        </Box>
    )
}
