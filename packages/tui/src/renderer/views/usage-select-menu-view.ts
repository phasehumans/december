import { resolveModelRate } from '@december/shared'

import { THEME } from '../../theme'
import { drawText } from '../ui'

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

export interface WeeklyStats {
    totalTokens: number
    activeDays: number
    topModels?: { model: string; percentage: number }[]
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
    weeklyStats?: WeeklyStats
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
        // Intentionally swallowed: return fallback zero cost if rate calculation fails
        return 0
    }
}

export function generateDefaultDailyUsage(): DailyUsageEntry[] {
    const now = new Date()
    const items: DailyUsageEntry[] = []
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

function getBillingHost(url?: string): string {
    if (!url) return 'trydecember.com'
    try {
        const u = new URL(url)
        return u.hostname
    } catch {
        // Intentionally swallowed: fallback to basic string manipulation
        return url.replace(/^https?:\/\//, '').split('/')[0] || 'trydecember.com'
    }
}

export const UsageSelectMenuView = {
    getHeight(): number {
        return 16
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
        y += 2 // Clean 1 empty spacing row matching borderless style

        // Two Column layout if width >= 68
        const isNarrow = width < 68
        const col2X = isNarrow ? x : Math.max(x + 42, Math.floor(x + width / 2))

        // Left Column: Daily Volume Header
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

        const daily =
            props.dailyUsage && props.dailyUsage.length > 0
                ? props.dailyUsage
                : generateDefaultDailyUsage()
        const maxDaily = Math.max(...daily.map((d) => d.tokens), 1)

        // Render 7 daily rows (Row 1 to 7)
        for (let i = 0; i < 7; i++) {
            const rowY = y + 1 + i
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
            }
        }

        // Right Column items (Session Statistics & Account & Quota)
        if (!isNarrow) {
            // Row 1: Requests
            drawText(buffer, `· Requests:       ${props.sessionStats.requests} requests`, {
                x: col2X,
                y: y + 1,
                style: { fg: THEME.colors.text },
            })
            // Row 2: Prompt Tokens
            drawText(
                buffer,
                `· Prompt Tokens:  ${formatTokenK(props.sessionStats.inputTokens)} tokens`,
                {
                    x: col2X,
                    y: y + 2,
                    style: { fg: THEME.colors.text },
                }
            )
            // Row 3: Output Tokens
            drawText(
                buffer,
                `· Output Tokens:  ${formatTokenK(props.sessionStats.outputTokens)} tokens`,
                {
                    x: col2X,
                    y: y + 3,
                    style: { fg: THEME.colors.text },
                }
            )
            // Row 4: Cache Read
            const cacheTok = props.sessionStats.cacheReadTokens || 0
            drawText(buffer, `· Cache Read:     ${formatTokenK(cacheTok)} tokens`, {
                x: col2X,
                y: y + 4,
                style: { fg: cacheTok > 0 ? THEME.colors.warning : THEME.colors.muted },
            })
            // Row 5: Estimated Cost
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
                y: y + 5,
                style: { fg: THEME.colors.success, bold: true },
            })

            // Row 7: Account & Quota Header
            drawText(buffer, 'Account & Quota', {
                x: col2X,
                y: y + 7,
                style: { fg: THEME.colors.text, bold: true },
            })

            // Row 8: Balance
            const bal = props.balance?.supported
                ? props.balance.balance
                    ? `${props.balance.balance} (Live)`
                    : props.balance.error
                      ? `Unavailable (${props.balance.error})`
                      : 'Checking...'
                : 'Unavailable'
            drawText(buffer, `· Balance:        ${bal}`, {
                x: col2X,
                y: y + 8,
                style: { fg: THEME.colors.muted },
            })

            // Row 9: Top Model
            const topModelItem = props.weeklyStats?.topModels?.[0]
            const topModelSummary = topModelItem
                ? `${topModelItem.model} (${topModelItem.percentage}%)`
                : activeModel
            drawText(buffer, `· Top Model:      ${topModelSummary}`, {
                x: col2X,
                y: y + 9,
                style: { fg: THEME.colors.muted },
            })

            // Row 10: Provider
            drawText(buffer, `· Provider:       ${providerName}`, {
                x: col2X,
                y: y + 10,
                style: { fg: THEME.colors.muted },
            })

            // Row 11: Billing
            const billingHost = getBillingHost(props.billingUrl)
            drawText(buffer, `· Billing:        [b] ${billingHost}`, {
                x: col2X,
                y: y + 11,
                style: { fg: THEME.colors.brand },
            })
        }

        // Left Column footer items:
        // Row 9: Sparkline Legend
        drawText(buffer, 'Less · ░ ▒ ▓ █ · More', {
            x,
            y: y + 9,
            style: { fg: THEME.colors.dim },
        })

        // Row 10: Weekly Total
        const weeklyTotal =
            props.weeklyStats?.totalTokens ?? daily.reduce((acc, d) => acc + (d.tokens || 0), 0)
        drawText(buffer, `Weekly Total: ${formatTokenK(weeklyTotal)} tokens`, {
            x,
            y: y + 10,
            style: { fg: THEME.colors.muted },
        })

        // Row 11: Active Days
        const activeDays =
            props.weeklyStats?.activeDays ?? daily.filter((d) => (d.tokens || 0) > 0).length
        drawText(buffer, `Active Days:  ${activeDays} / 7 days`, {
            x,
            y: y + 11,
            style: { fg: THEME.colors.muted },
        })

        const height = props.height ?? buffer.height
        const footerY = (props.y ?? 0) + height - 1

        // Footer
        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: [
                { key: 'b', label: 'billing' },
                { key: 'm', label: 'switch model' },
                { key: 'r', label: 'refresh' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
