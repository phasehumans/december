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

        // the header is the logo only since d4c7f998 (#629): no "December" heading text
        const mark = screen.getByRole('img', { name: 'December' })
        expect(mark.querySelector('svg')).not.toBeNull()
        expect(mark.textContent).toBe('')
        expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
        expect(container.querySelector('button[type="submit"]')?.textContent).toBe('Sign up')

        // white links with no underline (#629)
        for (const name of ['Terms', 'Privacy Policy']) {
            const link = screen.getByRole('link', { name })
            expect(link.className).toContain('text-white')
            expect(link.className).not.toContain('underline')
        }

        const loginLink = screen.getByRole('button', { name: 'Log in' })
        expect(loginLink.className).toContain('text-white')
        expect(loginLink.className).not.toContain('text-[#87b2f4]')
        expect(loginLink.className).not.toContain('underline')
        // the log in link comes after the mark
        expect(
            mark.compareDocumentPosition(loginLink) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('AuthModalAuthStep orders GitHub, Google with one compact style', () => {
        renderAuthStep()

        const buttons = [/Continue with GitHub/i, /Continue with Google/i].map((name) =>
            screen.getByRole('button', { name })
        )
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

    it('AuthModalAuthStep has no ChatGPT sign-in', () => {
        renderAuthStep()

        expect(screen.queryByRole('button', { name: /ChatGPT/i })).toBeNull()
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

    it('GithubCallback error state follows the sign-up page: logo, one red line, one button', async () => {
        const { MemoryRouter } = await import('react-router-dom')
        const { GithubCallback } = await import('@/features/auth/components/GithubCallback')

        // the page reads the reason from the address
        const happyDOM = (window as unknown as { happyDOM: { setURL: (url: string) => void } })
            .happyDOM
        const originalUrl = window.location.href
        try {
            happyDOM.setURL(
                'http://localhost/github/callback?error=access_denied&error_description=GitHub+OAuth+failed'
            )

            const { container } = render(
                <MemoryRouter>
                    <GithubCallback />
                </MemoryRouter>
            )

            // no heading and no close button: the reason is the one line under the logo
            expect(screen.queryByRole('heading')).toBeNull()
            expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
            const reason = screen.getByRole('alert')
            expect(reason.textContent).toBe('GitHub OAuth failed')
            expect(reason.className).toContain('text-red-400')
            expect(container.querySelector('svg')?.getAttribute('class')).toContain('w-[36px]')

            // the one action is the light button of the sign-up page
            const retry = screen.getByRole('button', { name: 'Try again' })
            expect(retry.className).toContain('bg-[#EDEDED]')
            expect(retry.className).toContain('h-9')
            expect(retry.className).toContain('rounded-md')
        } finally {
            happyDOM.setURL(originalUrl)
        }
    })
})
