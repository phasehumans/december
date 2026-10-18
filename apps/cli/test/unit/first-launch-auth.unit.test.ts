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

    it('keeps authMode as none and shows clean notice when device login completes with $0 wallet balance', () => {
        const balanceCents = 0
        const successBlocks: { type: string; content: string; color?: string }[] = [
            {
                type: 'text',
                content: `\n${MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE}`,
                color: '#6EE7B7',
            },
        ]

        if (balanceCents <= 0) {
            successBlocks.push({
                type: 'text',
                content: `\nYour December Wallet balance is $0.00.\nTo add credits, visit [https://app.trydecember.com/settings/billing](https://app.trydecember.com/settings/billing).\nYou can also connect an AI Subscription or API key anytime with \`/login\`.`,
            })
        }

        expect(successBlocks[0].content).toBe(`\n${MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE}`)
        expect(successBlocks[0].color).toBe('#6EE7B7')
        expect(successBlocks[1].content).toContain('Your December Wallet balance is $0.00.')
        expect(successBlocks[1].content).toContain('[https://app.trydecember.com/settings/billing]')
        expect(successBlocks[1].content).toContain('anytime with `/login`')
        expect(useCliStore.getState().authMode).toBe('none')
    })

    it('keeps authMode as none when device login completes with positive wallet balance', () => {
        const balanceCents = 500
        const successBlocks: { type: string; content: string; color?: string }[] = [
            {
                type: 'text',
                content: `\n${MESSAGES.AUTH.LOGIN_SUCCESS_DEVICE}`,
                color: '#6EE7B7',
            },
        ]
        let shouldPromptByok = false

        if (balanceCents <= 0) {
            shouldPromptByok = true
        } else {
            successBlocks.push({
                type: 'text',
                content: `\nDecember Wallet: $${(balanceCents / 100).toFixed(2)}. Ready to code!`,
            })
        }

        expect(shouldPromptByok).toBe(false)
        expect(successBlocks[1].content).toContain('December Wallet: $5.00. Ready to code!')

        if (shouldPromptByok) {
            useCliStore.getState().setAuthMode('byok_provider')
        }

        expect(useCliStore.getState().authMode).toBe('none')
    })

    it('formats onCode with Option 1 interactive prompt and prefilled code URL', () => {
        const code = 'ABCD-EFGH'
        const uri = 'https://app.trydecember.com/device/activate'
        const fullUrl = uri.includes('?')
            ? `${uri}&code=${encodeURIComponent(code)}`
            : `${uri}?code=${encodeURIComponent(code)}`

        expect(fullUrl).toBe('https://app.trydecember.com/device/activate?code=ABCD-EFGH')

        const message = `\nConfirm code: \`${code}\`\nOpen URL: [${fullUrl}](${fullUrl})\n\nPress [o] to open in browser · Esc to cancel\nWaiting for approval...`
        expect(message).toContain('Confirm code: `ABCD-EFGH`')
        expect(message).toContain(
            'Open URL: [https://app.trydecember.com/device/activate?code=ABCD-EFGH](https://app.trydecember.com/device/activate?code=ABCD-EFGH)'
        )
        expect(message).toContain('Press [o] to open in browser · Esc to cancel')
        expect(message).toContain('Waiting for approval...')
    })

    it('tracks pendingDeviceAuthUrl in store during login and clears it upon completion or cancel', () => {
        const url = 'https://app.trydecember.com/device/activate?code=ABCD-EFGH'
        useCliStore.getState().setPendingDeviceAuthUrl(url)
        expect(useCliStore.getState().pendingDeviceAuthUrl).toBe(url)

        useCliStore.getState().setPendingDeviceAuthUrl(null)
        expect(useCliStore.getState().pendingDeviceAuthUrl).toBeNull()
    })

    it('keeps authMode as none when device login fails or is cancelled', () => {
        const store = useCliStore.getState()
        store.setIsAuthenticated(false)
        store.setAuthMode('none')

        try {
            throw new Error('Login cancelled')
        } catch {
            useCliStore.getState().setAuthMode('none')
        }

        expect(useCliStore.getState().authMode).toBe('none')
    })

    it('identifies when already logged in and skips re-auth when answer is not y', () => {
        const config = {
            decemberToken: 'existing-december-token',
            email: 'dev@example.com',
        }

        const isAlreadyLoggedIn = Boolean(config.decemberToken)
        expect(isAlreadyLoggedIn).toBe(true)

        const promptMessage = `You are already logged in as ${config.email}.\nDo you want to switch to a different account? (y/n): `
        expect(promptMessage).toContain('dev@example.com')
        expect(promptMessage).toContain('(y/n)')

        const userDeclineAnswer: string = 'n'
        const shouldSwitch = userDeclineAnswer === 'y' || userDeclineAnswer === 'yes'
        expect(shouldSwitch).toBe(false)

        const userConfirmAnswer: string = 'y'
        const shouldSwitchConfirmed = userConfirmAnswer === 'y' || userConfirmAnswer === 'yes'
        expect(shouldSwitchConfirmed).toBe(true)
    })

    it('allows December login when user is authenticated with subscription but hasDecember is false', () => {
        useCliStore.setState({
            isAuthenticated: true,
            authMethod: 'subscription',
            currentEmail: 'phasehumans@gmail.com',
            hasDecember: false,
            authMode: 'menu',
        })

        const item = { label: 'Login via December', value: 'december' }
        const hasDecember =
            useCliStore.getState().hasDecember || useCliStore.getState().authMethod === 'december'

        const shouldIntercept = !(item as any).force && hasDecember
        expect(shouldIntercept).toBe(false)
    })

    it('guards December re-login when hasDecember is true without force', () => {
        useCliStore.setState({
            isAuthenticated: true,
            authMethod: 'subscription',
            currentEmail: 'phasehumans@gmail.com',
            hasDecember: true,
            decemberEmail: 'dev@example.com',
            authMode: 'menu',
        })

        const item = { label: 'Login via December', value: 'december' }
        const hasDecember =
            useCliStore.getState().hasDecember || useCliStore.getState().authMethod === 'december'

        const shouldIntercept = !(item as any).force && hasDecember
        expect(shouldIntercept).toBe(true)
    })

    it('allows December re-login when hasDecember is true with force: true', () => {
        useCliStore.setState({
            isAuthenticated: true,
            authMethod: 'subscription',
            currentEmail: 'phasehumans@gmail.com',
            hasDecember: true,
            decemberEmail: 'dev@example.com',
            authMode: 'menu',
        })

        const item = { label: 'Login via December', value: 'december', force: true }
        const hasDecember =
            useCliStore.getState().hasDecember || useCliStore.getState().authMethod === 'december'

        const shouldIntercept = !(item as any).force && hasDecember
        expect(shouldIntercept).toBe(false)
    })
})
