import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView, type MenuFooterItem } from './menu-footer-view'
import { drawPanelTitle, drawTabs, requestPanelCursor } from './panel'

import type { ScreenBuffer } from '../buffer'

/**
 * Full-screen list of rows with an optional selection cursor and text input.
 * Used by /check, /skills, /hooks, /permissions, and /github.
 */

export type ReportTone = 'ok' | 'warn' | 'fail' | 'heading' | 'muted' | 'normal'

export interface ReportRow {
    text: string
    tone?: ReportTone
    /** dim text after the main text, on the same line */
    detail?: string
    /** rows with an id can be selected with ↑/↓ */
    id?: string
}

export interface ReportViewProps {
    x?: number
    y: number
    width: number
    height: number
    title: string
    subtitle?: string
    rows: ReportRow[]
    /** index into rows of the selected row (only rows with an id are selectable) */
    selectedIndex?: number
    scrollOffset?: number
    isLoading?: boolean
    loadingText?: string
    emptyText?: string
    /** shown under the title, e.g. allow / deny tabs */
    tabs?: { label: string; active: boolean }[]
    /** a single-line text input above the footer */
    input?: { prompt: string; value: string; mask?: boolean }
    footer: MenuFooterItem[]
}

/** M26.1: a pass is a dim ✓, a warning a yellow !, a failure a red ● (the chat's failed step) */
const TONE_GLYPH: Record<ReportTone, string> = {
    ok: '✓',
    warn: '!',
    fail: THEME.glyphs.status,
    heading: '',
    muted: '',
    normal: '',
}

function toneColor(tone: ReportTone): string {
    switch (tone) {
        case 'ok':
            return THEME.colors.dim
        case 'warn':
            return THEME.colors.warning
        case 'fail':
            return THEME.colors.error
        case 'muted':
            return THEME.colors.dim
        default:
            return THEME.colors.text
    }
}

/** number of rows the list area can show for a given screen height */
export function getReportViewportHeight(
    height: number,
    hasTabs: boolean,
    hasInput: boolean
): number {
    // title + blank, optional tabs + blank, list, optional input + blank, footer
    const reserved = 2 + (hasTabs ? 2 : 0) + (hasInput ? 2 : 0) + 2
    return Math.max(1, height - reserved)
}

/** keeps the selected row inside the viewport */
export function clampReportScroll(selected: number, scroll: number, viewport: number): number {
    if (selected < scroll) return selected
    if (selected >= scroll + viewport) return selected - viewport + 1
    return scroll
}

/** next selectable row index in a direction, or the current index when there is none */
export function nextSelectableRow(rows: ReportRow[], current: number, step: 1 | -1): number {
    for (let i = current + step; i >= 0 && i < rows.length; i += step) {
        if (rows[i]?.id) return i
    }
    return current
}

export function firstSelectableRow(rows: ReportRow[]): number {
    const idx = rows.findIndex((r) => r.id)
    return idx >= 0 ? idx : 0
}

/** M26.5: fix lines start with a dim └ (rows built with the older ↳ are drawn the same way) */
const FIX_PREFIXES = ['└ ', '↳ ']

function fixText(text: string): string | null {
    for (const prefix of FIX_PREFIXES) {
        if (text.startsWith(prefix)) return text.slice(prefix.length)
    }
    return null
}

export const ReportView = {
    render(buffer: ScreenBuffer, props: ReportViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const footerY = props.y + props.height - 1
        const maxTextWidth = Math.max(10, width - x - (THEME.padding.paddingRight ?? 4))

        // 1. Title row (G2): the title, then the subtitle as muted meta
        drawPanelTitle(buffer, {
            x,
            y,
            title: props.title,
            meta: props.subtitle,
            width: maxTextWidth,
        })
        y += 2

        // 2. Tabs (G14, M26.3): active in brand blue, others muted, no bold, no underline
        if (props.tabs && props.tabs.length > 0) {
            drawTabs(buffer, {
                x,
                y,
                tabs: props.tabs.map((t) => t.label),
                active: props.tabs.findIndex((t) => t.active),
            })
            y += 2
        }

        // 3. Rows
        const viewport = getReportViewportHeight(
            props.height,
            Boolean(props.tabs?.length),
            Boolean(props.input)
        )

        if (props.isLoading) {
            drawText(buffer, props.loadingText || 'Loading…', {
                x,
                y,
                style: { fg: THEME.colors.dim },
            })
        } else if (props.rows.length === 0) {
            drawText(buffer, props.emptyText || 'Nothing to show.', {
                x,
                y,
                maxWidth: maxTextWidth,
                style: { fg: THEME.colors.dim },
            })
        } else {
            const scroll = Math.max(
                0,
                Math.min(props.scrollOffset ?? 0, Math.max(0, props.rows.length - viewport))
            )
            const visible = props.rows.slice(scroll, scroll + viewport)
            for (let i = 0; i < visible.length; i++) {
                const row = visible[i]!
                const rowIndex = scroll + i
                const rowY = y + i
                const tone = row.tone || 'normal'
                // G3: the selected row is ❭ and label in brand blue, regular weight, no band
                const isSelected = row.id !== undefined && rowIndex === props.selectedIndex

                const fix = fixText(row.text)
                if (fix !== null) {
                    // Lined up under the label, after the selector and glyph slots
                    const fx = x + 4
                    drawText(buffer, `${THEME.glyphs.result} `, {
                        x: fx,
                        y: rowY,
                        style: { fg: THEME.colors.dim },
                    })
                    drawText(buffer, fix, {
                        x: fx + 2,
                        y: rowY,
                        maxWidth: Math.max(1, x + maxTextWidth - fx - 2),
                        ellipsis: true,
                        style: { fg: THEME.colors.muted },
                    })
                    continue
                }

                let cx = x
                if (row.id !== undefined) {
                    if (isSelected) {
                        drawText(buffer, `${THEME.glyphs.selector} `, {
                            x: cx,
                            y: rowY,
                            style: { fg: THEME.colors.brand },
                        })
                    }
                    cx += 2
                }

                const glyph = TONE_GLYPH[tone]
                if (glyph) {
                    drawText(buffer, `${glyph} `, {
                        x: cx,
                        y: rowY,
                        style: { fg: isSelected ? THEME.colors.brand : toneColor(tone) },
                    })
                    cx += 2
                } else if (tone !== 'heading' && row.id === undefined) {
                    cx += 2
                }

                // M26.2: section headings in muted with no bold
                const textColor =
                    tone === 'heading'
                        ? THEME.colors.muted
                        : isSelected
                          ? THEME.colors.brand
                          : tone === 'muted'
                            ? THEME.colors.dim
                            : THEME.colors.text
                const available = Math.max(1, x + maxTextWidth - cx)
                const drawn = drawText(buffer, row.text, {
                    x: cx,
                    y: rowY,
                    maxWidth: available,
                    ellipsis: true,
                    style: { fg: textColor },
                })
                if (row.detail && drawn.x < x + maxTextWidth - 4) {
                    // Side text in muted; a failure's detail is a fault word, in red
                    drawText(buffer, `  ${row.detail}`, {
                        x: drawn.x,
                        y: rowY,
                        maxWidth: x + maxTextWidth - drawn.x,
                        ellipsis: true,
                        style: { fg: tone === 'fail' ? THEME.colors.error : THEME.colors.muted },
                    })
                }
            }
        }

        // 4. Input
        if (props.input) {
            const inputY = footerY - 2
            const shown = props.input.mask
                ? '•'.repeat(props.input.value.length)
                : props.input.value
            drawText(buffer, `${props.input.prompt} `, {
                x,
                y: inputY,
                style: { fg: THEME.colors.brand },
            })
            requestPanelCursor(x + props.input.prompt.length + 1 + shown.length, inputY)
            drawText(buffer, shown, {
                x: x + props.input.prompt.length + 1,
                y: inputY,
                maxWidth: Math.max(1, maxTextWidth - props.input.prompt.length - 1),
                style: { fg: THEME.colors.text },
            })
        }

        // 5. Footer
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: props.footer,
        })
    },
}
