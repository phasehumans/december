import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach, beforeEach, spyOn, mock } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent } = await import('@testing-library/react')

import { SearchModal } from '../src/features/navigation/components/SearchModal'
import { profileAPI } from '../src/features/profile/api/profile'
import { sessionAPI } from '../src/features/sessions/api/session'

// the search reads sessions and repositories through react-query, so it needs a client
const renderModal = (onClose: () => void) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter>
                <SearchModal isOpen={true} onClose={onClose} isAuthenticated={true} />
            </MemoryRouter>
        </QueryClientProvider>
    )

describe('SearchModal component', () => {
    beforeEach(() => {
        spyOn(sessionAPI, 'getSessions').mockResolvedValue({ sessions: [], total: 0 } as never)
        spyOn(profileAPI, 'getGithubRepos').mockResolvedValue([] as never)
    })

    afterEach(() => {
        cleanup()
        mock.restore()
    })

    test('renders navigation items without Device Activation', () => {
        const onClose = () => {}

        renderModal(onClose)

        // Ensure primary navigation items are present
        expect(screen.getByText('New session')).toBeDefined()
        expect(screen.getByText('Sessions')).toBeDefined()
        expect(screen.getByText('Pull requests')).toBeDefined()
        expect(screen.getByText('Documentation')).toBeDefined()

        // Verify Device Activation is removed
        expect(screen.queryByText('Device Activation')).toBeNull()
        expect(screen.queryByText('Link CLI or secondary device code')).toBeNull()
    })

    test('does not include Device Activation in any category', () => {
        const onClose = () => {}

        renderModal(onClose)

        expect(screen.queryByText(/Device Activation/i)).toBeNull()
        expect(screen.queryByText(/secondary device code/i)).toBeNull()
    })

    test('calls onClose when Escape key is pressed', () => {
        let isClosed = false
        const onClose = () => {
            isClosed = true
        }

        renderModal(onClose)

        fireEvent.keyDown(window, { key: 'Escape' })
        expect(isClosed).toBe(true)
    })
})
