import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { ByokKeyMenu, formatProviderName } from '../../src/components/menus/byok-key-menu'

describe('ByokKeyMenu Component (Unit)', () => {
    it('formats known and unknown provider names correctly', () => {
        expect(formatProviderName('openai')).toBe('OpenAI')
        expect(formatProviderName('anthropic')).toBe('Anthropic')
        expect(formatProviderName('arcee')).toBe('Arcee AI')
        expect(formatProviderName('meta')).toBe('Meta')
        expect(formatProviderName('claude')).toBe('Anthropic')
        expect(formatProviderName('codex')).toBe('OpenAI')
        expect(formatProviderName('google')).toBe('Google')
        expect(formatProviderName('openrouter')).toBe('OpenRouter')
        expect(formatProviderName('agentrouter')).toBe('AgentRouter')
        expect(formatProviderName('deepseek')).toBe('DeepSeek')
        expect(formatProviderName('groq')).toBe('Groq')
        expect(formatProviderName('custom_test')).toBe('Custom_test')
        expect(formatProviderName('custom_provider')).toBe('Custom_provider')
        expect(formatProviderName()).toBe('Provider')
    })

    it('renders default input state with formatted provider name and footer', () => {
        const handleKeySubmit = mock()
        const setApiKey = mock()
        const { lastFrame } = render(
            <ByokKeyMenu
                selectedProvider="openai"
                apiKey="sk-test-12345"
                setApiKey={setApiKey}
                handleKeySubmit={handleKeySubmit}
                isStreaming={false}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Enter API Key for OpenAI:')
        expect(output).toContain("Don't have an API key? Get one at")
        expect(output).toContain('https://platform.openai.com/api-keys')
        expect(output).toContain('sk-test-12345')
        expect(output).toContain('Submit')
        expect(output).toContain('Back')
        expect(output).not.toContain('Verifying and saving API key')
    })

    it('renders AgentRouter provider state with correct URL and API key placeholder', () => {
        const handleKeySubmit = mock()
        const setApiKey = mock()
        const { lastFrame } = render(
            <ByokKeyMenu
                selectedProvider="agentrouter"
                apiKey="sk-ar-test"
                setApiKey={setApiKey}
                handleKeySubmit={handleKeySubmit}
                isStreaming={false}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Enter API Key for AgentRouter:')
        expect(output).toContain("Don't have an API key? Get one at")
        expect(output).toContain('https://agentrouter.org/console/token')
        expect(output).toContain('sk-ar-test')
        expect(output).toContain('Submit')
        expect(output).toContain('Back')
    })

    it('renders saving loader spinner mid-step and hides footer when isStreaming is true', () => {
        const handleKeySubmit = mock()
        const setApiKey = mock()
        const { lastFrame } = render(
            <ByokKeyMenu
                selectedProvider="anthropic"
                apiKey="sk-ant-test"
                setApiKey={setApiKey}
                handleKeySubmit={handleKeySubmit}
                isStreaming={true}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Enter API Key for Anthropic:')
        expect(output).toContain('Verifying and saving API key for Anthropic...')
        expect(output).not.toContain('Submit')
        expect(output).not.toContain('Back')
    })

    it('renders error message when authError is passed and isStreaming is false', () => {
        const handleKeySubmit = mock()
        const setApiKey = mock()
        const { lastFrame } = render(
            <ByokKeyMenu
                selectedProvider="google"
                apiKey="bad-key"
                setApiKey={setApiKey}
                handleKeySubmit={handleKeySubmit}
                isStreaming={false}
                authError="Invalid API Key for google: 401 Unauthorized"
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Enter API Key for Google:')
        expect(output).toContain('Invalid API Key for google: 401 Unauthorized')
        expect(output).toContain('Submit')
        expect(output).toContain('Back')
    })

    it('renders Deepgram provider with $200 free credit note', () => {
        const handleKeySubmit = mock()
        const setApiKey = mock()
        const { lastFrame } = render(
            <ByokKeyMenu
                selectedProvider="deepgram"
                apiKey="dg-test-key"
                setApiKey={setApiKey}
                handleKeySubmit={handleKeySubmit}
                isStreaming={false}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Enter API Key for Deepgram:')
        expect(output).toContain("Don't have an API key? Get one at")
        expect(output).toContain('https://console.deepgram.com')
        expect(output).toContain('($200 free credit on signup)')
        expect(output).toContain('dg-test-key')
        expect(output).toContain('Submit')
        expect(output).toContain('Back')
    })

    it('ignores mouse wheel and drag escape sequences without mutating apiKey', async () => {
        const handleKeySubmit = mock()
        const setApiKey = mock()
        const { stdin } = render(
            <ByokKeyMenu
                selectedProvider="perplexity"
                apiKey=""
                setApiKey={setApiKey}
                handleKeySubmit={handleKeySubmit}
                isStreaming={false}
            />
        )

        // SGR mouse wheel down and drag sequences from user report
        stdin.write('[<65;90;20M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(setApiKey).not.toHaveBeenCalled()

        stdin.write('[<32;3;2M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(setApiKey).not.toHaveBeenCalled()

        stdin.write('[<0;8;4m')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(setApiKey).not.toHaveBeenCalled()
    })

    it('returns to byok_provider menu and clears apiKey and authError on escape', async () => {
        let currentAuthMode = 'byok_key'
        let currentKey = 'partial-key'
        let currentError: string | null = 'some error'
        const handleKeySubmit = mock()

        const { stdin } = render(
            <ByokKeyMenu
                selectedProvider="openai"
                apiKey={currentKey}
                setApiKey={(k) => {
                    currentKey = k
                }}
                handleKeySubmit={handleKeySubmit}
                isStreaming={false}
                authError={currentError}
                setAuthError={(err) => {
                    currentError = err
                }}
                setAuthMode={(mode) => {
                    currentAuthMode = mode
                }}
            />
        )

        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 20))

        expect(currentAuthMode).toBe('byok_provider')
        expect(currentKey).toBe('')
        expect(currentError).toBeNull()
    })
})
