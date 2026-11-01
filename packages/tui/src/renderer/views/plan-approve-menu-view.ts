import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface PlanApproveOption {
    label: string
    value: 'approve' | 'refine' | 'view' | 'reject'
    keyHint: string
}

export interface PlanApproveMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    planSummary?: string
    selectedIndex: number
}

export const PLAN_APPROVE_OPTIONS: PlanApproveOption[] = [
    { label: 'Approve & Execute', value: 'approve', keyHint: 'y' },
    { label: 'Refine Plan', value: 'refine', keyHint: 'r' },
    { label: 'View Full Plan', value: 'view', keyHint: 'v' },
    { label: 'Reject / Cancel', value: 'reject', keyHint: 'n' },
]

export const PlanApproveMenuView = {
    getHeight(): number {
        // Header (1), Summary Box (2), Divider (1), Options (4), Divider (1), Footer (1) = 10
        return 10
    },

    render(buffer: ScreenBuffer, props: PlanApproveMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )

        // 1. Header
        drawText(buffer, '[PLAN] Architectural Plan Generated', {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        y += 1

        // 2. Plan Summary Box
        const summary = props.planSummary
            ? props.planSummary.replace(/\s+/g, ' ').trim()
            : 'Plan details ready for execution review.'
        const maxSummaryWidth = Math.max(10, width - 4)
        drawText(buffer, summary, {
            x: x + 2,
            y,
            maxWidth: maxSummaryWidth,
            style: { fg: THEME.colors.muted },
        })
        y += 1

        // 3. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 4. Options List
        for (let idx = 0; idx < PLAN_APPROVE_OPTIONS.length; idx++) {
            const opt = PLAN_APPROVE_OPTIONS[idx]
            const isSelected = idx === props.selectedIndex
            const rowY = y + idx

            // Selector
            const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
            })

            // Key hint
            drawText(buffer, `[${opt.keyHint}] `, {
                x: x + 2,
                y: rowY,
                style: { fg: isSelected ? THEME.colors.brand : THEME.colors.dim, bold: isSelected },
            })

            // Color
            let labelColor: string = THEME.colors.text
            if (opt.value === 'approve')
                labelColor = isSelected ? THEME.colors.success : THEME.colors.text
            else if (opt.value === 'reject')
                labelColor = isSelected ? THEME.colors.error : THEME.colors.text

            drawText(buffer, opt.label, {
                x: x + 6,
                y: rowY,
                maxWidth: width - 8,
                style: { fg: isSelected ? labelColor : THEME.colors.muted, bold: isSelected },
            })
        }
        y += PLAN_APPROVE_OPTIONS.length

        // 5. Divider
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

        // 6. Footer
        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: [
                { key: 'y', label: 'approve' },
                { key: 'r', label: 'refine' },
                { key: 'v', label: 'view full' },
                { key: 'n/esc', label: 'reject' },
                { key: '↑/↓', label: 'navigate' },
                { key: 'enter', label: 'select' },
            ],
        })
    },
}
