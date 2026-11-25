import fs from 'fs'
import path from 'path'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'

import { getProfileTabFromSlug, getSlugForProfileTab, getViewForPath } from '../src/app/types'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
})

describe('Google OAuth Verification, Privacy & Terms', () => {
    test('getViewForPath correctly routes settings and connections URLs, and leaves standalone legal to default', () => {
        expect(getViewForPath('/settings/privacy')).toBe('profile')
        expect(getViewForPath('/settings/terms')).toBe('profile')
        expect(getViewForPath('/settings/usage')).toBe('profile')
        expect(getViewForPath('/settings/billing')).toBe('profile')
        expect(getViewForPath('/profile/integrations')).toBe('profile')
        // connections is a page of settings again; its old urls open settings too
        expect(getViewForPath('/settings/integrations')).toBe('profile')
        expect(getViewForPath('/settings/connections')).toBe('profile')
        expect(getViewForPath('/settings/repositories')).toBe('profile')
        expect(getViewForPath('/connections')).toBe('profile')
        expect(getViewForPath('/connections/mcps/sentry')).toBe('profile')
        expect(getViewForPath('/integrations')).toBe('profile')
        expect(getViewForPath('/connectors')).toBe('profile')
        // Standalone /privacy and /terms are now external landing page redirects, not internal profile views
        expect(getViewForPath('/privacy')).toBe('chat')
        expect(getViewForPath('/terms')).toBe('chat')
    })

    test('getProfileTabFromSlug and getSlugForProfileTab resolve connections, billing, and usage correctly', () => {
        expect(getProfileTabFromSlug('connections')).toBe('Connections')
        expect(getProfileTabFromSlug('integrations')).toBe('Connections')
        expect(getProfileTabFromSlug('usage')).toBe('Usage')
        expect(getProfileTabFromSlug('analytics')).toBe('Usage')
        expect(getProfileTabFromSlug('billing')).toBe('Billing')
        expect(getSlugForProfileTab('Connections')).toBe('connections')
        expect(getSlugForProfileTab('Usage')).toBe('usage')
        expect(getSlugForProfileTab('Billing')).toBe('billing')
    })

    test('Landing page privacy policy contains all mandatory Google OAuth verification disclosures', () => {
        const privacyPath = path.resolve(__dirname, '../../docs/src/pages/privacy.astro')
        const content = fs.readFileSync(privacyPath, 'utf8')

        // App Name and website
        expect(content).toContain('December')
        expect(content).toContain('https://trydecember.com')

        // Google OAuth & Limited Use compliance statement
        expect(content).toContain('Google API Services User Data Policy')
        expect(content).toContain('Limited Use')

        // Privacy contact email
        expect(content).toContain('team@trydecember.com')

        // No model training on private user data
        expect(content).toContain('We Do Not Train On Your Code')
        expect(content).toContain(
            'We do not use your source code, prompts, git repositories, or Google account information to train'
        )
    })

    test('Landing page terms contains December terms and code ownership terms', () => {
        const termsPath = path.resolve(__dirname, '../../docs/src/pages/terms.astro')
        const content = fs.readFileSync(termsPath, 'utf8')

        // App Name and website
        expect(content).toContain('December')
        expect(content).toContain('https://trydecember.com')

        // Ownership clause
        expect(content).toContain('Your Code Belongs to You')
        expect(content).toContain('You own 100% of your source code')

        // Support contact email
        expect(content).toContain('team@trydecember.com')
    })

    test('Assets _redirects file has 302 redirects for legal pages to landing page', () => {
        const redirectsPath = path.resolve(__dirname, '../assets/_redirects')
        const content = fs.readFileSync(redirectsPath, 'utf8')

        expect(content).toMatch(/\/privacy\s+https:\/\/trydecember\.com\/privacy\s+302/)
        expect(content).toMatch(/\/terms\s+https:\/\/trydecember\.com\/terms\s+302/)
        expect(content).toMatch(/\/settings\/privacy\s+https:\/\/trydecember\.com\/privacy\s+302/)
        expect(content).toMatch(/\/settings\/terms\s+https:\/\/trydecember\.com\/terms\s+302/)
    })
})
