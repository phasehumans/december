import { readFileSync } from 'fs'
import { join } from 'path'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { describe, expect, it, afterEach } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

import { AuthModalAuthStep } from '@/features/auth/components/AuthModalAuthStep'
import { AuthModalForgotEmailStep } from '@/features/auth/components/AuthModalForgotEmailStep'

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

    it('AuthModalAuthStep matches landing page heading typography for login', () => {
        render(
            <AuthModalAuthStep
                authMode="login"
                email=""
                password=""
                errorMessage={null}
                isAuthPending={false}
                isGooglePending={false}
                isGithubPending={false}
                onEmailChange={() => {}}
                onPasswordChange={() => {}}
                onGoogleLogin={() => {}}
                onGithubLogin={() => {}}
                onSubmit={() => {}}
                onToggleAuthMode={() => {}}
                onForgotPassword={() => {}}
                onClose={() => {}}
            />
        )

        const loginHeading = screen.getByRole('heading', { level: 2 })
        expect(loginHeading.textContent).toBe('Sign in to continue building')
        expect(loginHeading.className).toContain('font-medium')
        expect(loginHeading.className).toContain('tracking-[-0.025em]')
        expect(loginHeading.className).toContain('text-white')
    })

    it('AuthModalAuthStep matches landing page heading typography for signup', () => {
        render(
            <AuthModalAuthStep
                authMode="signup"
                email=""
                password=""
                errorMessage={null}
                isAuthPending={false}
                isGooglePending={false}
                isGithubPending={false}
                onEmailChange={() => {}}
                onPasswordChange={() => {}}
                onGoogleLogin={() => {}}
                onGithubLogin={() => {}}
                onSubmit={() => {}}
                onToggleAuthMode={() => {}}
                onForgotPassword={() => {}}
                onClose={() => {}}
            />
        )

        const signupHeading = screen.getByRole('heading', { level: 2 })
        expect(signupHeading.textContent).toBe('Create an account')
        expect(signupHeading.className).toContain('font-medium')
        expect(signupHeading.className).toContain('tracking-[-0.025em]')
        expect(signupHeading.className).toContain('text-white')
    })

    it('AuthModalForgotEmailStep matches landing page heading typography for Forgot password', () => {
        render(
            <AuthModalForgotEmailStep
                email=""
                errorMessage={null}
                isPending={false}
                onEmailChange={() => {}}
                onSubmit={() => {}}
                onBack={() => {}}
            />
        )

        const forgotHeading = screen.getByRole('heading', { level: 2 })
        expect(forgotHeading.textContent).toBe('Forgot password')
        expect(forgotHeading.className).toContain('font-medium')
        expect(forgotHeading.className).toContain('tracking-[-0.025em]')
        expect(forgotHeading.className).toContain('text-white')
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
