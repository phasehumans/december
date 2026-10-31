import { THEME } from '../../theme'
import { drawBox, drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'
import type { CursorPosition } from '../types'

export interface InputBarViewProps {
    x?: number
    y: number
    width: number
    height?: number
    input: string
    cursorPos?: number
    placeholder?: string
    isStreaming?: boolean
}

export const InputBarView = {
    render(buffer: ScreenBuffer, props: InputBarViewProps): CursorPosition {
        const x = props.x ?? 0
        const y = props.y
        const width = props.width
        const height = props.height ?? 3
        const input = props.input
        const cursorPos = props.cursorPos ?? input.length
        const placeholder =
            props.placeholder ?? 'Ask December to build features, fix bugs, or work on your code...'

        // 1. Draw outer rounded box border
        drawBox(buffer, {
            x,
            y,
            width,
            height,
            borderStyle: 'rounded',
            borderColor: props.isStreaming ? THEME.colors.brand : THEME.colors.border,
        })

        // 2. Draw prompt content or placeholder
        const textY = y + 1
        const textX = x + 1

        if (!input && placeholder) {
            drawText(buffer, placeholder, {
                x: textX,
                y: textY,
                maxWidth: width - 2,
                style: { fg: THEME.colors.dim, italic: true },
            })
        } else {
            drawText(buffer, input, {
                x: textX,
                y: textY,
                maxWidth: width - 2,
                style: { fg: THEME.colors.text },
            })
        }

        // 3. Return calculated terminal cursor position
        return {
            x: textX + cursorPos,
            y: textY,
            visible: !props.isStreaming,
        }
    },
}
