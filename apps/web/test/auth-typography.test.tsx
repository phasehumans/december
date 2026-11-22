import { readFileSync } from 'fs'
import { join } from 'path'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { describe, expect, it, afterEach, mock } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

import { AuthModalAuthStep } from '@/features/auth/components/AuthModalAuthStep'
import { AuthModalOtpStep } from '@/features/auth/components/AuthModalOtpStep'

describe('Auth Flow Typography & Landing Page Font Alignment', () => {
    afterEach(() => {
        cleanup()
    })

    it('index.html imports Geist and Geist Mono from Google Fonts', () => {
        const html = readFileSync(join(__dirname, '../src/index.html'), 'utf-8')
        expect(html).toContain('family=Geist+Mono')
        expect(html).toContain('family=Geist:')
        expect(html).toContain('family=Inter:')
    })

    it('index.css configures Geist as primary sans and display font', () => {
        const css = readFileSync(join(__dirname, '../src/index.css'), 'utf-8')
        expect(css).toContain("--font-sans:\n        'Geist'")
        expect(css).toContain("--font-display: 'Geist'")
        expect(css).toContain("--font-mono: 'Geist Mono'")
    })

    const renderAuthStep = (
        overrides: Partial<React.ComponentProps<typeof AuthModalAuthStep>> = {}
    ) =>
        render(
            <AuthModalAuthStep
                authMode="signup"
                email=""
                errorMessage={null}
                isAuthPending={false}
                isGooglePending={false}
                isGithubPending={false}
                onEmailChange={() => {}}
                onGoogleLogin={() => {}}
                onGithubLogin={() => {}}
                onSubmit={() => {}}
                onToggleAuthMode={() => {}}
                {...overrides}
            />
        )

    it('AuthModalAuthStep shows the December mark with the log in link under it', () => {
        const { container } = renderAuthStep()

        const heading = screen.getByRole('heading', { level: 2 })
        expect(heading.textContent).toBe('December')
        expect(heading.className).toContain('tracking-[-0.025em]')
        expect(heading.className).toContain('text-white')
        expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Sign up')

        for (const name of ['Terms', 'Privacy Policy']) {
            const link = screen.getByRole('link', { name })
            expect(link.className).toContain('text-white')
            expect(link.className).not.toContain('hover:')
            expect(link.className).not.toContain('transition')
        }

        const loginLink = screen.getByRole('button', { name: 'Log in' })
        expect(loginLink.className).toContain('text-white')
        expect(loginLink.className).not.toContain('text-[#87b2f4]')
    })

    it('AuthModalAuthStep orders GitHub, ChatGPT, Google with one compact style', () => {
        renderAuthStep()

        const buttons = [
            /Continue with GitHub/i,
            /Continue with ChatGPT/i,
            /Continue with Google/i,
        ].map((name) => screen.getByRole('button', { name }))
        for (let i = 0; i < buttons.length - 1; i++) {
            expect(
                buttons[i]!.compareDocumentPosition(buttons[i + 1]!) &
                    Node.DOCUMENT_POSITION_FOLLOWING
            ).toBeTruthy()
        }
        for (const button of buttons) {
            expect(button.className).toBe(buttons[0]!.className)
            expect(button.className).toContain('font-sans')
            expect(button.className).toContain('h-9')
            expect(button.className).toContain('rounded-md')
            expect(button.className).not.toContain('bg-white')
        }
    })

    it('AuthModalAuthStep asks only for an email, no password', () => {
        const { container } = renderAuthStep({ authMode: 'login' })

        expect(screen.getByLabelText(/Email address/i)).toBeDefined()
        expect(container.querySelector('input[type="password"]')).toBeNull()
        expect(screen.queryByText(/Forgot password/i)).toBeNull()
        expect(screen.getByRole('button', { name: 'Sign up' })).toBeDefined()
        expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Log in')
        expect(screen.getByText(/By continuing, you agree to our/i)).toBeDefined()
    })

    it('Continue with ChatGPT says coming soon and does not start a sign-in', () => {
        const onGoogleLogin = mock(() => {})
        const onGithubLogin = mock(() => {})
        renderAuthStep({ onGoogleLogin, onGithubLogin })

        const chatgptBtn = screen.getByRole('button', { name: /Continue with ChatGPT/i })
        fireEvent.click(chatgptBtn)
        expect(chatgptBtn.textContent).toContain('coming soon')
        expect(onGoogleLogin).not.toHaveBeenCalled()
        expect(onGithubLogin).not.toHaveBeenCalled()
    })

    it('AuthModalOtpStep shows the email and offers resend and a different email', () => {
        const onResend = mock(() => {})
        render(
            <AuthModalOtpStep
                email="you@example.com"
                otp={['', '', '', '', '', '']}
                errorMessage={null}
                isPending={false}
                isResendPending={false}
                onChangeOtp={() => {}}
                onKeyDown={() => {}}
                onPaste={() => {}}
                onSubmit={() => {}}
                onResend={onResend}
                onBack={() => {}}
                setOtpInputRef={() => {}}
            />
        )

        expect(screen.getByText('you@example.com')).toBeDefined()
        fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
        expect(onResend).toHaveBeenCalled()
        expect(screen.getByRole('button', { name: 'Use a different email' })).toBeDefined()
    })

    it('GithubCallback error state matches minimal auth modal layout and typography', async () => {
        const { MemoryRouter } = await import('react-router-dom')
        const { GithubCallback } = await import('@/features/auth/components/GithubCallback')

        // Mock window.location.search with error
        const originalSearch = window.location.search
        try {
            window.history.pushState(
                {},
                '',
                '/auth/github/callback?error=access_denied&error_description=GitHub+OAuth+failed'
            )

            const { container } = render(
                <MemoryRouter>
                    <GithubCallback />
                </MemoryRouter>
            )

            const heading = screen.getByRole('heading', { level: 2 })
            expect(heading.textContent).toBe('Authentication Failed')
            expect(heading.className).toContain('font-medium')
            expect(heading.className).toContain('tracking-[-0.025em]')
            expect(heading.className).toContain('text-white')

            // Must NOT contain harsh legacy corner-brackets or 01 / OAUTH_ERROR badge
            expect(container.querySelector('.corner-brackets')).toBeNull()
            expect(screen.queryByText(/OAUTH_ERROR/)).toBeNull()

            // Primary action button must match minimal login button
            const backBtn = screen.getByRole('button', { name: /Back to Login/i })
            expect(backBtn).toBeDefined()
            expect(backBtn.className).toContain('bg-white')
            expect(backBtn.className).toContain('text-[#090a0f]')
        } finally {
            window.history.pushState({}, '', originalSearch || '/')
        }
    })
})
