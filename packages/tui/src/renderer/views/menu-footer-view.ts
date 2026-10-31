import { THEME } from '../../theme'
import { drawText } from '../ui'

import type { ScreenBuffer } from '../buffer'

export interface MenuFooterItem {
    key: string
    label: string
}

export interface MenuFooterViewProps {
    x?: number
    y: number
    width: number
    items: MenuFooterItem[]
}

export const MenuFooterView = {
    render(buffer: ScreenBuffer, props: MenuFooterViewProps): void {
        if (!props.items || props.items.length === 0) return

        let currentX = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        const y = props.y

        for (let i = 0; i < props.items.length; i++) {
            const item = props.items[i]
            if (i > 0) {
                drawText(buffer, ' · ', {
                    x: currentX,
                    y,
                    style: { fg: THEME.colors.subtle },
                })
                currentX += 3
            }

            drawText(buffer, item.key, {
                x: currentX,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            currentX += item.key.length

            drawText(buffer, ` ${item.label}`, {
                x: currentX,
                y,
                style: { fg: THEME.colors.muted },
            })
            currentX += item.label.length + 1
        }
    },
}
