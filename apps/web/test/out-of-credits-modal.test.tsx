import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup } = await import('@testing-library/react')

import outCreditsPng from '../assets/outcredits.png'
import { OutOfCreditsModal } from '../src/features/billing/components/OutOfCreditsModal'

describe('OutOfCreditsModal', () => {
    afterEach(() => {
        cleanup()
    })

    test('renders default banner image with outcredits.png', () => {
        render(
            <MemoryRouter>
                <OutOfCreditsModal isOpen={true} onClose={() => {}} />
            </MemoryRouter>
        )

        const img = screen.getByAltText('Out of Credits') as HTMLImageElement
        expect(img).toBeDefined()
        expect(img.src).toContain(outCreditsPng)
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
