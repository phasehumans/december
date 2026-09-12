import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { getViewForPath, isPublicPath } from '../src/app/types'
import { DocsView } from '../src/features/docs/components/DocsView'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
})

describe('Web Documentation & Mobile Navigation (DocsView)', () => {
    test('getViewForPath correctly routes all /docs endpoints to docs view', () => {
        expect(getViewForPath('/docs')).toBe('docs')
        expect(getViewForPath('/docs/')).toBe('docs')
        expect(getViewForPath('/docs/intro')).toBe('docs')
        expect(getViewForPath('/docs/quickstart')).toBe('docs')
        expect(getViewForPath('/docs/architecture')).toBe('docs')
        expect(getViewForPath('/docs/cli')).toBe('docs')
        expect(getViewForPath('/docs/privacy')).toBe('docs')
        expect(getViewForPath('/docs/terms')).toBe('docs')
    })

    test('DocsView renders Introduction by default at /docs', () => {
        render(
            <MemoryRouter initialEntries={['/docs']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/About December Agent/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Micro-VM Sandboxed Execution/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Quick Start directly when route is /docs/quickstart', () => {
        render(
            <MemoryRouter initialEntries={['/docs/quickstart']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Getting Started with December/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Terminal CLI Installation/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Architecture directly when route is /docs/architecture', () => {
        render(
            <MemoryRouter initialEntries={['/docs/architecture']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/System Architecture/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Compiler & Linter Feedback Loop/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders CLI Reference directly when route is /docs/cli', () => {
        render(
            <MemoryRouter initialEntries={['/docs/cli']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/December CLI Reference/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/december login/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Keyboard Shortcuts/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Privacy Policy directly when route is /docs/privacy', () => {
        render(
            <MemoryRouter initialEntries={['/docs/privacy']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Privacy Policy/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Google API Services User Data Policy/i).length).toBeGreaterThan(
            0
        )
    })

    test('DocsView renders Terms of Service directly when route is /docs/terms', () => {
        render(
            <MemoryRouter initialEntries={['/docs/terms']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Terms of Service/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Ownership of Code/i).length).toBeGreaterThan(0)
    })

    test('DocsView switches tabs when clicking desktop sidebar buttons', () => {
        render(
            <MemoryRouter initialEntries={['/docs']}>
                <DocsView />
            </MemoryRouter>
        )

        const quickStartButtons = screen.getAllByRole('button', { name: /Quick Start/i })
        fireEvent.click(quickStartButtons[0])

        expect(screen.getAllByText(/Getting Started with December/i).length).toBeGreaterThan(0)
    })

    test('DocsView includes MobileBreadcrumbsHeader with Docs and active section', () => {
        render(
            <MemoryRouter initialEntries={['/docs/quickstart']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText('Docs').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Quick Start').length).toBeGreaterThan(0)
    })

    test('isPublicPath recognizes /docs and all documentation subroutes as accessible without authentication', () => {
        expect(isPublicPath('/docs')).toBe(true)
        expect(isPublicPath('/docs/')).toBe(true)
        expect(isPublicPath('/docs/intro')).toBe(true)
        expect(isPublicPath('/docs/quickstart')).toBe(true)
        expect(isPublicPath('/docs/architecture')).toBe(true)
        expect(isPublicPath('/docs/cli')).toBe(true)
        expect(isPublicPath('/docs/privacy')).toBe(true)
        expect(isPublicPath('/docs/terms')).toBe(true)
    })

    test('isPublicPath protects authenticated private routes while allowing public routes', () => {
        expect(isPublicPath('/')).toBe(true)
        expect(isPublicPath('/terms')).toBe(true)
        expect(isPublicPath('/privacy')).toBe(true)
        expect(isPublicPath('/settings/terms')).toBe(true)
        expect(isPublicPath('/settings/privacy')).toBe(true)

        // Protected routes must return false
        expect(isPublicPath('/sessions')).toBe(false)
        expect(isPublicPath('/sessions/my-project')).toBe(false)
        expect(isPublicPath('/settings')).toBe(false)
        expect(isPublicPath('/settings/billing')).toBe(false)
        expect(isPublicPath('/settings/connections')).toBe(false)
    })
})
