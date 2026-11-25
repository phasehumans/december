import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { InviteAccept } from '../src/features/profile/components/InviteAccept'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, screen, fireEvent } = await import('@testing-library/react')

// /invite/:token, the page behind the link of a team invite mail (#640)

const TOKEN = 'Zq3vT8n1kXw0pLr5uYb7cMd9eHf2gJa4sNi6oKt8vWx'

interface Call {
    path: string
    method: string
    body: string
}

let calls: Call[] = []
let signedIn = true
let preview: { status: number; data?: Record<string, unknown> }
let acceptReply: { status: number; message: string; data?: unknown }

const json = (status: number, message: string, data?: unknown) =>
    new Response(JSON.stringify({ success: status < 400, message, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const originalFetch = globalThis.fetch

const acceptCalls = () => calls.filter((c) => c.path.endsWith('/team/invites/accept'))

const renderPage = () =>
    render(
        <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
            <QueryClientProvider
                client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
            >
                <GoogleOAuthProvider clientId="test-client-id">
                    <Routes>
                        <Route path="/invite/:token" element={<InviteAccept />} />
                    </Routes>
                </GoogleOAuthProvider>
            </QueryClientProvider>
        </MemoryRouter>
    )

/** time for the page to make any request it would make by itself */
const settle = () => new Promise((resolve) => setTimeout(resolve, 60))

describe('team invite page (/invite/:token)', () => {
    beforeEach(() => {
        calls = []
        signedIn = true
        preview = {
            status: 200,
            data: {
                teamName: 'Kiln Labs',
                inviterName: 'Asha Rao',
                role: 'ADMIN',
                email: 'd***@example.com',
                expired: false,
                emailMatches: true,
            },
        }
        acceptReply = {
            status: 200,
            message: 'ok',
            data: { team: { id: 'team-1', name: 'Kiln Labs' }, role: 'ADMIN' },
        }
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = String(input)
            calls.push({ path, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
            if (path.endsWith('/setting')) {
                return signedIn
                    ? json(200, 'ok', { id: 'u1', name: 'Dev', email: 'dev@example.com' })
                    : json(401, 'unauthorized')
            }
            if (path.includes('/auth/refresh')) return json(401, 'unauthorized')
            if (path.endsWith('/team/invites/accept')) {
                return json(acceptReply.status, acceptReply.message, acceptReply.data)
            }
            if (path.endsWith(`/team/invites/${TOKEN}`)) {
                return json(preview.status, 'invite', preview.data)
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

    test('signed in: shows the team, the inviter and the role, and joins on a click', async () => {
        renderPage()

        await screen.findByText('Asha Rao invited you to the team Kiln Labs as an admin.')
        // the page never joins by itself
        await settle()
        expect(acceptCalls()).toHaveLength(0)

        fireEvent.click(screen.getByRole('button', { name: 'Join' }))

        await screen.findByText('You are in the team Kiln Labs now.')
        expect(acceptCalls()).toHaveLength(1)
        expect(acceptCalls()[0]!.method).toBe('POST')
        expect(JSON.parse(acceptCalls()[0]!.body)).toEqual({ token: TOKEN })
        expect(screen.getByRole('link', { name: 'Open December' }).getAttribute('href')).toBe(
            '/settings/members'
        )
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
    })

    test('signed out: the sign-in page opens on the invite, and nothing is joined', async () => {
        signedIn = false
        preview.data = { ...preview.data, emailMatches: undefined }
        renderPage()

        await screen.findByText('Asha Rao invited you to the team Kiln Labs as an admin.')
        // the sign-up page opens on top by itself
        await screen.findByRole('button', { name: 'Continue with GitHub' })
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
        await settle()
        expect(acceptCalls()).toHaveLength(0)
    })

    test('another account: says which email the invite is for, with no Join', async () => {
        preview.data = { ...preview.data, emailMatches: false }
        renderPage()

        await screen.findByText(/This invite is for d\*\*\*@example\.com/)
        expect(screen.getByText('dev@example.com')).toBeDefined()
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
        expect(screen.getByRole('button', { name: 'Use a different account' })).toBeDefined()
        await settle()
        expect(acceptCalls()).toHaveLength(0)
    })

    test('an expired invite and an unknown link show one line and no Join', async () => {
        preview.data = { ...preview.data, expired: true }
        const first = renderPage()
        await screen.findByText('This invite is used or expired. Ask for a new one.')
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
        first.unmount()

        preview = { status: 404 }
        renderPage()
        await screen.findByText('This invite is used or expired. Ask for a new one.')
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull()
    })

    test('a join the server refuses shows the reason', async () => {
        acceptReply = { status: 403, message: 'verify your email address to join a team' }
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Join' }))

        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toBe('Verify your email address to join a team')
    })
})
