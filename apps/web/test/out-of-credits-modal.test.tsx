import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

import outCreditsWebp from '../assets/outcredits.webp'
import { OutOfCreditsModal } from '../src/features/billing/components/OutOfCreditsModal'

describe('OutOfCreditsModal', () => {
    afterEach(() => {
        cleanup()
    })

    test('renders default banner image with outcredits.webp', () => {
        render(
            <MemoryRouter>
                <OutOfCreditsModal isOpen={true} onClose={() => {}} />
            </MemoryRouter>
        )

        const img = screen.getByAltText('Out of Credits') as HTMLImageElement
        expect(img).toBeDefined()
        expect(img.src).toContain(outCreditsWebp)
    })

    test('renders default banner with eager loading', () => {
        render(
            <MemoryRouter>
                <OutOfCreditsModal isOpen={true} onClose={() => {}} />
            </MemoryRouter>
        )

        const img = screen.getByAltText('Out of Credits') as HTMLImageElement
        expect(img.getAttribute('loading')).toBe('eager')
        expect(img.getAttribute('fetchpriority')).toBe('high')
        expect(img.getAttribute('decoding')).toBe('sync')
    })

    test('renders custom bannerImage when provided', () => {
        render(
            <MemoryRouter>
                <OutOfCreditsModal
                    isOpen={true}
                    onClose={() => {}}
                    bannerImage="https://example.com/custom-banner.png"
                />
            </MemoryRouter>
        )

        const img = screen.getByAltText('Out of Credits') as HTMLImageElement
        expect(img).toBeDefined()
        expect(img.src).toBe('https://example.com/custom-banner.png')
    })
})
