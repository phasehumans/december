import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { billingAPI } from '../src/features/billing/api/billing'
import { profileAPI } from '../src/features/profile/api/profile'
import { ProfileUsageSettings } from '../src/features/profile/components/ProfileUsageSettings'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, waitFor } = await import('@testing-library/react')

const event = (id: string, billingSource: 'CREDITS' | 'OWN_KEY', costInCents: number) => ({
    id,
    userId: 'user-1',
    model: 'gpt-4o',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costInCents,
    billingSource,
    projectId: null,
    chatId: null,
    externalRequestId: null,
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
    metadata: null,
    createdAt: new Date().toISOString(),
    session: { title: `run ${id}` },
})

const renderUsage = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter>
                <ProfileUsageSettings />
            </MemoryRouter>
        </QueryClientProvider>
    )

afterEach(() => {
    cleanup()
})

describe('usage page and own-key runs', () => {
    test('own-key runs show "your key" and are left out of the December total', async () => {
        profileAPI.getProfile = (async () => ({ id: 'user-1' })) as any
        billingAPI.getOverview = (async () => ({ creditBalance: 0 })) as any
        // The period sum is 0 (own-key runs are not counted), so the page falls back to the
        // event list: the own-key estimate must not be added to the total
        billingAPI.getCreditsHistory = (async () => ({
            events: [event('a', 'OWN_KEY', 42), event('b', 'CREDITS', 0)],
            total: 2,
            limit: 10,
            offset: 0,
            periods: [{ periodStart: '', periodEnd: '', costInCents: 0 }],
        })) as any

        const { container } = renderUsage()
        await waitFor(() => expect(container.textContent).toContain('run a'))

        expect(container.textContent).toContain('your key')
        expect(container.textContent).not.toContain('$0.42')
        expect(container.textContent).toContain('$0.00')
    })
})
