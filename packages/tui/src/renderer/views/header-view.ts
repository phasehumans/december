import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'

export interface HeaderViewProps {
    x?: number
    y?: number
    width: number
    cliVersion?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    contextTokens?: number
    branch?: string
    cwd?: string
}

export const HeaderView = {
    render(buffer: ScreenBuffer, props: HeaderViewProps): void {
        const x = props.x ?? 0
        const y = props.y ?? 0
        const width = props.width

        const versionStr = props.cliVersion ? ` v${props.cliVersion.replace(/^v/, '')}` : ''
        const brandPrefix = '✱ December'

        // 1. Draw branding: ✱ December v0.4.15
        drawText(buffer, '✱ ', {
            x,
            y,
            style: { fg: THEME.colors.brand, bold: true },
        })
        drawText(buffer, 'December', {
            x: x + 2,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        if (versionStr) {
            drawText(buffer, versionStr, {
                x: x + 10,
                y,
                style: { fg: THEME.colors.subtle },
            })
        }

        // 2. Draw right-aligned pills: Model & Tokens
        const model = props.modelLabel || 'Gemini 3.7 Flash'
        const tokens = props.contextTokens !== undefined ? ` · ${props.contextTokens} tokens` : ''
        const rightText = `${model}${tokens}`

        const rightX = Math.max(x + 25, x + width - rightText.length - 1)
        drawText(buffer, rightText, {
            x: rightX,
            y,
            style: { fg: THEME.colors.muted },
        })

        // 3. Draw subtle bottom divider line
        drawDivider(buffer, {
            x,
            y: y + 1,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
    },
}
