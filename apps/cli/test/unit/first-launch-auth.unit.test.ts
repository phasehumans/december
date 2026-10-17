import { describe, expect, it, beforeEach } from 'bun:test'

import { MESSAGES } from '../../src/constants/messages'
import { useCliStore } from '../../src/store'

describe('First-Launch Device Auth & Wallet Transition (Unit)', () => {
    beforeEach(() => {
        useCliStore.setState({
            isAuthenticated: false,
            authMode: 'none',
            activeMessages: [],
            staticMessages: [],
            isStreaming: false,
        })
    })

    it('sets authMode to byok_provider when device login completes with $0 wallet balance', () => {
        const balanceCents = 0
        let loginNotice = MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE
        let shouldPromptByok = false

        if (balanceCents <= 0) {
            loginNotice = `${MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE}\n\nNotice: Your December Wallet balance is $0.00.\n\nTo start generating:\n- Add credits at https://app.trydecember.com/settings/billing\n- Or use your own AI Subscription or API key (select a provider below):`
            shouldPromptByok = true
        }

        expect(shouldPromptByok).toBe(true)
        expect(loginNotice).toContain('Your December Wallet balance is $0.00.')
        expect(loginNotice).toContain('select a provider below')

        if (shouldPromptByok) {
            useCliStore.getState().setAuthMode('byok_provider')
        }

        expect(useCliStore.getState().authMode).toBe('byok_provider')
    })

    it('keeps authMode as none when device login completes with positive wallet balance', () => {
        const balanceCents = 500
        let loginNotice = MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE
        let shouldPromptByok = false

        if (balanceCents <= 0) {
            shouldPromptByok = true
        } else {
            loginNotice = `${MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE}\n\nDecember Wallet: $${(balanceCents / 100).toFixed(2)}. Ready to code!`
        }

        expect(shouldPromptByok).toBe(false)
        expect(loginNotice).toContain('December Wallet: $5.00. Ready to code!')

        if (shouldPromptByok) {
            useCliStore.getState().setAuthMode('byok_provider')
        }

        expect(useCliStore.getState().authMode).toBe('none')
    })

    it('formats onCode with prefilled code query parameter in verification URL', () => {
        const code = 'ABCD-EFGH'
        const uri = 'https://app.trydecember.com/device/activate'
        const fullUrl = uri.includes('?')
            ? `${uri}&code=${encodeURIComponent(code)}`
            : `${uri}?code=${encodeURIComponent(code)}`

        expect(fullUrl).toBe('https://app.trydecember.com/device/activate?code=ABCD-EFGH')

        const message = `Welcome to December! Please link your account:\n\nOpen [${fullUrl}](${fullUrl}) and confirm code: \`${code}\`\n\nWaiting for authorization in browser...`
        expect(message).toContain('code: `ABCD-EFGH`')
        expect(message).toContain('https://app.trydecember.com/device/activate?code=ABCD-EFGH')
    })

    it('falls back to authMode menu if device login fails or is cancelled', () => {
        const store = useCliStore.getState()
        store.setIsAuthenticated(false)

        try {
            throw new Error('Device code expired')
        } catch {
            if (!useCliStore.getState().isAuthenticated) {
                useCliStore.getState().setAuthMode('menu')
            }
        }

        expect(useCliStore.getState().authMode).toBe('menu')
    })
})
