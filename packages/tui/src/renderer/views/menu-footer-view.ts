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
    /**
     * The items that fit on one line. When the footer is too wide, keys drop from the right,
     * and the Esc item always stays, so the footer never ends mid-word.
     */
    fitItems(items: MenuFooterItem[], width: number): MenuFooterItem[] {
        const size = (list: MenuFooterItem[]) =>
            list.reduce((n, it, i) => n + (i > 0 ? 3 : 0) + it.key.length + 1 + it.label.length, 0)
        if (size(items) <= width) return items
        const escIndex = items.findIndex((it) => /^esc\b|\/esc\b|esc$/.test(it.key))
        const esc = escIndex >= 0 ? items[escIndex] : undefined
        const rest = items.filter((_, i) => i !== escIndex)
        while (rest.length > 0 && size(esc ? [...rest, esc] : rest) > width) rest.pop()
        return esc ? [...rest, esc] : rest
    },

    render(buffer: ScreenBuffer, props: MenuFooterViewProps): void {
        if (!props.items || props.items.length === 0) return

        let currentX = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        const y = props.y
        const available = Math.max(10, props.width - (THEME.padding.paddingLeft ?? 2))
        const items = MenuFooterView.fitItems(props.items, available)

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            if (i > 0) {
                drawText(buffer, ' · ', {
                    x: currentX,
                    y,
                    style: { fg: THEME.colors.dim },
                })
                currentX += 3
            }

            drawText(buffer, item.key, {
                x: currentX,
                y,
                style: { fg: THEME.colors.brand },
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
