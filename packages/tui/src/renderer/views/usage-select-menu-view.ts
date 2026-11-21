import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

/** Token totals for the messages in the current conversation (used by /context). */
export interface UsageStats {
    requests: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens?: number
    totalTokens: number
}

export interface UsageTokenBreakdown {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
}

/** All-time history aggregated from the local usage ledger. */
export interface UsageHistory extends UsageTokenBreakdown {
    /** local YYYY-MM-DD date key -> total tokens on that day */
    dailyTokens: Record<string, number>
    totalTokens: number
    sessions: number
    topModel?: string
    activeDays: number
    /** days from the first recorded day to today, inclusive */
    trackedDays: number
}

export interface UsageOverview {
    history: UsageHistory
    /** december cloud wallet balance, only set for december cloud users */
    creditsRemainingInCents?: number
}

export interface UsageSelectMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    overview?: UsageOverview
    isLoading?: boolean
    /** injectable clock for tests */
    now?: Date
}

const HEATMAP_ROWS = 7
const HEATMAP_LABEL_WIDTH = 4
const MAX_HEATMAP_WEEKS = 52
const MIN_HEATMAP_WEEKS = 8
/** use 2-character cells only while they still show at least half a year */
const MIN_WIDE_CELL_WEEKS = 26
/** a month label is 3 characters; keep at least one space between labels */
const MONTH_LABEL_SPACING = 4
/** space kept between stat columns */
const STAT_COLUMN_GAP = 2
const SHADES = ['░', '▒', '▓', '█']
const DAY_LABELS: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function localDateKey(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

function parseDateKey(key: string): Date {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function formatUsageTokens(n: number): string {
    if (n < 1_000) return Math.round(n).toString()
    if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    return `${(n / 1_000_000_000).toFixed(1)}B`
}

function formatCredits(cents: number): string {
    return `$${(Math.max(0, cents) / 100).toFixed(2)}`
}

export interface HeatmapCell {
    date: string
    tokens: number
    /** -1 for days after today, 0 for no usage, 1-4 for usage intensity */
    level: number
}

export interface HeatmapGrid {
    /** columns[week][dayOfWeek], dayOfWeek 0 = Sunday */
    columns: HeatmapCell[][]
    /** month label positions as column indexes */
    monthLabels: { column: number; label: string }[]
}

/**
 * Builds a week-column grid ending in the current week. Intensity is ranked
 * by quartile across active days so one very heavy day does not flatten the rest.
 */
export function buildHeatmapGrid(
    dailyTokens: Record<string, number>,
    weeks: number,
    now: Date,
    cellWidth = 1
): HeatmapGrid {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const firstSunday = addDays(today, -today.getDay() - (weeks - 1) * 7)

    const activeValues = Object.values(dailyTokens)
        .filter((v) => v > 0)
        .sort((a, b) => a - b)
    const quartile = (p: number): number =>
        activeValues[Math.min(activeValues.length - 1, Math.floor(activeValues.length * p))] ?? 0
    const thresholds = [quartile(0.25), quartile(0.5), quartile(0.75)]

    const levelFor = (tokens: number): number => {
        if (tokens <= 0) return 0
        let level = 1
        for (const t of thresholds) {
            if (tokens > t) level++
        }
        return Math.min(level, SHADES.length)
    }

    const columns: HeatmapCell[][] = []
    const candidates: { column: number; label: string }[] = []
    let previousMonth = -1

    for (let c = 0; c < weeks; c++) {
        const weekStart = addDays(firstSunday, c * 7)
        const column: HeatmapCell[] = []
        for (let r = 0; r < HEATMAP_ROWS; r++) {
            const date = addDays(weekStart, r)
            const key = localDateKey(date)
            const tokens = dailyTokens[key] ?? 0
            column.push({ date: key, tokens, level: date > today ? -1 : levelFor(tokens) })
        }
        columns.push(column)

        const month = weekStart.getMonth()
        if (month !== previousMonth) {
            candidates.push({ column: c, label: MONTHS[month] ?? '' })
            previousMonth = month
        }
    }

    // a partial first month would crowd the next label: drop it, then skip any overlaps
    const minWeeksApart = Math.ceil(MONTH_LABEL_SPACING / cellWidth)
    const [first, second] = candidates
    if (first && second && second.column - first.column < Math.max(minWeeksApart, 3)) {
        candidates.shift()
    }
    const monthLabels: { column: number; label: string }[] = []
    for (const candidate of candidates) {
        const last = monthLabels[monthLabels.length - 1]
        if (!last || candidate.column - last.column >= minWeeksApart) monthLabels.push(candidate)
    }

    return { columns, monthLabels }
}

/** Rows the heatmap block needs: month labels, 7 day rows, legend. */
const HEATMAP_HEIGHT = HEATMAP_ROWS + 2

function drawHeatmap(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    weeks: number,
    cellWidth: number,
    dailyTokens: Record<string, number>,
    now: Date
): void {
    const grid = buildHeatmapGrid(dailyTokens, weeks, now, cellWidth)
    const gridX = x + HEATMAP_LABEL_WIDTH

    for (const { column, label } of grid.monthLabels) {
        drawText(buffer, label, {
            x: gridX + column * cellWidth,
            y,
            style: { fg: THEME.colors.muted },
        })
    }

    for (let r = 0; r < HEATMAP_ROWS; r++) {
        const rowY = y + 1 + r
        const dayLabel = DAY_LABELS[r]
        if (dayLabel) {
            drawText(buffer, dayLabel, { x, y: rowY, style: { fg: THEME.colors.muted } })
        }
        for (let c = 0; c < grid.columns.length; c++) {
            const cell = grid.columns[c]?.[r]
            if (!cell || cell.level < 0) continue
            const char = cell.level === 0 ? '·' : (SHADES[cell.level - 1] ?? '█')
            drawText(buffer, char, {
                x: gridX + c * cellWidth,
                y: rowY,
                style: { fg: cell.level === 0 ? THEME.colors.border : THEME.colors.brand },
            })
        }
    }

    const legendY = y + 1 + HEATMAP_ROWS
    drawText(buffer, 'less', { x: gridX, y: legendY, style: { fg: THEME.colors.dim } })
    drawText(buffer, SHADES.join(' '), {
        x: gridX + 5,
        y: legendY,
        style: { fg: THEME.colors.brand },
    })
    drawText(buffer, 'more', {
        x: gridX + 5 + SHADES.length * 2,
        y: legendY,
        style: { fg: THEME.colors.dim },
    })
}

function drawLabelValue(
    buffer: ScreenBuffer,
    x: number,
    y: number,
    label: string,
    value: string,
    labelWidth: number,
    maxWidth: number
): void {
    drawText(buffer, label, { x, y, style: { fg: THEME.colors.muted } })
    drawText(buffer, value, {
        x: x + labelWidth,
        y,
        maxWidth: Math.max(1, maxWidth - labelWidth),
        ellipsis: true,
        style: { fg: THEME.colors.text },
    })
}

/**
 * The heatmap fills the width: 2 characters per week while that still shows
 * at least half a year, otherwise 1 character per week. At most one year.
 */
export function getHeatmapLayout(width: number): { weeks: number; cellWidth: number } {
    const gridWidth = width - HEATMAP_LABEL_WIDTH
    const cellWidth = Math.floor(gridWidth / 2) >= MIN_WIDE_CELL_WEEKS ? 2 : 1
    const weeks = Math.max(
        MIN_HEATMAP_WEEKS,
        Math.min(MAX_HEATMAP_WEEKS, Math.floor(gridWidth / cellWidth))
    )
    return { weeks, cellWidth }
}

type StatPair = [string, string]

/** Four groups of two stats. Each group stays together in one column. */
function statGroups(history: UsageHistory): StatPair[][] {
    return [
        [
            ['Total tokens', formatUsageTokens(history.totalTokens)],
            ['Top model', history.topModel ?? '-'],
        ],
        [
            ['Sessions', history.sessions.toString()],
            ['Active days', `${history.activeDays} / ${history.trackedDays}`],
        ],
        [
            ['Input', formatUsageTokens(history.input)],
            ['Output', formatUsageTokens(history.output)],
        ],
        [
            ['Cache read', formatUsageTokens(history.cacheRead)],
            ['Cache write', formatUsageTokens(history.cacheWrite)],
        ],
    ]
}

export interface StatColumn {
    x: number
    labelWidth: number
    /** one entry per row; groups stack top to bottom */
    pairs: StatPair[]
}

/**
 * Spreads the stat groups across the width in 4, 2 or 1 columns: the most
 * columns where every label and value fits. Leftover width is shared evenly
 * as the space after each column.
 */
export function layoutStatColumns(groups: StatPair[][], width: number): StatColumn[] {
    for (const count of [4, 2, 1]) {
        const columns = Array.from({ length: count }, (_, c) => {
            const pairs = groups.filter((_, g) => g % count === c).flat()
            const labelWidth = Math.max(...pairs.map(([label]) => label.length)) + 2
            const valueWidth = Math.max(...pairs.map(([, value]) => value.length))
            return { x: 0, labelWidth, pairs, contentWidth: labelWidth + valueWidth }
        })
        const contentWidth = columns.reduce((sum, col) => sum + col.contentWidth, 0)
        if (count > 1 && contentWidth + count * STAT_COLUMN_GAP > width) continue

        const gap = Math.floor((width - contentWidth) / count)
        let nextX = 0
        return columns.map(({ labelWidth, pairs, contentWidth: own }) => {
            const column = { x: nextX, labelWidth, pairs }
            nextX += own + gap
            return column
        })
    }
    return []
}

function statRowCount(overview: UsageOverview | undefined, width: number): number {
    if (!overview || overview.history.totalTokens <= 0) return 1
    const columns = layoutStatColumns(statGroups(overview.history), width)
    return Math.max(...columns.map((col) => col.pairs.length))
}

function innerWidthOf(width: number): number {
    return Math.max(20, width - THEME.padding.paddingLeft - THEME.padding.paddingRight)
}

export const UsageSelectMenuView = {
    /** header, optional credits, heatmap, blank, stats, blank, footer */
    getHeight(overview?: UsageOverview, width = 120): number {
        const creditRows = overview?.creditsRemainingInCents !== undefined ? 2 : 0
        const statRows = statRowCount(overview, innerWidthOf(width))
        return 2 + creditRows + HEATMAP_HEIGHT + 1 + statRows + 2
    },

    render(buffer: ScreenBuffer, props: UsageSelectMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        const width = innerWidthOf(props.width)
        const height = props.height ?? buffer.height
        const footerY = props.y + height - 1
        const now = props.now ?? new Date()
        let y = props.y

        drawText(buffer, 'Usage', { x, y, style: { fg: THEME.colors.text, bold: true } })
        y += 2

        const footer = (): void => {
            MenuFooterView.render(buffer, {
                x,
                y: footerY,
                width,
                items: [
                    { key: 'b', label: 'usage dashboard' },
                    { key: 'esc', label: 'close' },
                ],
            })
        }

        const overview = props.overview
        if (!overview) {
            drawText(buffer, props.isLoading === false ? 'Usage unavailable' : 'Loading usage…', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            footer()
            return
        }

        // only rows above the footer are usable
        const fits = (rows: number): boolean => y + rows <= footerY - 1

        if (overview.creditsRemainingInCents !== undefined && fits(1)) {
            drawLabelValue(
                buffer,
                x,
                y,
                'December credits',
                `${formatCredits(overview.creditsRemainingInCents)} left`,
                18,
                width
            )
            y += 2
        }

        const history = overview.history
        const statRows = statRowCount(overview, width)

        // the heatmap is the first thing dropped on short terminals
        if (fits(HEATMAP_HEIGHT + 1 + statRows)) {
            const heatmap = getHeatmapLayout(width)
            drawHeatmap(buffer, x, y, heatmap.weeks, heatmap.cellWidth, history.dailyTokens, now)
            y += HEATMAP_HEIGHT + 1
        }

        if (history.totalTokens <= 0) {
            if (fits(1)) {
                drawText(buffer, 'No usage yet. Stats appear after your first request.', {
                    x,
                    y,
                    maxWidth: width,
                    ellipsis: true,
                    style: { fg: THEME.colors.muted },
                })
            }
            footer()
            return
        }

        const columns = layoutStatColumns(statGroups(history), width)
        for (let row = 0; row < statRows && fits(1); row++) {
            for (const [c, column] of columns.entries()) {
                const pair = column.pairs[row]
                if (!pair) continue
                const next = columns[c + 1]
                const maxWidth = (next ? next.x : width) - column.x
                drawLabelValue(
                    buffer,
                    x + column.x,
                    y,
                    pair[0],
                    pair[1],
                    column.labelWidth,
                    maxWidth
                )
            }
            y += 1
        }

        footer()
    },
}
