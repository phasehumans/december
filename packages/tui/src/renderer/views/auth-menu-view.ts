import {
    BYOK_PROVIDER_ITEMS,
    SUBSCRIPTION_PROVIDER_ITEMS,
    type ProviderMenuItem,
} from '../../constants/providers'
import { THEME } from '../../theme'
import { drawText } from '../ui'

import { MenuFooterView } from './menu-footer-view'
import { drawInlineConfirm, drawListRow, drawPanelTitle, requestPanelCursor } from './panel'

import type { ScreenBuffer } from '../buffer'

export type AuthViewMode =
    | 'menu'
    | 'subscription'
    | 'byok_provider'
    | 'byok_key'
    | 'ollama_setup'
    | 'switch'
    | 'confirm_switch_subscription'
    | 'confirm_replace_byok'

export interface OllamaSetupAction {
    id: 'install' | 'download' | 'start' | 'custom_url' | 'pull_model' | 'pull_custom'
    label: string
    desc?: string
    modelId?: string
}

export interface OllamaSetupViewState {
    step:
        | 'checking'
        | 'not_installed'
        | 'installed_not_running'
        | 'no_models'
        | 'custom_url'
        | 'pull_custom'
    baseUrl: string
    installCommand?: string
    actions: OllamaSetupAction[]
    selectedIndex: number
    inputValue: string
    error?: string | null
    busyMessage?: string | null
    /** Where esc returns when opening Ollama setup from /switch vs /login BYOK */
    returnTo?: 'byok_provider' | 'switch'
}

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
    /** shows `Checking key...` while the provider answers */
    keyChecking?: boolean
    // Menu mode
    menuSelectedIndex?: number
    confirmSwitchAccount?: boolean
    // Credential management & confirmation
    confirmDeleteValue?: string | null
    confirmTarget?: { label: string; value: string; account?: string } | null
    configuredSubscriptionValues?: string[]
    configuredProviderValues?: string[]
    ollamaSetup?: OllamaSetupViewState | null
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

/**
 * M24: a key error says what happened and what to do. Known short messages get that
 * wording here; any other message is shown as it is.
 */
function describeKeyError(error: string): string {
    if (error === 'API key cannot be empty')
        return 'No key entered. Paste your API key, then press enter.'
    return error
}

export const AuthMenuView = {
    getFilteredProviders(providers: ProviderItem[], query: string): ProviderItem[] {
        if (!query.trim()) return providers
        const q = query.toLowerCase().trim()
        return providers.filter(
            (p) => p.label.toLowerCase().includes(q) || p.value.toLowerCase().includes(q)
        )
    },

    getHeight(
        mode: AuthViewMode,
        _itemsCount = 7,
        ollamaSetup?: OllamaSetupViewState | null
    ): number {
        if (mode === 'menu') {
            return 7
        }
        if (mode === 'subscription') {
            return Math.max(8, SUBSCRIPTION_PROVIDER_ITEMS.length + 4)
        }
        if (mode === 'byok_key') {
            return 7
        }
        if (mode === 'ollama_setup') {
            const step = ollamaSetup?.step
            if (step === 'checking') return 6
            if (step === 'custom_url' || step === 'pull_custom') return 7
            if (step === 'not_installed') {
                return Math.max(12, 10 + (ollamaSetup?.actions.length ?? 2))
            }
            if (step === 'installed_not_running') {
                return Math.max(8, 6 + (ollamaSetup?.actions.length ?? 2))
            }
            if (step === 'no_models') {
                return Math.max(9, 6 + (ollamaSetup?.actions.length ?? 4))
            }
            return 10
        }
        if (mode === 'confirm_switch_subscription' || mode === 'confirm_replace_byok') {
            return 6
        }
        // byok_provider or switch
        return 13
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
            drawPanelTitle(buffer, { x, y, title: 'Authentication', width })
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
                    style: { fg: THEME.colors.brand },
                })

                drawText(buffer, opt.label, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
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
                        ellipsis: true,
                        style: { fg: THEME.colors.muted },
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
            drawPanelTitle(buffer, { x, y, title: 'AI Subscriptions', width })
            y += 2

            const subs = SUBSCRIPTION_PROVIDER_ITEMS
            const configuredSubs = props.configuredSubscriptionValues || []
            const safeIdx = Math.min(props.providerSelectedIndex || 0, Math.max(0, subs.length - 1))
            const selectedItem = subs[safeIdx]
            const isSelectedConfigured = selectedItem && configuredSubs.includes(selectedItem.value)
            const footerY = props.y + (props.height ?? this.getHeight('subscription')) - 1

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
                if (rowY >= footerY) {
                    break
                }

                const selector = isSelected ? `${THEME.glyphs.selector} ` : '  '
                drawText(buffer, selector, {
                    x,
                    y: rowY,
                    style: { fg: THEME.colors.brand },
                })

                const labelText = item.label
                let badge = ''
                let badgeColor: string = THEME.colors.muted
                if (isCurrent) {
                    badge = ' active'
                    badgeColor = THEME.colors.success
                } else if (isConfigured) {
                    badge = ' connected'
                    badgeColor = THEME.colors.muted
                }

                drawText(buffer, labelText, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
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
                    drawInlineConfirm(buffer, {
                        x: labelEnd,
                        y: rowY,
                        text: ' [Disconnect? (y/n)]',
                        tone: 'danger',
                    })
                }
            }

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

            drawPanelTitle(buffer, { x, y, title: 'Existing Credentials Detected', width })
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
            // M24: "<Provider> API key", the link in brand, a cursor cell, the error in red
            const pName = props.activeProviderName || 'Provider'
            drawPanelTitle(buffer, { x, y, title: `${pName} API key`, width })
            y += 1

            const keyUrl = props.providerKeyUrl
            if (keyUrl) {
                const prefix = 'Get a key at '
                const link = keyUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
                drawText(buffer, prefix, { x, y, style: { fg: THEME.colors.muted } })
                const linkResult = drawText(buffer, link, {
                    x: x + prefix.length,
                    y,
                    maxWidth: Math.max(0, width - prefix.length),
                    style: { fg: THEME.colors.brand },
                })
                if (props.providerKeyNote) {
                    drawText(buffer, props.providerKeyNote, {
                        x: linkResult.x,
                        y,
                        maxWidth: Math.max(0, x + width - linkResult.x),
                        style: { fg: THEME.colors.muted },
                    })
                }
                y += 1
            }

            y += 1

            // Key field: the prompt glyph, the masked key, and a surface cell for the cursor
            const rawKey = props.apiKeyInput || ''
            const displayKey = props.apiKeyMasked !== false ? '•'.repeat(rawKey.length) : rawKey
            const promptGlyph = `${THEME.glyphs.prompt} `
            drawText(buffer, promptGlyph, { x, y, style: { fg: THEME.colors.brand } })
            const fieldRoom = Math.max(10, width - promptGlyph.length - 1)
            const shownKey =
                displayKey.length > fieldRoom
                    ? displayKey.slice(displayKey.length - fieldRoom)
                    : displayKey
            const keyResult = drawText(buffer, shownKey, {
                x: x + promptGlyph.length,
                y,
                style: { fg: THEME.colors.text },
            })
            // G11: the real terminal cursor, placed by the app
            requestPanelCursor(keyResult.x, y)
            y += 1

            if (props.keyChecking) {
                drawText(buffer, `Checking key with ${pName}...`, {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.muted },
                })
            } else if (props.keyError) {
                drawText(buffer, describeKeyError(props.keyError), {
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

        if (props.mode === 'ollama_setup') {
            const state = props.ollamaSetup
            const step = state?.step ?? 'checking'
            const baseHost = (state?.baseUrl || 'http://localhost:11434/v1')
                .replace(/^https?:\/\//i, '')
                .replace(/\/v1\/?$/i, '')
            const footerY =
                (props.y ?? 0) + (props.height ?? this.getHeight('ollama_setup', 0, state)) - 1

            if (step === 'checking') {
                drawPanelTitle(buffer, {
                    x,
                    y,
                    title: 'Ollama',
                    meta: `checking ${baseHost}`,
                    width,
                })
                y += 2
                drawText(buffer, state?.busyMessage || 'Detecting local Ollama server...', {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.muted },
                })
                MenuFooterView.render(buffer, {
                    x: props.x ?? 0,
                    y: footerY,
                    width: props.width,
                    items: [{ key: 'esc', label: 'back' }],
                })
                return
            }

            if (step === 'custom_url' || step === 'pull_custom') {
                const isUrl = step === 'custom_url'
                drawPanelTitle(buffer, {
                    x,
                    y,
                    title: isUrl ? 'Ollama Server URL' : 'Pull Ollama Model',
                    width,
                })
                y += 1
                drawText(
                    buffer,
                    isUrl
                        ? 'Enter the base URL for your Ollama server'
                        : 'Enter an Ollama model tag (e.g. qwen3:8b, llama3.1:8b)',
                    { x, y, maxWidth: width, style: { fg: THEME.colors.muted } }
                )
                y += 2

                const rawVal = state?.inputValue || ''
                const promptGlyph = `${THEME.glyphs.prompt} `
                drawText(buffer, promptGlyph, { x, y, style: { fg: THEME.colors.brand } })
                const fieldRoom = Math.max(10, width - promptGlyph.length - 1)
                const shownVal =
                    rawVal.length > fieldRoom ? rawVal.slice(rawVal.length - fieldRoom) : rawVal
                const valRes = drawText(buffer, shownVal, {
                    x: x + promptGlyph.length,
                    y,
                    style: { fg: THEME.colors.text },
                })
                requestPanelCursor(valRes.x, y)
                y += 1

                if (state?.error) {
                    drawText(buffer, state.error, {
                        x,
                        y,
                        maxWidth: width,
                        style: { fg: THEME.colors.error },
                    })
                }

                MenuFooterView.render(buffer, {
                    x: props.x ?? 0,
                    y: footerY,
                    width: props.width,
                    items: [
                        { key: 'enter', label: isUrl ? 'connect' : 'pull' },
                        { key: 'esc', label: 'back' },
                    ],
                })
                return
            }

            const title = step === 'no_models' ? 'Ollama Models' : 'Ollama Setup'
            const meta =
                step === 'no_models'
                    ? '0 models installed'
                    : step === 'installed_not_running'
                      ? 'installed · server not running'
                      : `not detected on ${baseHost}`
            drawPanelTitle(buffer, { x, y, title, meta, width })
            y += 2

            const actions = state?.actions || []
            const safeIdx = Math.min(state?.selectedIndex || 0, Math.max(0, actions.length - 1))
            for (let i = 0; i < actions.length; i++) {
                const act = actions[i]
                if (y >= footerY - 1) break
                drawListRow(buffer, {
                    x,
                    y,
                    width,
                    selected: i === safeIdx,
                    label: act.label,
                    desc: act.desc,
                })
                y += 1
            }

            if (step === 'not_installed' && y + 4 <= footerY) {
                y += 1
                const guideLines = [
                    'Manual setup:',
                    '  1. Install from ollama.com/download',
                    '  2. Start server: ollama serve',
                    '  3. Pull a coding model: ollama pull qwen3:8b',
                ]
                for (const line of guideLines) {
                    if (y >= footerY) break
                    drawText(buffer, line, {
                        x,
                        y,
                        maxWidth: width,
                        style: { fg: THEME.colors.muted },
                    })
                    y += 1
                }
            } else if (state?.error && y < footerY) {
                drawText(buffer, state.error, {
                    x,
                    y,
                    maxWidth: width,
                    style: { fg: THEME.colors.error },
                })
            }

            MenuFooterView.render(buffer, {
                x: props.x ?? 0,
                y: footerY,
                width: props.width,
                items: [
                    { key: '↑/↓', label: 'navigate' },
                    { key: 'enter', label: step === 'no_models' ? 'pull' : 'select' },
                    { key: 'r', label: 're-check' },
                    { key: 'esc', label: 'back' },
                ],
            })
            return
        }

        if (props.mode === 'confirm_replace_byok') {
            const target = props.confirmTarget || { label: 'Provider', value: '' }

            drawPanelTitle(buffer, { x, y, title: 'Configured Key Detected', width })
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

        drawPanelTitle(buffer, { x, y, title, width })
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
        y += 2

        const providers = AuthMenuView.getFilteredProviders(
            props.providers && props.providers.length > 0
                ? props.providers
                : DEFAULT_AUTH_PROVIDERS,
            q
        )
        const totalItems = providers.length

        // B11: fit the rows above the blank row and the footer, keeping one row for "↓ N more"
        const footerY = (props.y ?? 0) + (props.height ?? this.getHeight('byok_provider')) - 1
        const rowRoom = Math.max(1, footerY - y - 1)
        const windowSize =
            totalItems > Math.min(AUTH_PROVIDER_WINDOW_SIZE, rowRoom)
                ? Math.max(1, Math.min(AUTH_PROVIDER_WINDOW_SIZE, rowRoom - 1))
                : AUTH_PROVIDER_WINDOW_SIZE
        const safeSelectedIdx = Math.min(
            props.providerSelectedIndex || 0,
            Math.max(0, totalItems - 1)
        )
        let windowStart = Math.max(
            0,
            Math.min(props.providerWindowStart || 0, Math.max(0, totalItems - windowSize))
        )
        // Keep the selected row on screen when fewer rows fit than the app's window
        if (safeSelectedIdx >= windowStart + windowSize)
            windowStart = safeSelectedIdx - windowSize + 1
        if (safeSelectedIdx < windowStart) windowStart = safeSelectedIdx
        const windowEnd = Math.min(windowStart + windowSize, totalItems)
        const visible = providers.slice(windowStart, windowEnd)

        const configuredKeys = props.configuredProviderValues || []
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
                    style: { fg: THEME.colors.brand },
                })

                const labelText = item.label
                const badges: { text: string; color: string }[] = []
                if (item.isLocal) {
                    badges.push({ text: ' local', color: THEME.colors.muted })
                } else if (item.status) {
                    badges.push({ text: ` ${item.status}`, color: THEME.colors.muted })
                }
                if (isCurrent) {
                    badges.push({
                        text: item.isLocal ? ' · active' : ' active',
                        color: THEME.colors.success,
                    })
                } else if (isConfigured) {
                    badges.push({
                        text: item.isLocal ? ' · connected' : ' connected',
                        color: THEME.colors.muted,
                    })
                }

                drawText(buffer, labelText, {
                    x: x + 2,
                    y: rowY,
                    maxWidth: width - 4,
                    style: { fg: isSelected ? THEME.colors.brand : THEME.colors.text },
                })

                let labelEnd = x + 2 + labelText.length
                for (const b of badges) {
                    drawText(buffer, b.text, {
                        x: labelEnd,
                        y: rowY,
                        style: { fg: b.color },
                    })
                    labelEnd += b.text.length
                }

                if (isConfirmingDelete) {
                    drawInlineConfirm(buffer, {
                        x: labelEnd,
                        y: rowY,
                        text: ' [Delete? (y/n)]',
                        tone: 'danger',
                    })
                }
            }
        }

        // B11: "↓ N more" goes under the last visible row, not on a fixed row
        const scrollStatusY = y + Math.max(1, visible.length)
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
                    style: { fg: THEME.colors.dim },
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

        MenuFooterView.render(buffer, {
            x: props.x ?? 0,
            y: footerY,
            width: props.width,
            items: footerItems,
        })
    },
}
