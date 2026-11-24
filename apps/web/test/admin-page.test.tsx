import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { adminAPI } from '../src/features/admin/api/admin'
import { AdminPage } from '../src/features/admin/components/AdminPage'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')

const renderPage = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <MemoryRouter>
                <AdminPage />
            </MemoryRouter>
        </QueryClientProvider>
    )

afterEach(() => {
    cleanup()
})

const pendingRequest = {
    id: 'req-1',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    reviewedAt: null,
    rejectReason: null,
    buildPlan: 'a game',
    heardFrom: 'a friend',
    normalizedEmail: 'someone@gmail.com',
    userId: 'user-1',
    email: 'some.one@gmail.com',
    name: 'Some One',
    signals: {
        accountAgeDays: 0,
        signupMethod: 'email',
        githubUsername: null,
        disposableEmail: false,
        accountDeleted: false,
        otherAccountsSameInbox: 2,
        otherRequestsSameIp: 0,
        feedbackCount: 0,
        ipAddress: null,
        userAgent: null,
    },
}

// #624 part 3: the server decides who is an admin; the page only follows it
describe('admin page', () => {
    test('a user the server refuses sees no admin sections', async () => {
        adminAPI.getMe = (async () => {
            throw new Error('Forbidden')
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('This page is for admins only.')).toBeTruthy())
        expect(view.queryByRole('navigation', { name: 'Admin sections' })).toBeNull()
    })

    test('an admin sees pending requests with signals and approves one', async () => {
        const approved: string[] = []
        adminAPI.getMe = (async () => ({ id: 'admin-1', email: 'admin@example.com' })) as any
        adminAPI.listCreditRequests = (async () => ({ items: [pendingRequest] })) as any
        adminAPI.approveCreditRequest = (async (id: string) => {
            approved.push(id)
            return {}
        }) as any

        const view = renderPage()
        await waitFor(() => expect(view.getByText('some.one@gmail.com')).toBeTruthy())
        expect(view.getByText('2 other accounts, same inbox')).toBeTruthy()

        fireEvent.click(view.getByRole('button', { name: 'Approve $5' }))
        await waitFor(() => expect(approved).toEqual(['req-1']))
    })
})
