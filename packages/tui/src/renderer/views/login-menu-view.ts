import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export interface LoginMenuItem {
    label: string
    value: 'byok' | 'december'
    desc?: string
}

export const LOGIN_OPTIONS: LoginMenuItem[] = [
    {
        label: 'Use your own Key or Subscription',
        value: 'byok',
        desc: 'Bring your own API key (OpenAI, Anthropic, Gemini) or AI subscription',
    },
    {
        label: 'Login via December',
        value: 'december',
        desc: 'Sign in with your December Cloud account and wallet credits',
    },
]

export interface LoginMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    selectedIndex: number
    confirmSwitch?: boolean
    userEmail?: string
    isAuthenticated?: boolean
    authMethod?: string
}

export const LoginMenuView = {
    getHeight(): number {
        // Title (1) + gap (1) + 2 options (2) + gap (1) + footer (1) = 6
        return 6
    },

    render(buffer: ScreenBuffer, props: LoginMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        if (props.confirmSwitch) {
            drawText(buffer, 'Switch Account', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

            const email = props.userEmail || 'December user'
            drawText(buffer, `Already logged in as ${email}.`, {
                x,
                y,
                style: { fg: THEME.colors.text },
            })
            y += 1
            drawText(buffer, 'Do you want to switch to a different account? (y/n)', {
                x,
                y,
                style: { fg: THEME.colors.warning, bold: true },
            })

            const footerY = props.y + (props.height ?? this.getHeight()) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: 'y', label: 'confirm' },
                    { key: 'n / esc', label: 'cancel' },
                ],
            })
            return
        }

        // Title: Authentication
        drawText(buffer, 'Authentication', {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 2

        const isDecemberLoggedIn = Boolean(
            props.isAuthenticated &&
            props.userEmail &&
            (props.authMethod === 'december' || !props.authMethod)
        )

        for (let i = 0; i < LOGIN_OPTIONS.length; i++) {
            const opt = LOGIN_OPTIONS[i]
            const isSelected = i === props.selectedIndex
            const rowY = y + i

            // Selector glyph
            const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
            drawText(buffer, selector, {
                x,
                y: rowY,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.muted,
                    bold: isSelected,
                },
            })

            // Option label
            drawText(buffer, opt.label, {
                x: x + 2,
                y: rowY,
                style: {
                    fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                    bold: isSelected,
                },
            })

            let labelOffset = x + 2 + opt.label.length
            if (opt.value === 'december' && isDecemberLoggedIn) {
                const loggedInStatus = `(Logged in as ${props.userEmail})`
                drawText(buffer, ` ${loggedInStatus}`, {
                    x: labelOffset,
                    y: rowY,
                    style: { fg: THEME.colors.success },
                })
                labelOffset += loggedInStatus.length + 1
            }

            // Description
            if (opt.desc) {
                const descX = Math.max(labelOffset + 2, x + 38)
                drawText(buffer, opt.desc, {
                    x: descX,
                    y: rowY,
                    maxWidth: Math.max(10, width - descX - 2),
                    style: { fg: THEME.colors.muted },
                })
            }
        }

        // Footer
        const footerY = props.y + (props.height ?? this.getHeight()) - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width,
            items: [
                { key: '↑/↓', label: 'navigate' },
                { key: 'enter', label: 'select' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
