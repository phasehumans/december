import { THEME } from '../../theme'
import { drawDivider, drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type AuthViewMode = 'menu' | 'byok_provider' | 'byok_key' | 'switch'

export interface ProviderItem {
    label: string
    value: string
    isSubscription?: boolean
}

export const AUTH_PROVIDER_WINDOW_SIZE = 7

export interface AuthMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    mode: AuthViewMode
    userEmail?: string
    currentEmail?: string
    isAuthenticated?: boolean
    authMethod?: string
    selectedProvider?: string
    // BYOK Provider mode
    providers?: ProviderItem[]
    providerSelectedIndex?: number
    providerWindowStart?: number
    providerSearchQuery?: string
    isSearchingProviders?: boolean
    // BYOK Key mode
    activeProviderName?: string
    apiKeyInput?: string
    apiKeyMasked?: boolean
    keyError?: string | null
    // Menu mode
    menuSelectedIndex?: number
    confirmSwitchAccount?: boolean
}

export const MAIN_MENU_OPTIONS = [
    { label: 'Use your own Key or Subscription (BYOK)', value: 'byok' },
    { label: 'Login via December Account', value: 'december' },
]

export const DEFAULT_AUTH_PROVIDERS: ProviderItem[] = [
    { label: 'Anthropic (Claude)', value: 'anthropic' },
    { label: 'OpenAI (GPT-4o, o3)', value: 'openai' },
    { label: 'Google Gemini', value: 'gemini' },
    { label: 'OpenRouter', value: 'openrouter' },
    { label: 'Groq', value: 'groq' },
    { label: 'Mistral AI', value: 'mistral' },
    { label: 'DeepSeek', value: 'deepseek' },
    { label: 'Ollama (Local)', value: 'ollama' },
]

export const AuthMenuView = {
    getFilteredProviders(providers: ProviderItem[], query: string): ProviderItem[] {
        if (!query.trim()) return providers
        const q = query.toLowerCase().trim()
        return providers.filter(
            (p) => p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
        )
    },

    getHeight(mode: AuthViewMode, itemsCount = 7): number {
        if (mode === 'menu') {
            return 8
        }
        if (mode === 'byok_key') {
            return 9
        }
        // byok_provider or switch
        const listRows = Math.min(Math.max(itemsCount, 1), AUTH_PROVIDER_WINDOW_SIZE)
        return 6 + listRows
    },

    render(buffer: ScreenBuffer, props: AuthMenuViewProps): void {
        const x = (props.x ?? 0) + THEME.padding.paddingLeft
        let y = props.y
        const width = Math.max(
            20,
            props.width - THEME.padding.paddingLeft - THEME.padding.paddingRight
        )

        if (props.mode === 'menu') {
            // Mode 1: Main Auth Menu
            drawText(buffer, 'Authentication & Model Access', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1

            const email = props.userEmail || props.currentEmail
            const statusLine = props.isAuthenticated
                ? `Logged in as ${email || 'December User'} (${props.authMethod || 'BYOK'})`
                : 'Not authenticated · Select an option below to get started'
            drawText(buffer, statusLine, {
                x,
                y,
                maxWidth: width,
                style: { fg: props.isAuthenticated ? THEME.colors.success : THEME.colors.muted },
            })
            y += 1

            drawDivider(buffer, {
                x,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 1

            for (let i = 0; i < MAIN_MENU_OPTIONS.length; i++) {
                const opt = MAIN_MENU_OPTIONS[i]
                const isSelected = i === (props.menuSelectedIndex || 0)
                const rowY = y + i

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                drawText(buffer, opt.label, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: {
                        fg: isSelected ? THEME.colors.brand : THEME.colors.text,
                        bold: isSelected,
                    },
                })
            }
            y += MAIN_MENU_OPTIONS.length

            drawDivider(buffer, {
                x,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 1

            MenuFooterView.render(buffer, {
                x,
                y,
                width,
                items: [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'select' },
                    { key: 'esc', label: 'close' },
                ],
            })
            return
        }

        if (props.mode === 'byok_key') {
            // Mode 2: BYOK Key Input
            const pName = props.activeProviderName || 'Provider'
            drawText(buffer, `Enter API Key for ${pName}`, {
                x,
                y,
                style: { fg: THEME.colors.brand, bold: true },
            })
            y += 1

            drawText(
                buffer,
                'Your key is saved locally in ~/.december/config.json and never logged.',
                {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.muted },
                }
            )
            y += 1

            drawDivider(buffer, {
                x,
                y,
                width,
                char: '─',
                style: { fg: THEME.colors.border },
            })
            y += 1

            // Key Input Box
            const rawKey = props.apiKeyInput || ''
            const displayKey = props.apiKeyMasked !== false ? '•'.repeat(rawKey.length) : rawKey
            const cursorGlyph = '█'

            drawText(buffer, 'API Key: ', {
                x,
                y,
                style: { fg: THEME.colors.muted, bold: true },
            })
            drawText(buffer, `${displayKey}${cursorGlyph}`, {
                x: x + 9,
                y,
                maxWidth: Math.max(10, width - 10),
                style: { fg: THEME.colors.brand, bold: true },
            })
            y += 1

            if (props.keyError) {
                drawText(buffer, `Error: ${props.keyError}`, {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.error },
                })
            } else {
                drawText(buffer, 'Press [Enter] to validate and save, or [Esc] to cancel.', {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.dim },
                })
            }
            y += 1

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

            MenuFooterView.render(buffer, {
                x,
                y: footerY,
                width,
                items: [
                    { key: 'enter', label: 'save & test' },
                    { key: 'esc', label: 'back' },
                ],
            })
            return
        }

        // Mode 3: Provider List (byok_provider or switch)
        const isSwitch = props.mode === 'switch'
        const title = isSwitch ? 'Switch Active Provider' : 'Select Provider (BYOK)'

        drawText(buffer, title, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        const q = props.providerSearchQuery || ''
        const searchLabel = props.isSearchingProviders ? 'Search: ' : 'Filter: '
        drawText(buffer, searchLabel, {
            x,
            y,
            style: { fg: props.isSearchingProviders ? THEME.colors.brand : THEME.colors.muted },
        })
        drawText(buffer, q ? `${q} ` : props.isSearchingProviders ? '' : '[/ to filter]', {
            x: x + searchLabel.length,
            y,
            style: { fg: q ? THEME.colors.brand : THEME.colors.dim },
        })
        y += 1

        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        const providers = AuthMenuView.getFilteredProviders(props.providers || [], q)
        const totalItems = providers.length

        if (totalItems === 0) {
            drawText(buffer, '  No matching providers found.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
            y += 1
        } else {
            const windowSize = AUTH_PROVIDER_WINDOW_SIZE
            const windowStart = Math.max(
                0,
                Math.min(props.providerWindowStart || 0, Math.max(0, totalItems - windowSize))
            )
            const windowEnd = Math.min(windowStart + windowSize, totalItems)
            const visible = providers.slice(windowStart, windowEnd)

            for (let i = 0; i < visible.length; i++) {
                const item = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === (props.providerSelectedIndex || 0)
                const isCurrent = item.value === props.selectedProvider
                const rowY = y + i

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                let labelText = item.label
                if (isCurrent) {
                    labelText += ' (active)'
                }

                drawText(buffer, labelText, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: {
                        fg: isCurrent
                            ? THEME.colors.success
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text,
                        bold: isSelected || isCurrent,
                    },
                })
            }
            y += visible.length

            if (totalItems > windowSize) {
                const itemsAbove = windowStart
                const itemsBelow = totalItems - windowEnd
                let statusText = ''
                if (itemsAbove > 0 && itemsBelow > 0) {
                    statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
                } else if (itemsAbove > 0) {
                    statusText = `↑ ${itemsAbove} more`
                } else if (itemsBelow > 0) {
                    statusText = `↓ ${itemsBelow} more`
                }
                if (statusText) {
                    drawText(buffer, statusText, {
                        x: x + 2,
                        y,
                        style: { fg: THEME.colors.subtle },
                    })
                    y += 1
                }
            }
        }

        drawDivider(buffer, {
            x,
            y,
            width,
            char: '─',
            style: { fg: THEME.colors.border },
        })
        y += 1

        MenuFooterView.render(buffer, {
            x,
            y,
            width,
            items: [
                { key: '↑/↓', label: 'navigate' },
                { key: '/', label: 'search' },
                { key: 'enter', label: 'select' },
                { key: 'esc', label: 'close' },
            ],
        })
    },
}
