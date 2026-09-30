import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, act } = await import('@testing-library/react')

import { SearchModal } from '../src/features/navigation/components/SearchModal'

describe('SearchModal component', () => {
    afterEach(() => {
        cleanup()
    })

    test('renders navigation items without Device Activation', () => {
        const onClose = () => {}

        render(
            <MemoryRouter>
                <SearchModal isOpen={true} onClose={onClose} isAuthenticated={true} />
            </MemoryRouter>
        )

        // Ensure primary navigation items are present
        expect(screen.getByText('Home / New Session')).toBeDefined()
        expect(screen.getByText('Sessions')).toBeDefined()
        expect(screen.getByText('Documentation')).toBeDefined()

        // Verify Device Activation is removed
        expect(screen.queryByText('Device Activation')).toBeNull()
        expect(screen.queryByText('Link CLI or secondary device code')).toBeNull()
    })

    test('does not include Device Activation in any category', () => {
        const onClose = () => {}

        render(
            <MemoryRouter>
                <SearchModal isOpen={true} onClose={onClose} isAuthenticated={true} />
            </MemoryRouter>
        )

        expect(screen.queryByText(/Device Activation/i)).toBeNull()
        expect(screen.queryByText(/secondary device code/i)).toBeNull()
    })

    test('calls onClose when Escape key is pressed', () => {
        let isClosed = false
        const onClose = () => {
            isClosed = true
        }

        render(
            <MemoryRouter>
                <SearchModal isOpen={true} onClose={onClose} isAuthenticated={true} />
            </MemoryRouter>
        )

        fireEvent.keyDown(window, { key: 'Escape' })
        expect(isClosed).toBe(true)
    })
})
