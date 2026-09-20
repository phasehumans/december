import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { getViewForPath, isPublicPath } from '../src/app/types'
if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { DocsView } = await import('../src/features/docs/components/DocsView')
const { render, screen, cleanup, fireEvent, act } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
    if (globalThis.document) {
        document.body.innerHTML = ''
    }
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

    test('DocsView renders Prompting Guide directly when route is /docs/prompting', () => {
        render(
            <MemoryRouter initialEntries={['/docs/prompting']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Prompting & Instructions Guide/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/The Anatomy of an Effective Prompt/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Good vs. Bad Instructions/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Agent Loop directly when route is /docs/agent-loop', () => {
        render(
            <MemoryRouter initialEntries={['/docs/agent-loop']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Agent Decision Loop & Self-Healing/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/The 4-Stage Decision Cycle/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Compiler-in-the-Loop Feedback/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Git Checkpoints directly when route is /docs/checkpoints', () => {
        render(
            <MemoryRouter initialEntries={['/docs/checkpoints']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Git Checkpointing & Time Travel/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Ephemeral Snapshots on Every Turn/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Live Previews directly when route is /docs/previews', () => {
        render(
            <MemoryRouter initialEntries={['/docs/previews']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Live Previews & Dev Servers/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Zero-Config Framework Detection/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Slash Commands directly when route is /docs/slash-commands', () => {
        render(
            <MemoryRouter initialEntries={['/docs/slash-commands']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Interactive Slash Commands/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/\/plan/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/\/diff/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Integrations & MCP directly when route is /docs/integrations', () => {
        render(
            <MemoryRouter initialEntries={['/docs/integrations']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Integrations & MCP Protocol/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Model Context Protocol \(MCP\)/i).length).toBeGreaterThan(0)
    })

    test('DocsView renders Security & Isolation directly when route is /docs/security', () => {
        render(
            <MemoryRouter initialEntries={['/docs/security']}>
                <DocsView />
            </MemoryRouter>
        )

        expect(screen.getAllByText(/Security & Sandboxing Isolation/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Zero Model Training Policy/i).length).toBeGreaterThan(0)
    })

    test('Sidebar navigation excludes old sections like Deep Dive and Legal & Policies and includes modern sections', () => {
        render(
            <MemoryRouter initialEntries={['/docs']}>
                <DocsView />
            </MemoryRouter>
        )

        // Old unwanted section headers should NOT exist in navigation
        expect(screen.queryByText('Deep Dive')).toBeNull()
        expect(screen.queryByText('Legal & Policies')).toBeNull()

        // Modern clear section headers should be present
        expect(screen.getAllByText('Overview').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Working with December').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Capabilities & Runtime').length).toBeGreaterThan(0)
        expect(screen.getAllByText('CLI & Terminal').length).toBeGreaterThan(0)
        expect(screen.getAllByText('Integrations & Security').length).toBeGreaterThan(0)
    })

    test('Sidebar search filter filters nav items dynamically', () => {
        render(
            <MemoryRouter initialEntries={['/docs']}>
                <DocsView />
            </MemoryRouter>
        )

        const searchInputs = screen.getAllByPlaceholderText(/Search documentation.../i)
        fireEvent.input(searchInputs[0], { target: { value: 'slash' } })

        // Slash commands should be visible
        expect(screen.getAllByText(/Slash Commands/i).length).toBeGreaterThan(0)
        // Non-matching items should be filtered out
        expect(screen.queryAllByText(/Live Previews & Dev Servers/i).length).toBe(0)
    })

    test('Docs pagination Next button navigates to the next doc page', () => {
        render(
            <MemoryRouter initialEntries={['/docs']}>
                <DocsView />
            </MemoryRouter>
        )

        // On Introduction, pagination shows Next: Quick Start
        const nextButton = screen.getAllByRole('button', { name: /Next Quick Start/i })[0]
        fireEvent.click(nextButton)

        expect(screen.getAllByText(/Getting Started with December/i).length).toBeGreaterThan(0)
    })
})
