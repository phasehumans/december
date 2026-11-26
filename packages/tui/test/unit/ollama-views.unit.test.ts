import { describe, expect, it } from 'bun:test'

import { BYOK_PROVIDER_ITEMS, PROVIDER_NAMES } from '../../src/constants/providers'
import { ScreenBuffer } from '../../src/renderer/buffer'
import { AuthMenuView } from '../../src/renderer/views/auth-menu-view'
import { takePanelCursor } from '../../src/renderer/views/panel'
import { SwitchSelectMenuView } from '../../src/renderer/views/switch-select-menu-view'

describe('Ollama TUI views (Unit)', () => {
    it('places Ollama alphabetically in BYOK_PROVIDER_ITEMS with local metadata', () => {
        const nvidiaIdx = BYOK_PROVIDER_ITEMS.findIndex((p) => p.value === 'nvidia')
        const ollamaIdx = BYOK_PROVIDER_ITEMS.findIndex((p) => p.value === 'ollama')
        const openaiIdx = BYOK_PROVIDER_ITEMS.findIndex((p) => p.value === 'openai')

        expect(nvidiaIdx).toBeGreaterThan(-1)
        expect(ollamaIdx).toBe(nvidiaIdx + 1)
        expect(openaiIdx).toBe(ollamaIdx + 1)
        expect(BYOK_PROVIDER_ITEMS[ollamaIdx]?.isLocal).toBe(true)
        expect(PROVIDER_NAMES.ollama).toBe('Ollama')
    })

    it('renders local badge alongside connected/active in BYOK provider list', () => {
        const ollamaIdx = BYOK_PROVIDER_ITEMS.findIndex((p) => p.value === 'ollama')
        const buffer = new ScreenBuffer(80, 13)
        AuthMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 80,
            mode: 'byok_provider',
            providers: BYOK_PROVIDER_ITEMS,
            providerSelectedIndex: ollamaIdx,
            providerWindowStart: ollamaIdx,
            configuredProviderValues: ['ollama'],
            selectedProvider: 'ollama',
            authMethod: 'byok',
        })

        expect(buffer.getLine(3)).toContain('❭ Ollama')
        expect(buffer.getLine(3)).toContain('local')
        expect(buffer.getLine(3)).toContain('active')
    })

    it('renders Ollama not_installed setup panel with command and manual guide', () => {
        const buffer = new ScreenBuffer(90, 14)
        AuthMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 90,
            mode: 'ollama_setup',
            ollamaSetup: {
                step: 'not_installed',
                baseUrl: 'http://localhost:11434/v1',
                installCommand: 'curl -fsSL https://ollama.com/install.sh | sh',
                actions: [
                    {
                        id: 'install',
                        label: 'Install Ollama',
                        desc: 'runs: curl -fsSL https://ollama.com/install.sh | sh',
                    },
                    { id: 'download', label: 'Open download page', desc: 'ollama.com/download' },
                    {
                        id: 'custom_url',
                        label: 'Use custom URL',
                        desc: 'remote or non-default port',
                    },
                ],
                selectedIndex: 0,
                inputValue: 'http://localhost:11434/v1',
            },
        })

        const screen = Array.from({ length: 14 }, (_, i) => buffer.getLine(i)).join('\n')
        expect(screen).toContain('Ollama Setup')
        expect(screen).toContain('not detected on localhost:11434')
        expect(screen).toContain('Install Ollama')
        expect(screen).toContain('Manual setup:')
        expect(screen).toContain('re-check')
    })

    it('renders Ollama custom URL input with hardware cursor', () => {
        const buffer = new ScreenBuffer(80, 7)
        AuthMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 80,
            mode: 'ollama_setup',
            ollamaSetup: {
                step: 'custom_url',
                baseUrl: 'http://localhost:11434/v1',
                actions: [],
                selectedIndex: 0,
                inputValue: 'http://localhost:11434/v1',
            },
        })

        expect(buffer.getLine(0)).toContain('Ollama Server URL')
        expect(buffer.getLine(3)).toContain('❭ http://localhost:11434/v1')
        expect(takePanelCursor()).toEqual({ x: 4 + 'http://localhost:11434/v1'.length, y: 3 })
    })

    it('renders local tag in SwitchSelectMenuView', () => {
        const buffer = new ScreenBuffer(80, 6)
        SwitchSelectMenuView.render(buffer, {
            x: 0,
            y: 0,
            width: 80,
            items: [
                { label: 'Anthropic (Claude)', value: 'subscription:claude', isActive: true },
                { label: 'Ollama', value: 'provider:ollama', tag: 'local · running' },
            ],
            selectedIndex: 1,
        })

        expect(buffer.getLine(3)).toContain('Ollama')
        expect(buffer.getLine(3)).toContain('local · running')
    })
})
