import { describe, expect, it, mock } from 'bun:test'
import React from 'react'

import { BtwOverlay } from '../../src/components/menus/btw-overlay'
import { renderWithProviders } from '../test-providers'

describe('BtwOverlay Component (Unit)', () => {
    it('renders loading state with question and spinner', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <BtwOverlay
                question="what port is used for postgres?"
                answer=""
                status="loading"
                onClose={handleClose}
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('▎')
        expect(frame).toContain('[btw]')
        expect(frame).toContain('what port is used for postgres?')
        expect(frame).toContain('Looking up cached context...')
        expect(frame).toContain('esc')
        expect(frame).toContain('cancel')
    })

    it('renders streaming state with incoming answer', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <BtwOverlay
                question="what port is used for postgres?"
                answer="Postgres is mapped to port 5432."
                status="streaming"
                onClose={handleClose}
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('▎')
        expect(frame).toContain('[btw]')
        expect(frame).toContain('what port is used for postgres?')
        expect(frame).toContain('Postgres is mapped to port 5432.')
        expect(frame).toContain('c')
        expect(frame).toContain('copy')
        expect(frame).toContain('esc')
        expect(frame).toContain('close')
    })

    it('renders complete state with markdown and shortcuts', () => {
        const handleClose = mock()
        const handleCopy = mock()
        const { lastFrame } = renderWithProviders(
            <BtwOverlay
                question="what port is used for postgres?"
                answer="Postgres is mapped to port 5432."
                status="complete"
                onClose={handleClose}
                onCopy={handleCopy}
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('▎')
        expect(frame).toContain('[btw]')
        expect(frame).toContain('what port is used for postgres?')
        expect(frame).toContain('Postgres is mapped to port 5432.')
        expect(frame).toContain('c')
        expect(frame).toContain('copy')
        expect(frame).toContain('esc')
        expect(frame).toContain('close')
    })

    it('renders command-menu style overflow indicator when content exceeds window', () => {
        const handleClose = mock()
        const longAnswer = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}`).join('\n')
        const { lastFrame } = renderWithProviders(
            <BtwOverlay
                question="show long config"
                answer={longAnswer}
                status="complete"
                onClose={handleClose}
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('▎')
        expect(frame).toContain('↓')
        expect(frame).toContain('more')
        expect(frame).toContain('↑/↓')
        expect(frame).toContain('scroll')
    })

    it('renders error state correctly', () => {
        const handleClose = mock()
        const { lastFrame } = renderWithProviders(
            <BtwOverlay
                question="what port is used for postgres?"
                answer=""
                status="error"
                error="Provider rate limited"
                onClose={handleClose}
            />
        )
        const frame = lastFrame() || ''

        expect(frame).toContain('▎')
        expect(frame).toContain('[btw]')
        expect(frame).toContain('Error: Provider rate limited')
    })

    it('handles escape key press to close overlay', async () => {
        const handleClose = mock()
        const { stdin } = renderWithProviders(
            <BtwOverlay
                question="what port is used for postgres?"
                answer="5432"
                status="complete"
                onClose={handleClose}
            />
        )

        stdin.write('\u001B') // ESC key
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(handleClose).toHaveBeenCalled()
    })

    it('handles c key press to copy answer', () => {
        const handleClose = mock()
        const handleCopy = mock()
        const { stdin } = renderWithProviders(
            <BtwOverlay
                question="what port is used for postgres?"
                answer="5432"
                status="complete"
                onClose={handleClose}
                onCopy={handleCopy}
            />
        )

        stdin.write('c')
        expect(handleCopy).toHaveBeenCalledWith('5432')
    })
})
