import { resolveModelRate } from '@december/shared'

import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface DailyUsageEntry {
    date: string
    dayName: string
    formattedDate: string
    tokens: number
    isToday: boolean
}

export interface UsageStats {
    requests: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    totalTokens: number
    cost?: number
}

export interface UsageSelectMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    activeModel?: string
    providerDisplayName?: string
    billingUrl?: string
    sessionStats: UsageStats
    dailyUsage?: DailyUsageEntry[]
    balance?: {
        supported: boolean
        balance?: string
        currency?: string
        error?: string
    }
}

const SHADE_LEVELS = ['░', '▒', '▓', '█']

export function formatTokenK(n: number): string {
    if (n === 0) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return n.toString()
}

export function formatCostString(val: number): string {
    if (val === 0) return '$0.0000'
    if (val < 0.0001) return '< $0.0001'
    return `$${val.toFixed(4)}`
}

export function calculateUsageCost(
    model: string,
    inTokens: number,
    outTokens: number,
    cacheTokens = 0
): number {
    try {
        const rate = resolveModelRate(model)
        const promptCost = (inTokens / 1_000_000) * rate.inputRate
        const completionCost = (outTokens / 1_000_000) * rate.outputRate
        const cacheSavings = (cacheTokens / 1_000_000) * rate.inputRate * 0.9
        return Math.max(0, promptCost + completionCost - cacheSavings)
    } catch {
        return 0
    }
}

export const UsageSelectMenuView = {
    getHeight(): number {
        return 14
    },

    render(buffer: ScreenBuffer, props: UsageSelectMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )

        const activeModel = props.activeModel || 'gemini-3.7-flash'
        const providerName = props.providerDisplayName || 'Google'

        // 1. Header Row
        drawText(buffer, 'Token Usage & Cost Analysis · ', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        const titleOffset = x + 30
        drawText(buffer, activeModel, {
            x: titleOffset,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        drawText(buffer, ` (${providerName})`, {
            x: titleOffset + activeModel.length,
            y,
            style: { fg: THEME.colors.muted },
        })
        y += 1

        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // Two Column layout if width >= 68
        const isNarrow = width < 68
        const col1Width = isNarrow ? width : 36
        const col2X = isNarrow ? x : x + 38

        // Left Column: Daily Volume
        drawText(buffer, 'Daily Volume (Past 7 Days)', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (!isNarrow) {
            drawText(buffer, 'Session Statistics', {
                x: col2X,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
        }
        y += 1

        const daily = props.dailyUsage || []
        const maxDaily = Math.max(...daily.map((d) => d.tokens), 1)

        // Render 7 daily rows
        for (let i = 0; i < 7; i++) {
            const rowY = y + i
            const item = daily[i]

            if (item) {
                const dayLabel = `${item.dayName} ${item.formattedDate}`
                drawText(buffer, dayLabel.padEnd(11), {
                    x,
                    y: rowY,
                    style: { fg: item.isToday ? THEME.colors.brand : THEME.colors.muted },
                })

                const sparkIdx = Math.min(
                    SHADE_LEVELS.length - 1,
                    Math.floor((item.tokens / maxDaily) * SHADE_LEVELS.length)
                )
                const spark = item.tokens <= 0 ? '·' : SHADE_LEVELS[sparkIdx]

                drawText(buffer, spark, {
                    x: x + 12,
                    y: rowY,
                    style: { fg: item.tokens <= 0 ? THEME.colors.dim : THEME.colors.brand },
                })

                drawText(buffer, `${formatTokenK(item.tokens).padStart(6)} tokens`, {
                    x: x + 14,
                    y: rowY,
                    style: { fg: item.tokens <= 0 ? THEME.colors.dim : THEME.colors.text },
                })

                if (item.isToday) {
                    drawText(buffer, ' (Today)', {
                        x: x + 28,
                        y: rowY,
                        style: { fg: THEME.colors.brand },
                    })
                }
            } else {
                drawText(buffer, '· · · · · · · · · · · · · · ·', {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.dim },
                })
            }

            // Right Column item
            if (!isNarrow) {
                if (i === 0) {
                    drawText(buffer, `· Requests:      ${props.sessionStats.requests} requests`, {
                        x: col2X,
                        y: rowY,
                        style: { fg: THEME.colors.text },
                    })
                } else if (i === 1) {
                    drawText(
                        buffer,
                        `· Prompt Tokens: ${formatTokenK(props.sessionStats.inputTokens)} tokens`,
                        {
                            x: col2X,
                            y: rowY,
                            style: { fg: THEME.colors.text },
                        }
                    )
                } else if (i === 2) {
                    drawText(
                        buffer,
                        `· Output Tokens: ${formatTokenK(props.sessionStats.outputTokens)} tokens`,
                        {
                            x: col2X,
                            y: rowY,
                            style: { fg: THEME.colors.text },
                        }
                    )
                } else if (i === 3) {
                    const cacheTok = props.sessionStats.cacheReadTokens || 0
                    drawText(buffer, `· Cache Read:    ${formatTokenK(cacheTok)} tokens`, {
                        x: col2X,
                        y: rowY,
                        style: { fg: cacheTok > 0 ? THEME.colors.warning : THEME.colors.muted },
                    })
                } else if (i === 4) {
                    const cost =
                        props.sessionStats.cost ??
                        calculateUsageCost(
                            activeModel,
                            props.sessionStats.inputTokens,
                            props.sessionStats.outputTokens,
                            props.sessionStats.cacheReadTokens
                        )
                    drawText(buffer, `· Estimated Cost: ${formatCostString(cost)}`, {
                        x: col2X,
                        y: rowY,
                        style: { fg: THEME.colors.success, bold: true },
                    })
                } else if (i === 5) {
                    const bal = props.balance?.supported
                        ? props.balance.balance || 'Checking...'
                        : 'Unavailable'
                    drawText(buffer, `· Account Balance: ${bal}`, {
                        x: col2X,
                        y: rowY,
                        style: { fg: THEME.colors.muted },
                    })
                } else if (i === 6) {
                    drawText(buffer, `· Billing Portal: [b] Open link`, {
                        x: col2X,
                        y: rowY,
                        style: { fg: THEME.colors.brand },
                    })
                }
            }
        }
        y += 7

        // Sparkline Legend
        drawText(buffer, 'Less · ░ ▒ ▓ █ · More', {
            x,
            y,
            style: { fg: THEME.colors.dim },
        })
        y += 1

        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1
        const bottomDividerY = (props.y ?? 0) + height - 2

        drawDivider(buffer, {
            x,
            y: bottomDividerY,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })

        // Footer
        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: [
                { key: 'b', label: 'billing portal' },
                { key: 'r', label: 'refresh' },
                { key: 'm', label: 'switch model' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
