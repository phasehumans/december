import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'

import { AdminWaitlist } from '../src/features/admin/components/AdminWaitlist'
import { waitlistAPI } from '../src/features/supercrew/api/waitlist'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, waitFor, fireEvent } = await import('@testing-library/react')

// focus, change, keyup: typing that works whatever order the test files load react-dom in
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const renderSection = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <AdminWaitlist />
        </QueryClientProvider>
    )

afterEach(() => {
    cleanup()
})

const list = (notifiedAt: string | null) => ({
    feature: 'super-crew',
    joinedCount: 2,
    notifiedCount: notifiedAt ? 1 : 0,
    items: [
        {
            userId: 'u-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            joinedAt: '2026-11-23T10:00:00.000Z',
            notifiedAt,
        },
        {
            userId: 'u-2',
            name: 'Alan Turing',
            email: 'alan@example.com',
            joinedAt: '2026-11-22T10:00:00.000Z',
            notifiedAt: null,
        },
    ],
})

// #630: admin view of who asked for super crew, and the launch-day send
describe('admin waitlist section', () => {
    test('shows who joined and how many were notified', async () => {
        waitlistAPI.listEntries = (async () => list(null)) as any

        const view = renderSection()
        await waitFor(() => expect(view.getByText('ada@example.com')).toBeTruthy())
        expect(view.getByText('alan@example.com')).toBeTruthy()
        expect(view.getByText('2 joined · 0 notified')).toBeTruthy()
    })

    test('launch asks to confirm, sends, then shows who was notified', async () => {
        let current = list(null)
        const launched: unknown[] = []
        waitlistAPI.listEntries = (async () => current) as any
        waitlistAPI.launch = (async (_feature: string, input: unknown) => {
            launched.push(input)
            current = list('2026-11-24T10:00:00.000Z')
            return { sentCount: 1, failedCount: 1 }
        }) as any

        const view = renderSection()
        await waitFor(() => expect(view.getByText('ada@example.com')).toBeTruthy())

        typeInto(view.getByLabelText('Subject'), 'super crew is live')
        typeInto(view.getByLabelText('Body'), 'hi {name}, go')
        typeInto(view.getByLabelText('Inbox line'), 'it is here')

        const sendLaunch = view.getByRole('button', { name: 'Send launch' }) as HTMLButtonElement
        await waitFor(() => expect(sendLaunch.disabled).toBe(false))
        fireEvent.click(sendLaunch)
        expect(launched).toHaveLength(0)
        fireEvent.click(await view.findByRole('button', { name: 'Send to 2 people now' }))

        await waitFor(() =>
            expect(view.getByText('Sent 1 · 1 failed, send again to retry')).toBeTruthy()
        )
        expect(launched).toEqual([
            { subject: 'super crew is live', body: 'hi {name}, go', inboxMessage: 'it is here' },
        ])
        await waitFor(() => expect(view.getByText('2 joined · 1 notified')).toBeTruthy())
        expect(view.getByText('Notified')).toBeTruthy()
    })
})
