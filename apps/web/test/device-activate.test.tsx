import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { DeviceActivate } from '../src/features/auth/components/DeviceActivate'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, screen, fireEvent, waitFor } = await import('@testing-library/react')

// /activate: the page behind the link that `december login` prints

const CODE = 'K7QM-2XRD'

interface Call {
    path: string
    method: string
    body: string
}

let calls: Call[] = []
let signedIn = true
let deviceStatus = { activated: false, status: 'pending' }
let verifyReply: { status: number; message: string; data?: unknown } = {
    status: 200,
    message: 'ok',
    data: { status: 'approved' },
}

const json = (status: number, message: string, data?: unknown) =>
    new Response(JSON.stringify({ success: status < 400, message, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const originalFetch = globalThis.fetch

const verifyCalls = () => calls.filter((c) => c.path.includes('/auth/device/verify'))

const renderPage = (search = `?code=${CODE}`) =>
    render(
        <MemoryRouter initialEntries={[`/activate${search}`]}>
            <QueryClientProvider
                client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
            >
                <GoogleOAuthProvider clientId="test-client-id">
                    <DeviceActivate />
                </GoogleOAuthProvider>
            </QueryClientProvider>
        </MemoryRouter>
    )

// focus, change, keyup: typing that works whatever order the test files load react-dom in
const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

/** time for the page to make any request it would make by itself */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60))

describe('device sign-in page (/activate)', () => {
    beforeEach(() => {
        calls = []
        signedIn = true
        deviceStatus = { activated: false, status: 'pending' }
        verifyReply = { status: 200, message: 'ok', data: { status: 'approved' } }
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = String(input)
            calls.push({ path, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
            if (path.endsWith('/setting')) {
                return signedIn
                    ? json(200, 'ok', { id: 'u1', name: 'Dev', email: 'dev@example.com' })
                    : json(401, 'unauthorized')
            }
            if (path.includes('/auth/refresh')) return json(401, 'unauthorized')
            if (path.includes('/auth/device/status')) return json(200, 'ok', deviceStatus)
            if (path.includes('/auth/device/verify')) {
                return json(verifyReply.status, verifyReply.message, verifyReply.data)
            }
            if (path.includes('/auth/signout')) {
                signedIn = false
                return json(200, 'ok')
            }
            return json(404, 'not found')
        }) as typeof fetch
    })

    afterEach(() => {
        cleanup()
        globalThis.fetch = originalFetch
        window.localStorage.clear()
    })

    test('signed in with the code in the link: shows the code and waits for a click', async () => {
        const { container } = renderPage()

        await screen.findByText('dev@example.com')
        const input = screen.getByLabelText('Code from your terminal') as HTMLInputElement
        expect(input.value).toBe(CODE)
        expect(input.readOnly).toBe(true)

        // the page never approves a code by itself
        await settle()
        expect(verifyCalls()).toHaveLength(0)

        // the look of the sign-up page: 36px logo, 340px column, no heading, no terms line
        expect(container.querySelector('svg')?.getAttribute('class')).toContain('w-[36px]')
        expect(container.querySelector('.max-w-\\[340px\\]')).not.toBeNull()
        expect(screen.queryByRole('heading')).toBeNull()
        expect(screen.queryByText(/By continuing/)).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
        await screen.findByText('December CLI is signed in. You can close this tab.')
        expect(verifyCalls()).toHaveLength(1)
        expect(JSON.parse(verifyCalls()[0]!.body)).toEqual({ userCode: CODE })
        // the done page has nothing to select
        expect(screen.queryByRole('button')).toBeNull()
    })

    test('signed out: the sign-in page opens, and nothing is approved', async () => {
        signedIn = false
        renderPage()

        await screen.findByText('Log in to continue to December CLI')
        // the sign-up page opens on top by itself
        await screen.findByRole('button', { name: 'Continue with GitHub' })
        // one "Log in" on the page under it, the others belong to the sign-up page
        expect(screen.getAllByRole('button', { name: 'Log in' }).length).toBeGreaterThan(1)
        await settle()
        expect(verifyCalls()).toHaveLength(0)
        expect(screen.queryByRole('button', { name: 'Authorize' })).toBeNull()
    })

    test('no code in the link: Authorize waits for the 8 characters', async () => {
        renderPage('')

        await screen.findByText('Enter the code from your terminal')
        const input = screen.getByLabelText('Code from your terminal') as HTMLInputElement
        const authorize = screen.getByRole('button', { name: 'Authorize' }) as HTMLButtonElement
        expect(input.readOnly).toBe(false)
        expect(authorize.disabled).toBe(true)

        typeInto(input, 'k7qm2xrd')
        expect(input.value).toBe(CODE)
        expect(authorize.disabled).toBe(false)
    })

    test('a wrong typed code shows one red line and the code can be typed again', async () => {
        verifyReply = { status: 404, message: 'Invalid code' }
        renderPage('')

        await screen.findByText('Enter the code from your terminal')
        const input = screen.getByLabelText('Code from your terminal') as HTMLInputElement
        typeInto(input, 'AAAABBBB')
        fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))

        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toBe('This code is not valid or has expired.')
        expect(alert.className).toContain('text-red-400')
        // the line sits between the code box and the button
        const form = input.closest('form')!
        expect(Array.from(form.children).map((el) => el.tagName)).toEqual(['INPUT', 'P', 'BUTTON'])

        typeInto(input, 'CCCCDDDD')
        expect(screen.queryByRole('alert')).toBeNull()
    })

    test('a used code in the link shows the "run it again" page', async () => {
        deviceStatus = { activated: true, status: 'already_activated' }
        renderPage()

        await screen.findByText(/This code is used or expired/)
        expect(screen.getByText('december login')).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Authorize' })).toBeNull()
        expect(verifyCalls()).toHaveLength(0)
    })

    test('a code from the link that expires before the click shows the same page', async () => {
        verifyReply = { status: 400, message: 'This code has expired' }
        renderPage()

        await screen.findByText('dev@example.com')
        fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
        await screen.findByText(/This code is used or expired/)
    })

    test('a reload after approval shows the done page', async () => {
        const first = renderPage()
        await screen.findByText('dev@example.com')
        fireEvent.click(screen.getByRole('button', { name: 'Authorize' }))
        await screen.findByText('December CLI is signed in. You can close this tab.')
        first.unmount()

        // the server now reports the code as used
        deviceStatus = { activated: true, status: 'already_activated' }
        renderPage()
        await settle()
        expect(screen.getByText('December CLI is signed in. You can close this tab.')).toBeDefined()
    })

    test('"Use a different account" signs out and opens the sign-in page', async () => {
        renderPage()

        await screen.findByText('dev@example.com')
        fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }))

        await screen.findByRole('button', { name: 'Continue with GitHub' })
        await waitFor(() =>
            expect(calls.some((c) => c.path.includes('/auth/signout') && c.method === 'POST')).toBe(
                true
            )
        )
        await screen.findByText('Log in to continue to December CLI')
        expect(screen.queryByText('dev@example.com')).toBeNull()
        expect(verifyCalls()).toHaveLength(0)
    })
})
