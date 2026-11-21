import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView, type MenuFooterItem } from './menu-footer-view'

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

const TONE_GLYPH: Record<ReportTone, string> = {
    ok: '✓',
    warn: '!',
    fail: '✗',
    heading: '',
    muted: '',
    normal: '',
}

function toneColor(tone: ReportTone): string {
    switch (tone) {
        case 'ok':
            return THEME.colors.success
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

export const ReportView = {
    render(buffer: ScreenBuffer, props: ReportViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width
        const footerY = props.y + props.height - 1
        const maxTextWidth = Math.max(10, width - x - (THEME.padding.paddingRight ?? 4))

        // 1. Header
        drawText(buffer, props.title, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (props.subtitle) {
            drawText(buffer, ` · ${props.subtitle}`, {
                x: x + props.title.length,
                y,
                maxWidth: Math.max(1, maxTextWidth - props.title.length),
                ellipsis: true,
                style: { fg: THEME.colors.dim },
            })
        }
        y += 2

        // 2. Tabs
        if (props.tabs && props.tabs.length > 0) {
            let tabX = x
            for (const tab of props.tabs) {
                const label = ` ${tab.label} `
                drawText(buffer, label, {
                    x: tabX,
                    y,
                    style: tab.active
                        ? { fg: THEME.colors.brand, bold: true, underline: true }
                        : { fg: THEME.colors.muted },
                })
                tabX += label.length + 1
            }
            y += 2
        }

        // 3. Rows
        const viewport = getReportViewportHeight(
            props.height,
            Boolean(props.tabs?.length),
            Boolean(props.input)
        )

        if (props.isLoading) {
            drawText(buffer, props.loadingText || 'Loading...', {
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
                const isSelected = row.id !== undefined && rowIndex === props.selectedIndex

                if (isSelected) {
                    for (let c = 0; c < maxTextWidth; c++) {
                        buffer.setChar(x + c, rowY, ' ', { bg: THEME.colors.codespanBg })
                    }
                }
                const bg = isSelected ? THEME.colors.codespanBg : undefined

                let cx = x
                if (row.id !== undefined) {
                    drawText(buffer, isSelected ? `${THEME.glyphs.selector} ` : '  ', {
                        x: cx,
                        y: rowY,
                        style: { fg: THEME.colors.brand, bold: true, bg },
                    })
                    cx += 2
                }

                const glyph = TONE_GLYPH[tone]
                if (glyph) {
                    drawText(buffer, `${glyph} `, {
                        x: cx,
                        y: rowY,
                        style: { fg: toneColor(tone), bold: true, bg },
                    })
                    cx += 2
                } else if (tone !== 'heading' && row.id === undefined) {
                    cx += 2
                }

                const textStyle =
                    tone === 'heading'
                        ? { fg: THEME.colors.brand, bold: true, bg }
                        : {
                              fg: isSelected
                                  ? THEME.colors.brand
                                  : tone === 'muted'
                                    ? THEME.colors.dim
                                    : THEME.colors.text,
                              bold: isSelected,
                              bg,
                          }
                const available = Math.max(1, x + maxTextWidth - cx)
                const drawn = drawText(buffer, row.text, {
                    x: cx,
                    y: rowY,
                    maxWidth: available,
                    ellipsis: true,
                    style: textStyle,
                })
                if (row.detail && drawn.x < x + maxTextWidth - 4) {
                    drawText(buffer, `  ${row.detail}`, {
                        x: drawn.x,
                        y: rowY,
                        maxWidth: x + maxTextWidth - drawn.x,
                        ellipsis: true,
                        style: { fg: THEME.colors.dim, bg },
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
                style: { fg: THEME.colors.brand, bold: true },
            })
            drawText(buffer, `${shown}▏`, {
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
