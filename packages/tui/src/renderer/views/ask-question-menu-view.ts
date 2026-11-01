import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface QuestionItem {
    question: string
    options: string[]
    is_multi_select?: boolean
}

export interface AskQuestionMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    questions: QuestionItem[]
    currentQuestionIndex: number
    selectedIndex: number
    selectedMultiIndices?: Set<number>
}

export const AskQuestionMenuView = {
    getHeight(optionsCount: number): number {
        // Question header (1), Subtitle/blank (1), Divider (1), Options (optionsCount), Divider (1), Footer (1) = 4 + optionsCount
        return 4 + Math.max(1, optionsCount)
    },

    render(buffer: ScreenBuffer, props: AskQuestionMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )

        const questions = props.questions || []
        const currentQ = questions[props.currentQuestionIndex]
        if (!currentQ) return

        const isMulti = Boolean(currentQ.is_multi_select)
        const options = currentQ.options || []

        // 1. Question Header
        const qNumStr = `Q${props.currentQuestionIndex + 1}/${questions.length}: `
        drawText(buffer, qNumStr, {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })

        const maxQWidth = Math.max(10, width - qNumStr.length)
        drawText(buffer, currentQ.question, {
            x: x + qNumStr.length,
            y,
            maxWidth: maxQWidth,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        // 2. Divider
        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        // 3. Options List
        for (let idx = 0; idx < options.length; idx++) {
            const opt = options[idx]
            const isHighlighted = idx === props.selectedIndex
            const isChecked = props.selectedMultiIndices
                ? props.selectedMultiIndices.has(idx)
                : false
            const rowY = y + idx

            // Selector
            const selector = isHighlighted ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: { fg: isHighlighted ? THEME.colors.brand : THEME.colors.muted },
            })

            let optOffsetX = x + 2

            // Number hint (1-9)
            if (idx < 9) {
                const numHint = `(${idx + 1}) `
                drawText(buffer, numHint, {
                    x: optOffsetX,
                    y: rowY,
                    style: { fg: THEME.colors.dim },
                })
                optOffsetX += numHint.length
            }

            // Checkbox for multi-select
            if (isMulti) {
                const checkStr = isChecked ? '[x] ' : '[ ] '
                drawText(buffer, checkStr, {
                    x: optOffsetX,
                    y: rowY,
                    style: {
                        fg: isChecked ? THEME.colors.success : THEME.colors.muted,
                        bold: isChecked,
                    },
                })
                optOffsetX += checkStr.length
            }

            // Option text
            const maxOptWidth = Math.max(10, width - (optOffsetX - x))
            drawText(buffer, opt, {
                x: optOffsetX,
                y: rowY,
                maxWidth: maxOptWidth,
                style: {
                    fg: isHighlighted
                        ? THEME.colors.brand
                        : isChecked
                          ? THEME.colors.success
                          : THEME.colors.text,
                    bold: isHighlighted || isChecked,
                },
            })
        }
        y += options.length

        // 4. Divider
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

        // 5. Footer
        const footerItems = isMulti
            ? [
                  { key: '↑/↓', label: 'navigate' },
                  { key: 'space', label: 'toggle' },
                  { key: '1-9', label: 'quick select' },
                  { key: 'enter', label: 'confirm' },
                  { key: 'esc', label: props.currentQuestionIndex > 0 ? 'back' : 'cancel' },
              ]
            : [
                  { key: '↑/↓', label: 'navigate' },
                  { key: '1-9', label: 'quick select' },
                  { key: 'enter', label: 'select' },
                  { key: 'esc', label: props.currentQuestionIndex > 0 ? 'back' : 'cancel' },
              ]

        MenuFooterView.render(buffer, {
            x,
            y: footerY,
            width,
            items: footerItems,
        })
    },
}
