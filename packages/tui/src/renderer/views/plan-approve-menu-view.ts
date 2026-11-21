import { THEME } from '../../theme'
import { drawText } from '../ui'

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
    /** Full plan text, used for the "4 steps · 3 files" line (S20) */
    planText?: string
    selectedIndex: number
}

/** "4 steps · 3 files" from the numbered steps and the file paths a plan mentions */
export function planFacts(planText?: string): string {
    if (!planText) return ''
    const steps = (planText.match(/^\s*\d+[.)]\s+\S/gm) || []).length
    const files = new Set(
        (
            planText.match(
                /[\w@.-]*[\w-]+\/[\w./-]*\.[a-z]{1,5}\b|\b[\w-]+\.(?:ts|tsx|js|jsx|json|md|mdx|py|go|rs|css|sql|yml|yaml)\b/gi
            ) || []
        ).map((f) => f.replace(/^\.\//, ''))
    )
    const parts: string[] = []
    if (steps > 0) parts.push(`${steps} ${steps === 1 ? 'step' : 'steps'}`)
    if (files.size > 0) parts.push(`${files.size} ${files.size === 1 ? 'file' : 'files'}`)
    return parts.join(' · ')
}

export const PLAN_APPROVE_OPTIONS: PlanApproveOption[] = [
    { label: 'Yes, start', value: 'approve', keyHint: 'y' },
    { label: 'Change the plan', value: 'refine', keyHint: 'r' },
    { label: 'Show the full plan', value: 'view', keyHint: 'v' },
    { label: 'No', value: 'reject', keyHint: 'n' },
]

export const PlanApproveMenuView = {
    getHeight(planText?: string): number {
        // question, summary, (facts), blank, options, footer
        return 3 + (planFacts(planText) ? 1 : 0) + PLAN_APPROVE_OPTIONS.length + 1
    },

    render(buffer: ScreenBuffer, props: PlanApproveMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )

        // K9: no divider line above the prompt; the question row starts it

        // The question is the only bold text on screen (T3.6)
        drawText(buffer, 'Start with this plan?', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        const summary = props.planSummary
            ? props.planSummary.replace(/\s+/g, ' ').trim()
            : 'The plan is ready for review.'
        drawText(buffer, summary, {
            x: x + 2,
            y,
            maxWidth: Math.max(10, width - 2),
            style: { fg: THEME.colors.muted },
        })
        y += 1
        const facts = planFacts(props.planText)
        if (facts) {
            drawText(buffer, facts, { x: x + 2, y, style: { fg: THEME.colors.dim } })
            y += 1
        }
        y += 1

        PLAN_APPROVE_OPTIONS.forEach((opt, idx) => {
            const isSelected = idx === props.selectedIndex
            drawText(
                buffer,
                isSelected ? `${THEME.glyphs.selector} ${opt.label}` : `  ${opt.label}`,
                {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                }
            )
            y += 1
        })

        const height = props.height ?? buffer.height
        drawText(buffer, 'enter select · esc no · y r v n', {
            x,
            y: Math.min(y, (props.y ?? 0) + height - 1),
            maxWidth: width,
            style: { fg: THEME.colors.dim },
        })
    },
}
