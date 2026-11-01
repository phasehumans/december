import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type LoginOptionValue = 'subscription' | 'byok' | 'december'

export interface LoginMenuItem {
    label: string
    value: LoginOptionValue
    desc?: string
}

export const LOGIN_OPTIONS: LoginMenuItem[] = [
    {
        label: 'Use your own Subscription',
        value: 'subscription',
        desc: 'Connect an AI subscription (Claude, Copilot, Antigravity, ChatGPT)',
    },
    {
        label: 'Use your own API Key (BYOK)',
        value: 'byok',
        desc: 'Bring your own API key (OpenAI, Anthropic, Gemini, Groq, etc.)',
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
    decemberEmail?: string
    hasDecember?: boolean
    isAuthenticated?: boolean
    authMethod?: string
}

export const LoginMenuView = {
    getHeight(confirmSwitch?: boolean): number {
        if (confirmSwitch) {
            return 6
        }
        // Title (1) + gap (1) + 3 options (3) + gap (1) + footer (1) = 7
        return 7
    },

    render(buffer: ScreenBuffer, props: LoginMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = props.width

        const email = props.decemberEmail || props.userEmail || 'December user'

        if (props.confirmSwitch) {
            drawText(buffer, 'Switch Account', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

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

            const footerY = props.y + (props.height ?? this.getHeight(true)) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width,
                items: [
                    { key: 'y', label: 'switch account' },
                    { key: 'n / enter', label: 'keep current' },
                    { key: 'esc', label: 'cancel' },
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
            props.hasDecember !== undefined
                ? props.hasDecember && (props.decemberEmail || props.userEmail)
                : props.isAuthenticated &&
                      (props.decemberEmail || props.userEmail) &&
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
                const loggedInStatus = `(Logged in as ${email})`
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
