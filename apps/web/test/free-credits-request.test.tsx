import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, test } from 'bun:test'
import React from 'react'

import { billingAPI } from '../src/features/billing/api/billing'
import { FreeCreditsSection } from '../src/features/profile/components/FreeCreditsSection'

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
            <FreeCreditsSection />
        </QueryClientProvider>
    )

const originalGet = billingAPI.getFreeCreditRequest
const originalRequest = billingAPI.requestFreeCredits

afterEach(() => {
    cleanup()
    // other test files share this module: put the real calls back
    billingAPI.getFreeCreditRequest = originalGet
    billingAPI.requestFreeCredits = originalRequest
})

// #624 part 2: the $5 request lives on the billing page
describe('free credits on the billing page', () => {
    test('a user with no request fills the form and sees it pending', async () => {
        let sent: any = null
        let status: any = null
        billingAPI.getFreeCreditRequest = (async () => status) as any
        billingAPI.requestFreeCredits = (async (data: any) => {
            sent = data
            status = { status: 'PENDING', createdAt: new Date().toISOString(), amountInCents: 500 }
            return status
        }) as any

        const view = renderSection()
        fireEvent.click(await view.findByRole('button', { name: 'Request $5' }))

        const submit = await view.findByRole('button', { name: 'Send request' })
        expect((submit as HTMLButtonElement).disabled).toBe(true)

        typeInto(view.getByLabelText('What will you build with December?'), 'a game')
        typeInto(view.getByLabelText('How did you hear about December?'), 'a friend')
        fireEvent.click(view.getByLabelText('I will give feedback on December'))
        expect((submit as HTMLButtonElement).disabled).toBe(false)
        fireEvent.click(submit)

        await waitFor(() => expect(view.getByText('Requested')).toBeTruthy())
        expect(sent).toEqual({ buildPlan: 'a game', heardFrom: 'a friend', agreeToFeedback: true })
        expect(view.queryByRole('button', { name: 'Request $5' })).toBeNull()
    })

    test('a declined request shows the reason and no button', async () => {
        billingAPI.getFreeCreditRequest = (async () => ({
            status: 'REJECTED',
            createdAt: new Date().toISOString(),
            rejectReason: 'one per person',
            amountInCents: 500,
        })) as any

        const view = renderSection()
        await waitFor(() => expect(view.getByText('Declined: one per person')).toBeTruthy())
        expect(view.queryByRole('button', { name: 'Request $5' })).toBeNull()
    })

    test('an approved request says when the credits were added', async () => {
        billingAPI.getFreeCreditRequest = (async () => ({
            status: 'APPROVED',
            createdAt: '2026-03-01T12:00:00.000Z',
            reviewedAt: '2026-03-05T12:00:00.000Z',
            amountInCents: 500,
        })) as any

        const view = renderSection()
        await waitFor(() => expect(view.getByText(/^Added on /)).toBeTruthy())
        expect(view.queryByRole('button', { name: 'Request $5' })).toBeNull()
    })

    test('a pending request says Requested and has no button', async () => {
        billingAPI.getFreeCreditRequest = (async () => ({
            status: 'PENDING',
            createdAt: '2026-03-01T12:00:00.000Z',
            amountInCents: 500,
        })) as any

        const view = renderSection()
        await waitFor(() => expect(view.getByText('Requested')).toBeTruthy())
        expect(view.queryByRole('button', { name: 'Request $5' })).toBeNull()
    })

    test('the dialog has its grey line, and a refusal from the server shows in it', async () => {
        billingAPI.getFreeCreditRequest = (async () => null) as any
        billingAPI.requestFreeCredits = (async () => {
            throw new Error('free credits were already requested for this email')
        }) as any

        const view = renderSection()
        fireEvent.click(await view.findByRole('button', { name: 'Request $5' }))
        expect(view.getByText('One time for each person. We read each request.')).toBeTruthy()

        typeInto(view.getByLabelText('What will you build with December?'), 'a game')
        typeInto(view.getByLabelText('How did you hear about December?'), 'a friend')
        fireEvent.click(view.getByLabelText('I will give feedback on December'))
        fireEvent.click(view.getByRole('button', { name: 'Send request' }))

        await view.findByText('free credits were already requested for this email')
        // the dialog stays open, so the user can read it
        expect(view.getByRole('button', { name: 'Send request' })).toBeTruthy()
    })

    test('Send stays off until the plan has 3 letters, the source is filled and the box is ticked', async () => {
        billingAPI.getFreeCreditRequest = (async () => null) as any
        const view = renderSection()
        fireEvent.click(await view.findByRole('button', { name: 'Request $5' }))
        const submit = view.getByRole('button', { name: 'Send request' }) as HTMLButtonElement

        typeInto(view.getByLabelText('What will you build with December?'), 'ab')
        typeInto(view.getByLabelText('How did you hear about December?'), 'x')
        fireEvent.click(view.getByLabelText('I will give feedback on December'))
        expect(submit.disabled).toBe(true)

        typeInto(view.getByLabelText('What will you build with December?'), 'abc')
        expect(submit.disabled).toBe(false)
    })
})
