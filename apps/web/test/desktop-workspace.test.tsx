import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup } = await import('@testing-library/react')

import { useAppStore } from '../src/app/store'
import { DesktopWorkspace } from '../src/features/preview/components/DesktopWorkspace'

describe('Web Workbench Desktop Tab (Ticket #591 - Seam 3)', () => {
    beforeEach(() => {
        useAppStore.setState({
            desktopViewport: null,
        })
    })

    afterEach(() => {
        cleanup()
    })

    it('renders clean headless browser empty state when idle', () => {
        render(<DesktopWorkspace />)

        expect(screen.getByTestId('desktop-workspace')).toBeDefined()
        expect(screen.getByTestId('desktop-empty-placeholder')).toBeDefined()
        expect(screen.getByText('Headless Browser Automation')).toBeDefined()
        expect(screen.getByText('about:blank')).toBeDefined()
    })

    it('renders browser automation badge, active URL, and screenshot when viewport is captured', () => {
        useAppStore.setState({
            desktopViewport: {
                url: 'http://localhost:3000/settings',
                title: 'Settings Page',
                action: 'navigate',
                screenshot: 'data:image/png;base64,mockPngBase64Payload',
                consoleErrors: [],
                networkErrors: [],
            },
        })

        render(<DesktopWorkspace />)

        expect(screen.getByText('Browser Automation')).toBeDefined()
        expect(screen.getByText('navigate')).toBeDefined()
        expect(screen.getByTestId('desktop-address-bar').textContent).toContain(
            'http://localhost:3000/settings'
        )

        const img = screen.getByTestId('desktop-screenshot-image') as HTMLImageElement
        expect(img).toBeDefined()
        expect(img.src).toBe('data:image/png;base64,mockPngBase64Payload')
        expect(screen.getByText('Settings Page')).toBeDefined()
    })

    it('renders console and network errors drawer and allows toggling tabs', async () => {
        useAppStore.setState({
            desktopViewport: {
                url: 'http://localhost:3000/app',
                action: 'get_console_errors',
                screenshot: 'data:image/png;base64,mockPngBase64Payload',
                consoleErrors: ['TypeError: Cannot read properties of undefined (reading "map")'],
                networkErrors: ['HTTP 500 POST /api/checkout'],
            },
        })

        render(<DesktopWorkspace />)

        // Error pill should display total error count (2)
        const errorBtn = screen.getByRole('button', { name: /2 error\(s\)/i })
        expect(errorBtn).toBeDefined()

        // Diagnostics drawer starts collapsed
        expect(screen.queryByTestId('desktop-diagnostics-drawer')).toBeNull()

        // Click to open drawer
        fireEvent.click(errorBtn)
        expect(screen.getByTestId('desktop-diagnostics-drawer')).toBeDefined()

        // Check console error is displayed
        expect(
            screen.getByText('TypeError: Cannot read properties of undefined (reading "map")')
        ).toBeDefined()

        // Switch to network tab
        const networkTabBtn = screen.getByRole('button', { name: /Network Errors \(1\)/i })
        fireEvent.click(networkTabBtn)
        expect(screen.getByText('HTTP 500 POST /api/checkout')).toBeDefined()
    })

    it('renders preview iframe fallback when previewUrl is present without screenshot', () => {
        render(<DesktopWorkspace previewUrl="http://localhost:5173" />)

        expect(screen.getByText('Live Preview')).toBeDefined()
        expect(screen.getByTestId('desktop-address-bar').textContent).toContain(
            'http://localhost:5173'
        )

        const iframe = screen.getByTestId('desktop-preview-iframe') as HTMLIFrameElement
        expect(iframe).toBeDefined()
        expect(iframe.src).toContain('http://localhost:5173')
    })
})
