import { describe, it, expect } from 'bun:test'

import { renderBaseEmail } from '../../src/modules/auth/templates/base.template'
import { renderOtpEmail } from '../../src/modules/auth/templates/otp.template'

describe('Auth Email Templates - Unit Tests', () => {
    describe('renderBaseEmail', () => {
        it('should render base email wrapper with preview text, content and footer', () => {
            const html = renderBaseEmail({
                previewText: 'Preview text for inbox',
                content: '<p>Main email body</p>',
                supportEmail: 'support@example.com',
                webUrl: 'https://trydecember.com',
            })

            expect(html).toContain('Preview text for inbox')
            expect(html).toContain('<p>Main email body</p>')
            expect(html).toContain('mailto:support@example.com')
            expect(html).toContain('<!DOCTYPE html>')
            expect(html).toContain('prefers-color-scheme: dark')
        })
    })

    describe('renderOtpEmail', () => {
        it('should render the sign-up email correctly with html and plain text', () => {
            const { subject, html, text } = renderOtpEmail({
                otp: '849201',
                type: 'signup',
                supportEmail: 'support@december.com',
                webUrl: 'https://trydecember.com',
            })

            expect(subject).toBe('Your December verification code: 849201')
            expect(html).toContain('Verify your email')
            expect(html).toContain('849201')
            expect(html).toContain('10 minutes')

            expect(text).toContain('Verify your email')
            expect(text).toContain('finish creating your December account')
            expect(text).toContain('849201')
            expect(text).toContain('10 minutes')
            expect(text).toContain('support@december.com')
        })

        it('should render the sign-in email for a returning user', () => {
            const { subject, html, text } = renderOtpEmail({
                otp: '102938',
                type: 'login',
                supportEmail: 'support@december.com',
                webUrl: 'https://trydecember.com',
            })

            expect(subject).toBe('Your December sign-in code: 102938')
            expect(html).toContain('Sign in to December')
            expect(html).toContain('102938')
            expect(html).not.toContain('Verify your email')
            expect(text).toContain('Your sign-in code: 102938')
            expect(text).toContain('Nobody can sign in without this code')
        })
    })
})
