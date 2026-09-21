import fs from 'fs'
import path from 'path'

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'

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
        expect(getViewForPath('/settings/integrations')).toBe('profile')
        expect(getViewForPath('/profile/integrations')).toBe('profile')
        expect(getViewForPath('/settings/connections')).toBe('profile')
        expect(getViewForPath('/connections')).toBe('profile')
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
        expect(content).toContain('No Model Training')
    })

    test('Landing page terms contains December terms and code ownership terms', () => {
        const termsPath = path.resolve(__dirname, '../../docs/src/pages/terms.astro')
        const content = fs.readFileSync(termsPath, 'utf8')

        // App Name and website
        expect(content).toContain('December')
        expect(content).toContain('https://trydecember.com')

        // Ownership clause
        expect(content).toContain('Code Ownership & IP')

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

    test('ProfileConnectionsSettings renders Connections section without mock MCP servers', async () => {
        const { ProfileConnectionsSettings } =
            await import('../src/features/profile/components/ProfileConnectionsSettings')

        render(
            <ProfileConnectionsSettings
                isGithubConnected={true}
                isVercelConnected={false}
                isSupabaseConnected={false}
                isNotionConnected={false}
                onConnectGithub={() => {}}
                onConnectVercel={() => {}}
                onConnectSupabase={() => {}}
                onConnectNotion={() => {}}
            />
        )

        // Section heading
        expect(screen.getByRole('heading', { name: 'Connections' })).toBeDefined()
        expect(screen.queryByRole('heading', { name: 'MCP Servers' })).toBeNull()

        // Core connections
        expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0)
        expect(screen.getByText('Vercel')).toBeDefined()
        expect(screen.getByText('Supabase')).toBeDefined()
        expect(screen.getAllByText('Notion').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Figma').length).toBeGreaterThan(0)

        // GitHub connected status
        expect(screen.getByText('Connected')).toBeDefined()
    })
})
