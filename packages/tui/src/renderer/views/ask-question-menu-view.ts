import { THEME } from '../../theme'
import { drawText } from '../ui'

import { requestPanelCursor } from './panel'

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
    /** Text typed into the "Type your own answer…" row; null when not typing (S21) */
    customText?: string | null
}

export const AskQuestionMenuView = {
    getHeight(optionsCount: number): number {
        // question, blank, options, "Type your own answer…", footer
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

        // K9: no divider line above the prompt; the question row starts it

        // The question is the only bold text on screen (T3.6)
        const counter =
            questions.length > 1 ? `  ${props.currentQuestionIndex + 1} of ${questions.length}` : ''
        const maxQWidth = Math.max(10, width - counter.length)
        const questionText =
            currentQ.question.length > maxQWidth
                ? `${currentQ.question.slice(0, maxQWidth - 1)}…`
                : currentQ.question
        drawText(buffer, questionText, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (counter) {
            drawText(buffer, counter, {
                x: x + questionText.length,
                y,
                style: { fg: THEME.colors.dim },
            })
        }
        y += 2

        options.forEach((opt, idx) => {
            const isHighlighted = idx === props.selectedIndex
            const isChecked = props.selectedMultiIndices
                ? props.selectedMultiIndices.has(idx)
                : false
            let offsetX = x
            drawText(buffer, isHighlighted ? `${THEME.glyphs.selector} ` : '  ', {
                x: offsetX,
                y,
                style: { fg: THEME.colors.brand },
            })
            offsetX += 2
            if (isMulti) {
                drawText(buffer, isChecked ? '✓ ' : '○ ', {
                    x: offsetX,
                    y,
                    style: { fg: isChecked ? THEME.colors.success : THEME.colors.dim },
                })
                offsetX += 2
            }
            drawText(buffer, opt, {
                x: offsetX,
                y,
                maxWidth: Math.max(10, width - (offsetX - x)),
                style: { fg: isHighlighted ? THEME.colors.brand : THEME.colors.muted },
            })
            y += 1
        })

        // S21: the last row takes a typed answer
        const customHighlighted = props.selectedIndex === options.length
        const typing = props.customText !== null && props.customText !== undefined
        const customX = x + 2 + (isMulti ? 2 : 0)
        drawText(buffer, customHighlighted ? `${THEME.glyphs.selector} ` : '  ', {
            x,
            y,
            style: { fg: THEME.colors.brand },
        })
        if (typing) {
            requestPanelCursor(customX + (props.customText || '').length, y)
            drawText(buffer, props.customText || '', {
                x: customX,
                y,
                maxWidth: Math.max(10, width - (customX - x)),
                style: { fg: THEME.colors.text },
            })
        } else {
            drawText(buffer, 'Type your own answer…', {
                x: customX,
                y,
                style: { fg: customHighlighted ? THEME.colors.brand : THEME.colors.dim },
            })
        }
        y += 1

        const back = props.currentQuestionIndex > 0 ? 'back' : 'cancel'
        const pick = options.length > 1 ? ` · 1-${Math.min(9, options.length)} pick` : ''
        const footer = typing
            ? 'enter send · esc back to the options'
            : isMulti
              ? `space toggle · enter confirm${pick} · esc ${back}`
              : `enter select${pick} · esc ${back}`
        const height = props.height ?? buffer.height
        drawText(buffer, footer, {
            x,
            y: Math.min(y, (props.y ?? 0) + height - 1),
            maxWidth: width,
            style: { fg: THEME.colors.dim },
        })
    },
}
