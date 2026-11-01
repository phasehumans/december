import {
    BYOK_PROVIDER_ITEMS,
    SUBSCRIPTION_PROVIDER_ITEMS,
    type ProviderMenuItem,
} from '../../constants/providers'
import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'

import type { ScreenBuffer } from '../buffer'

export type AuthViewMode =
    | 'menu'
    | 'subscription'
    | 'byok_provider'
    | 'byok_key'
    | 'switch'
    | 'confirm_switch_subscription'
    | 'confirm_replace_byok'

export type ProviderItem = ProviderMenuItem

export const AUTH_PROVIDER_WINDOW_SIZE = 7

export interface AuthMenuViewProps {
    x?: number
    y: number
    width: number
    height?: number
    mode: AuthViewMode
    userEmail?: string
    decemberEmail?: string
    hasDecember?: boolean
    currentEmail?: string
    isAuthenticated?: boolean
    authMethod?: string
    selectedProvider?: string
    title?: string
    // BYOK Provider mode
    providers?: ProviderItem[]
    providerSelectedIndex?: number
    providerWindowStart?: number
    providerSearchQuery?: string
    isSearchingProviders?: boolean
    // BYOK Key mode
    activeProviderName?: string
    providerKeyUrl?: string
    providerKeyNote?: string
    apiKeyInput?: string
    apiKeyMasked?: boolean
    keyError?: string | null
    // Menu mode
    menuSelectedIndex?: number
    confirmSwitchAccount?: boolean
    // Credential management & confirmation
    confirmDeleteValue?: string | null
    confirmTarget?: { label: string; value: string; account?: string } | null
    configuredSubscriptionValues?: string[]
    configuredProviderValues?: string[]
}

export const MAIN_MENU_OPTIONS = [
    {
        label: 'Use your own Subscription',
        description: 'Connect an AI subscription (Claude, Copilot, Antigravity, ChatGPT)',
        value: 'subscription',
    },
    {
        label: 'Use your own API Key (BYOK)',
        description: 'Bring your own API key (OpenAI, Anthropic, Gemini, Groq, etc.)',
        value: 'byok',
    },
    {
        label: 'Login via December Account',
        description: 'Sign in with your December Cloud account and wallet credits',
        value: 'december',
    },
]

export const DEFAULT_AUTH_PROVIDERS: ProviderItem[] = BYOK_PROVIDER_ITEMS

export const AuthMenuView = {
    getFilteredProviders(providers: ProviderItem[], query: string): ProviderItem[] {
        if (!query.trim()) return providers
        const q = query.toLowerCase().trim()
        return providers.filter(
            (p) => p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
        )
    },

    getHeight(mode: AuthViewMode, _itemsCount = 7): number {
        if (mode === 'menu') {
            return 7
        }
        if (mode === 'subscription') {
            return 8
        }
        if (mode === 'byok_key') {
            return 7
        }
        if (mode === 'confirm_switch_subscription' || mode === 'confirm_replace_byok') {
            return 6
        }
        // byok_provider or switch
        return 12
    },

    render(buffer: ScreenBuffer, props: AuthMenuViewProps): void {
        const x = (props.x ?? 0) + (THEME.padding.paddingLeft ?? 2)
        let y = props.y
        const width = Math.max(
            20,
            props.width - (THEME.padding.paddingLeft ?? 2) - (THEME.padding.paddingRight ?? 2)
        )

        if (props.mode === 'menu') {
            // Mode 1: Main Auth Menu (matching earlier MenuMenu)
            drawText(buffer, 'Authentication', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

            const email =
                props.decemberEmail || props.userEmail || props.currentEmail || 'December user'
            const isDecemberLoggedIn = Boolean(
                props.hasDecember !== undefined
                    ? props.hasDecember && (props.decemberEmail || props.userEmail)
                    : props.isAuthenticated &&
                          (props.decemberEmail || props.userEmail) &&
                          (props.authMethod === 'december' || !props.authMethod)
            )

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

                let labelEnd = x + 2 + opt.label.length
                if (opt.value === 'december' && isDecemberLoggedIn) {
                    const statusText = ` (Logged in as ${email})`
                    drawText(buffer, statusText, {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: THEME.colors.success },
                    })
                    labelEnd += statusText.length
                }

                if (opt.description && width > 70) {
                    const descX = Math.max(labelEnd + 2, x + 35)
                    drawText(buffer, opt.description, {
                        x: descX,
                        y: rowY,
                        maxWidth: width - descX - 1,
                        style: { fg: THEME.colors.subtle },
                    })
                }
            }

            const footerY = props.y + (props.height ?? this.getHeight('menu')) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width: props.width,
                items: [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: 'select' },
                    { key: 'esc', label: 'close' },
                ],
            })
            return
        }

        if (props.mode === 'subscription') {
            drawText(buffer, 'AI Subscriptions', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

            const subs = SUBSCRIPTION_PROVIDER_ITEMS
            const configuredSubs = props.configuredSubscriptionValues || []
            const safeIdx = Math.min(props.providerSelectedIndex || 0, Math.max(0, subs.length - 1))
            const selectedItem = subs[safeIdx]
            const isSelectedConfigured = selectedItem && configuredSubs.includes(selectedItem.value)

            for (let i = 0; i < subs.length; i++) {
                const item = subs[i]
                const isSelected = i === safeIdx
                const isConfigured = configuredSubs.includes(item.value)
                const isCurrent =
                    item.value === props.selectedProvider &&
                    (!props.authMethod || props.authMethod === 'subscription')
                const isConfirmingDelete =
                    props.confirmDeleteValue === `subscription:${item.value}` ||
                    props.confirmDeleteValue === item.value
                const rowY = y + i

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                const labelText = item.label
                let badge = ''
                let badgeColor: string = THEME.colors.muted
                if (isCurrent) {
                    badge = ' (active)'
                    badgeColor = THEME.colors.success
                } else if (isConfigured) {
                    badge = ' (connected)'
                    badgeColor = THEME.colors.brand
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

                let labelEnd = x + 2 + labelText.length
                if (badge) {
                    drawText(buffer, badge, {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: badgeColor },
                    })
                    labelEnd += badge.length
                }

                if (isConfirmingDelete) {
                    drawText(buffer, ' [Disconnect? (y/n)]', {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: THEME.colors.error, bold: true },
                    })
                }
            }

            const footerY = props.y + (props.height ?? this.getHeight('subscription')) - 1
            const footerItems = props.confirmDeleteValue
                ? [
                      { key: 'y', label: 'confirm' },
                      { key: 'n / esc', label: 'cancel' },
                  ]
                : isSelectedConfigured
                  ? [
                        { key: '↑/↓', label: 'navigate' },
                        { key: 'enter', label: 'select' },
                        { key: 'd', label: 'disconnect' },
                        { key: 'esc', label: 'back' },
                    ]
                  : [
                        { key: '↑/↓', label: 'navigate' },
                        { key: 'enter', label: 'connect' },
                        { key: 'esc', label: 'back' },
                    ]

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width: props.width,
                items: footerItems,
            })
            return
        }

        if (props.mode === 'confirm_switch_subscription') {
            const target = props.confirmTarget || { label: 'Subscription', value: '' }
            const accountSuffix =
                target.account && target.account !== 'local session' ? ` (${target.account})` : ''

            drawText(buffer, 'Existing Credentials Detected', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

            drawText(buffer, `Credentials detected for ${target.label}${accountSuffix}.`, {
                x,
                y,
                maxWidth: width,
                style: { fg: THEME.colors.text },
            })
            y += 1

            drawText(buffer, 'Do you want to switch to a different account? (y/n)', {
                x,
                y,
                maxWidth: width,
                style: { fg: THEME.colors.warning },
            })

            const footerY =
                props.y + (props.height ?? this.getHeight('confirm_switch_subscription')) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width: props.width,
                items: [
                    { key: 'y', label: 'switch account' },
                    { key: 'n / enter', label: 'keep current' },
                    { key: 'esc', label: 'cancel' },
                ],
            })
            return
        }

        if (props.mode === 'byok_key') {
            // Mode 2: BYOK Key Input (matching earlier ByokKeyMenu)
            const pName = props.activeProviderName || 'Provider'
            drawText(buffer, `Enter API Key for ${pName}:`, {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 1

            const keyUrl = props.providerKeyUrl
            if (keyUrl) {
                const note = props.providerKeyNote || ''
                const prefix = "Don't have an API key? Get one at "
                drawText(buffer, prefix, {
                    x,
                    y,
                    style: { fg: THEME.colors.muted },
                })
                drawText(buffer, `${keyUrl}${note}`, {
                    x: x + prefix.length,
                    y,
                    maxWidth: Math.max(10, props.width - x - prefix.length),
                    style: { fg: THEME.colors.brand },
                })
                y += 1
            }

            y += 1

            // Key Input Box with prompt glyph ›
            const rawKey = props.apiKeyInput || ''
            const displayKey = props.apiKeyMasked !== false ? '•'.repeat(rawKey.length) : rawKey
            const cursorGlyph = '█'

            const promptGlyph = `${THEME.glyphs.prompt} `
            drawText(buffer, promptGlyph, {
                x,
                y,
                style: { fg: THEME.colors.brand },
            })
            drawText(buffer, `${displayKey}${cursorGlyph}`, {
                x: x + promptGlyph.length,
                y,
                maxWidth: Math.max(10, width - promptGlyph.length),
                style: { fg: THEME.colors.text },
            })
            y += 1

            if (props.keyError) {
                y += 1
                drawText(buffer, props.keyError, {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.error },
                })
            }

            const footerY = (props.y ?? 0) + (props.height ?? buffer.height) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width: props.width,
                items: [
                    { key: 'enter', label: 'submit' },
                    { key: 'esc', label: 'close' },
                ],
            })
            return
        }

        if (props.mode === 'confirm_replace_byok') {
            const target = props.confirmTarget || { label: 'Provider', value: '' }

            drawText(buffer, 'Configured Key Detected', {
                x,
                y,
                style: { fg: THEME.colors.text, bold: true },
            })
            y += 2

            drawText(buffer, `An API key for ${target.label} is already configured.`, {
                x,
                y,
                maxWidth: width,
                style: { fg: THEME.colors.text },
            })
            y += 1

            drawText(buffer, 'Do you want to replace it with a new key? (y/n)', {
                x,
                y,
                maxWidth: width,
                style: { fg: THEME.colors.warning },
            })

            const footerY = props.y + (props.height ?? this.getHeight('confirm_replace_byok')) - 1
            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width: props.width,
                items: [
                    { key: 'y', label: 'enter new key' },
                    { key: 'n / enter', label: 'use existing key' },
                    { key: 'esc', label: 'cancel' },
                ],
            })
            return
        }

        // Mode 3: Provider List (matching earlier ByokProviderMenu)
        const isSwitch = props.mode === 'switch'
        const title = props.title || (isSwitch ? 'Switch Active Provider' : 'Providers')

        drawText(buffer, title, {
            x,
            y,
            style: { fg: THEME.colors.text, bold: true },
        })
        y += 1

        const q = props.providerSearchQuery || ''
        const searchLabel = 'Search: '
        drawText(buffer, searchLabel, {
            x,
            y,
            style: { fg: props.isSearchingProviders ? THEME.colors.brand : THEME.colors.muted },
        })
        const searchHint = q ? `${q} ` : props.isSearchingProviders ? '' : '[/ to filter]'
        drawText(buffer, searchHint, {
            x: x + searchLabel.length,
            y,
            style: { fg: q ? THEME.colors.brand : THEME.colors.dim },
        })
        y += 1

        const providers = AuthMenuView.getFilteredProviders(
            props.providers && props.providers.length > 0
                ? props.providers
                : DEFAULT_AUTH_PROVIDERS,
            q
        )
        const totalItems = providers.length

        const windowSize = AUTH_PROVIDER_WINDOW_SIZE
        const windowStart = Math.max(
            0,
            Math.min(props.providerWindowStart || 0, Math.max(0, totalItems - windowSize))
        )
        const windowEnd = Math.min(windowStart + windowSize, totalItems)
        const visible = providers.slice(windowStart, windowEnd)

        const configuredKeys = props.configuredProviderValues || []
        const safeSelectedIdx = Math.min(
            props.providerSelectedIndex || 0,
            Math.max(0, totalItems - 1)
        )
        const selectedProviderItem = providers[safeSelectedIdx]
        const isSelectedProviderConfigured =
            selectedProviderItem && configuredKeys.includes(selectedProviderItem.value)

        if (totalItems === 0) {
            drawText(buffer, '  No matching providers found.', {
                x,
                y,
                style: { fg: THEME.colors.muted },
            })
        } else {
            for (let i = 0; i < visible.length; i++) {
                const item = visible[i]
                const absIdx = windowStart + i
                const isSelected = absIdx === safeSelectedIdx
                const isConfigured = configuredKeys.includes(item.value)
                const isCurrent =
                    item.value === props.selectedProvider &&
                    (!props.authMethod || props.authMethod === 'byok' || props.mode === 'switch')
                const isConfirmingDelete =
                    props.confirmDeleteValue === `provider:${item.value}` ||
                    props.confirmDeleteValue === `byok:${item.value}` ||
                    props.confirmDeleteValue === item.value
                const rowY = y + i

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.muted },
                })

                const labelText = item.label
                let badge = ''
                let badgeColor: string = THEME.colors.muted
                if (item.status) {
                    badge = ` ${item.status}`
                    badgeColor = THEME.colors.muted
                } else if (isCurrent) {
                    badge = ' (active)'
                    badgeColor = THEME.colors.success
                } else if (isConfigured) {
                    badge = ' (configured)'
                    badgeColor = THEME.colors.brand
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

                let labelEnd = x + 2 + labelText.length
                if (badge) {
                    drawText(buffer, badge, {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: badgeColor },
                    })
                    labelEnd += badge.length
                }

                if (isConfirmingDelete) {
                    drawText(buffer, ' [Delete? (y/n)]', {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: THEME.colors.error, bold: true },
                    })
                }
            }
        }

        const scrollStatusY = y + windowSize
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
                    y: scrollStatusY,
                    style: { fg: THEME.colors.subtle },
                })
            }
        }

        const footerItems = props.confirmDeleteValue
            ? [
                  { key: 'y', label: 'confirm' },
                  { key: 'n / esc', label: 'cancel' },
              ]
            : props.isSearchingProviders
              ? [
                    { key: 'enter / ↓', label: 'focus list' },
                    { key: 'esc', label: 'exit search' },
                ]
              : isSelectedProviderConfigured
                ? [
                      { key: '↑/↓', label: 'navigate' },
                      { key: 'enter', label: 'select' },
                      { key: 'd', label: 'delete' },
                      { key: '/', label: 'search' },
                      { key: 'esc', label: 'back' },
                  ]
                : [
                      { key: '↑/↓', label: 'navigate' },
                      { key: 'enter', label: 'select' },
                      { key: '/', label: 'search' },
                      { key: 'esc', label: 'back' },
                  ]

        const footerY = (props.y ?? 0) + (props.height ?? this.getHeight('byok_provider')) - 1
        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width: props.width,
            items: footerItems,
        })
    },
}
