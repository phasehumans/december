import {
    getCleanProviderDisplayName,
    PROVIDER_BILLING_LINKS,
    resolveModelRate,
} from '@december/shared'
import { Box, Text, useInput } from 'ink'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface DailyUsageItem {
    date: string
    dayName: string
    formattedDate: string
    tokens: number
    isToday: boolean
}

export interface UsageSelectMenuProps {
    agent?: any
    model?: string
    provider?: string
    providerDisplayName?: string
    billingUrl?: string
    balance?: {
        supported: boolean
        balance?: string
        currency?: string
        error?: string
    }
    sessionStats?: {
        requests: number
        inputTokens: number
        outputTokens: number
        cacheReadTokens?: number
        totalTokens: number
        cost?: number
    }
    weeklyStats?: {
        totalTokens: number
        activeDays: number
        topModels?: { model: string; percentage: number }[]
    }
    dailyUsage?: DailyUsageItem[]
    usageData?: any
    setAuthMode?: (mode: string) => void
    handleSubmit?: (text: string) => void
    onClose?: () => void
    onRefresh?: () => void
    onModelSelect?: () => void
    onOpenBilling?: (url?: string) => void
}

const SHADE_LEVELS = ['░', '▒', '▓', '█']

function formatK(n: number): string {
    if (n === 0) return '0'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
    return n.toString()
}

function formatCost(val: number): string {
    if (val === 0) return '$0.0000'
    if (val < 0.0001) return '< $0.0001'
    return `$${val.toFixed(4)}`
}

function calculateCost(
    model: string,
    inTokens: number,
    outTokens: number,
    cacheTokens = 0
): number {
    const rate = resolveModelRate(model)
    const promptCost = (inTokens / 1_000_000) * rate.inputRate
    const completionCost = (outTokens / 1_000_000) * rate.outputRate
    const cacheSavings = (cacheTokens / 1_000_000) * rate.inputRate * 0.9
    return Math.max(0, promptCost + completionCost - cacheSavings)
}

function generateDefaultDailyUsage(): DailyUsageItem[] {
    const now = new Date()
    const items: DailyUsageItem[] = []
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateKey = d.toISOString().slice(0, 10)
        const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
        const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        items.push({
            date: dateKey,
            dayName,
            formattedDate,
            tokens: 0,
            isToday: i === 0,
        })
    }
    return items
}

export function UsageSelectMenu(props: UsageSelectMenuProps) {
    const {
        agent,
        setAuthMode,
        handleSubmit,
        onClose,
        onRefresh,
        onModelSelect,
        onOpenBilling,
        usageData,
    } = props

    const activeModelId =
        usageData?.model || props.model || agent?.modelOptions?.model || 'gemini-3.7-flash'

    const providerKey = (
        usageData?.provider ||
        props.provider ||
        agent?.modelOptions?.provider ||
        'google'
    ).toLowerCase()

    const providerDisplayName =
        usageData?.providerDisplayName ||
        props.providerDisplayName ||
        getCleanProviderDisplayName(providerKey, activeModelId)

    const billingUrl =
        usageData?.billingUrl ||
        props.billingUrl ||
        PROVIDER_BILLING_LINKS[providerKey] ||
        'https://trydecember.com'

    useInput((input, key) => {
        if (key.escape || input === '\u001B') {
            if (onClose) {
                onClose()
            } else if (setAuthMode) {
                setAuthMode('none')
            }
            return
        }

        if (input === 'r' || input === 'R') {
            if (onRefresh) {
                onRefresh()
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

        if (input === 'b' || input === 'B') {
            if (onOpenBilling) {
                onOpenBilling(billingUrl)
            }
            return
        }
    })

    // 1. Session Stats
    const sessionStats =
        usageData?.sessionStats ||
        props.sessionStats ||
        (() => {
            const msgs = agent?.messages || []
            let inTokens = 0
            let outTokens = 0
            let cacheTokens = 0
            let reqs = 0
            for (const msg of msgs) {
                if (msg && msg.usage) {
                    inTokens += msg.usage.promptTokens || 0
                    outTokens += msg.usage.completionTokens || 0
                    cacheTokens += (msg.usage as any).cacheReadInputTokens || 0
                    reqs++
                }
            }
            return {
                requests: reqs,
                inputTokens: inTokens,
                outputTokens: outTokens,
                cacheReadTokens: cacheTokens,
                totalTokens: inTokens + outTokens,
            }
        })()

    const calculatedCost =
        sessionStats.cost ??
        calculateCost(
            activeModelId,
            sessionStats.inputTokens || 0,
            sessionStats.outputTokens || 0,
            sessionStats.cacheReadTokens || 0
        )

    // 2. Daily Usage (past 7 days)
    const dailyItems: DailyUsageItem[] =
        usageData?.dailyUsage || props.dailyUsage || generateDefaultDailyUsage()

    const maxDayTokens = Math.max(...dailyItems.map((d) => d.tokens), 1)

    const getSpark = (tokens: number) => {
        if (tokens <= 0) return '·'
        const index = Math.min(
            SHADE_LEVELS.length - 1,
            Math.floor((tokens / maxDayTokens) * SHADE_LEVELS.length)
        )
        return SHADE_LEVELS[index]
    }

    // 3. Weekly & Account Stats
    const balance = usageData?.balance || props.balance
    const balanceStr = balance?.supported
        ? balance.balance
            ? `${balance.balance} (Live)`
            : balance.error
              ? `Unavailable (${balance.error})`
              : 'Checking...'
        : 'Unavailable'

    const weekly = usageData?.weeklyStats ||
        props.weeklyStats || {
            totalTokens: dailyItems.reduce((acc, d) => acc + d.tokens, 0),
            activeDays: dailyItems.filter((d) => d.tokens > 0).length,
            topModels: [],
        }

    const topModelSummary =
        weekly.topModels && weekly.topModels.length > 0
            ? `${weekly.topModels[0].model} (${weekly.topModels[0].percentage}%)`
            : 'None'

    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            <Box marginBottom={1}>
                <Text color={THEME.colors.text}>
                    Usage · <Text color={THEME.colors.brand}>{activeModelId}</Text>{' '}
                    <Text color={THEME.colors.muted}>({providerDisplayName})</Text>
                </Text>
            </Box>

            <Box flexDirection="row" gap={4}>
                {/* Left Column: Daily Volume (Past 7 Days) */}
                <Box flexDirection="column" width={34}>
                    <Text color={THEME.colors.text}>Daily Volume (Past 7 Days)</Text>
                    <Text color={THEME.colors.border}>──────────────────────────</Text>

                    {dailyItems.map((item) => {
                        const spark = getSpark(item.tokens)
                        const isZero = item.tokens <= 0
                        return (
                            <Box key={item.date} gap={1}>
                                <Box width={10}>
                                    <Text color={THEME.colors.muted}>
                                        {item.dayName} {item.formattedDate}
                                    </Text>
                                </Box>
                                <Box width={2}>
                                    <Text color={isZero ? THEME.colors.dim : THEME.colors.brand}>
                                        {spark}
                                    </Text>
                                </Box>
                                <Box width={12}>
                                    <Text color={isZero ? THEME.colors.dim : THEME.colors.text}>
                                        {formatK(item.tokens).padStart(5)} tokens
                                    </Text>
                                </Box>
                                {item.isToday && <Text color={THEME.colors.brand}>(Today)</Text>}
                            </Box>
                        )
                    })}

                    <Box gap={1} marginTop={1}>
                        <Text color={THEME.colors.muted}>Less</Text>
                        <Text color={THEME.colors.dim}>·</Text>
                        <Text color={THEME.colors.brand}>░ ▒ ▓ █</Text>
                        <Text color={THEME.colors.muted}>More</Text>
                    </Box>

                    <Text color={THEME.colors.border}>──────────────────────────</Text>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>Weekly Total:</Text>
                        <Text color={THEME.colors.text}>{formatK(weekly.totalTokens)} tokens</Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>Active Days:</Text>
                        <Text color={THEME.colors.text}>{weekly.activeDays} / 7 days</Text>
                    </Box>
                </Box>

                {/* Right Column: Session Stats & Account & Quota */}
                <Box flexDirection="column" width={38}>
                    <Text color={THEME.colors.text}>Session Stats</Text>
                    <Text color={THEME.colors.border}>─────────────</Text>

                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Requests:</Text>
                        <Text color={THEME.colors.text}>{sessionStats.requests} requests</Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Input:</Text>
                        <Text color={THEME.colors.text}>
                            {formatK(sessionStats.inputTokens)} tokens
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Output:</Text>
                        <Text color={THEME.colors.text}>
                            {formatK(sessionStats.outputTokens)} tokens
                        </Text>
                    </Box>
                    {sessionStats.cacheReadTokens ? (
                        <Box gap={1}>
                            <Text color={THEME.colors.warning}>· Cache Read:</Text>
                            <Text color={THEME.colors.text}>
                                {formatK(sessionStats.cacheReadTokens)} tokens
                            </Text>
                        </Box>
                    ) : null}
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Est. Cost:</Text>
                        <Text color={THEME.colors.success}>{formatCost(calculatedCost)}</Text>
                    </Box>

                    <Box marginTop={1}>
                        <Text color={THEME.colors.text}>Account & Quota</Text>
                    </Box>
                    <Text color={THEME.colors.border}>───────────────</Text>

                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Balance:</Text>
                        <Text color={balance?.balance ? THEME.colors.success : THEME.colors.text}>
                            {balanceStr}
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Top Model:</Text>
                        <Text color={THEME.colors.text}>{topModelSummary}</Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>· Provider:</Text>
                        <Text color={THEME.colors.text}>{providerDisplayName}</Text>
                    </Box>
                </Box>
            </Box>

            <MenuFooter
                items={[
                    { key: 'esc', label: 'Cancel' },
                    { key: 'r', label: 'Refresh' },
                    { key: 'm', label: 'Switch model' },
                    { key: 'b', label: 'Billing portal' },
                ]}
            />
        </Box>
    )
}
