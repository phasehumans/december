import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useAppStore } from '../src/app/store'
import { HomeHero } from '../src/features/home/components/HomeHero'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
    useAppStore.setState({
        isAuthenticated: false,
    })
})

const renderHero = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>
                <HomeHero onPromptSubmit={() => {}} onOpenAuth={() => {}} />
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('HomeHero', () => {
    test('shows no setup list, cards or Recent Sessions when signed out', () => {
        useAppStore.setState({ isAuthenticated: false })

        const { queryByText } = renderHero()

        expect(queryByText('Setup')).toBeNull()
        expect(queryByText('Get Started')).toBeNull()
        expect(queryByText('Recent Sessions')).toBeNull()
    })

    test('shows no setup list, cards or Recent Sessions when signed in', () => {
        useAppStore.setState({ isAuthenticated: true })

        const { queryByText } = renderHero()

        expect(queryByText('Setup')).toBeNull()
        expect(queryByText('Get Started')).toBeNull()
        expect(queryByText('Recent Sessions')).toBeNull()
    })
})
