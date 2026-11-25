import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, screen, fireEvent, waitFor, within } =
    await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { ProfileMembersSettings } =
    await import('../src/features/profile/components/ProfileMembersSettings')

// the members page of settings on the team api (#640)

interface Call {
    path: string
    method: string
    body: string
}

const team = () => ({
    team: { id: 'team-1', name: 'Asha Rao', createdAt: '2026-11-01T10:00:00.000Z' },
    role: 'OWNER',
    members: [
        {
            userId: 'u-asha',
            name: 'Asha Rao',
            email: 'asha@example.com',
            role: 'OWNER',
            joinedAt: '2026-11-01T10:00:00.000Z',
        },
        {
            userId: 'u-arjun',
            name: 'Arjun Mehta',
            email: 'arjun@example.com',
            role: 'ADMIN',
            joinedAt: '2026-11-18T10:00:00.000Z',
        },
    ],
    invites: [
        {
            id: 'inv-1',
            email: 'meera@example.com',
            role: 'MEMBER',
            invitedBy: 'Asha Rao',
            expiresAt: '2026-12-03T10:00:00.000Z',
            createdAt: '2026-11-26T10:00:00.000Z',
        },
    ],
    memberOf: [{ teamId: 'team-9', name: 'Kiln Labs', ownerName: 'Kabir Das', role: 'MEMBER' }],
})

let calls: Call[] = []
let teamData = team()
let inviteReply: { status: number; message: string } = { status: 201, message: 'ok' }

const json = (status: number, message: string, data?: unknown) =>
    new Response(JSON.stringify({ success: status < 400, message, data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const originalFetch = globalThis.fetch

/** the requests that change something */
const writes = () => calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path}`)

const typeInto = (el: HTMLElement, value: string) => {
    fireEvent.focusIn(el)
    fireEvent.change(el, { target: { value } })
    fireEvent.keyUp(el)
    fireEvent.focusOut(el)
}

const renderPage = () =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            <ProfileMembersSettings ownerName="Asha Rao" ownerEmail="asha@example.com" />
        </QueryClientProvider>
    )

describe('members page on the team api', () => {
    beforeEach(() => {
        calls = []
        teamData = team()
        inviteReply = { status: 201, message: 'ok' }
        setConnectionsDemo(false)
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const path = String(input).replace(/^.*\/api\/v1/, '')
            const method = init?.method ?? 'GET'
            calls.push({ path, method, body: String(init?.body ?? '') })
            if (path === '/team' && method === 'GET') return json(200, 'ok', teamData)
            if (path === '/team/invites' && method === 'POST') {
                return json(inviteReply.status, inviteReply.message, { invite: {} })
            }
            if (path.startsWith('/team/audit')) {
                return json(200, 'ok', {
                    events: [
                        {
                            id: 'e2',
                            action: 'member.role_changed',
                            target: 'arjun@example.com',
                            ip: '203.0.113.7',
                            metadata: { from: 'MEMBER', to: 'ADMIN' },
                            createdAt: '2026-11-20T09:30:00.000Z',
                            actor: { id: 'u-asha', name: 'Asha Rao', email: 'asha@example.com' },
                        },
                        {
                            id: 'e1',
                            action: 'member.joined',
                            target: 'arjun@example.com',
                            ip: null,
                            metadata: { role: 'MEMBER' },
                            createdAt: '2026-11-18T10:00:00.000Z',
                            actor: null,
                        },
                    ],
                    pagination: { total: 2, page: 1, limit: 50, totalPages: 1 },
                })
            }
            if (path.startsWith('/team/')) return json(200, 'ok', {})
            return json(404, 'not found')
        }) as typeof fetch
    })

    afterEach(() => {
        cleanup()
        globalThis.fetch = originalFetch
        setConnectionsDemo(null)
    })

    test('lists the members, the open invites and the teams the user is in', async () => {
        renderPage()

        await screen.findByText('Arjun Mehta')
        expect(
            screen.getByText('Invite people to your team. Shared sessions and billing come later.')
        ).toBeDefined()
        expect(screen.queryByText('Team accounts are coming soon')).toBeNull()
        expect(screen.getByText('asha@example.com · You')).toBeDefined()
        expect(screen.getByText('arjun@example.com · Joined Nov 18')).toBeDefined()
        // the owner has no role select and no Remove
        expect(screen.queryByLabelText('Role of Asha Rao')).toBeNull()
        expect((screen.getByLabelText('Role of Arjun Mehta') as HTMLSelectElement).value).toBe(
            'ADMIN'
        )

        expect(screen.getByText('meera@example.com')).toBeDefined()
        expect(screen.getByText('Invited · Member')).toBeDefined()

        expect(screen.getByText('Teams you are in')).toBeDefined()
        expect(screen.getByText('Kiln Labs')).toBeDefined()
        expect(screen.getByText('Owner Kabir Das · Member')).toBeDefined()
        expect(writes()).toEqual([])
    })

    test('search filters members and invites', async () => {
        renderPage()
        await screen.findByText('Arjun Mehta')

        typeInto(screen.getByPlaceholderText('Search members'), 'meera')
        expect(screen.queryByText('Arjun Mehta')).toBeNull()
        expect(screen.getByText('meera@example.com')).toBeDefined()

        typeInto(screen.getByPlaceholderText('Search members'), 'nobody')
        expect(screen.getByText('No members match')).toBeDefined()
    })

    test('invite sends the email and the role, then reads the team again', async () => {
        renderPage()
        await screen.findByText('Arjun Mehta')

        fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
        const email = screen.getByLabelText('Email')
        typeInto(email, 'not-an-email')
        fireEvent.submit(email.closest('form')!)
        expect(screen.getByRole('alert').textContent).toContain('Enter an email address')
        expect(writes()).toEqual([])

        typeInto(email, ' Sam@Example.com ')
        fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'ADMIN' } })
        fireEvent.submit(email.closest('form')!)

        await waitFor(() => expect(writes()).toEqual(['POST /team/invites']))
        const sent = calls.find((c) => c.method === 'POST')!
        expect(JSON.parse(sent.body)).toEqual({ email: 'sam@example.com', role: 'ADMIN' })
        // the dialog closes and the list is read again
        await waitFor(() => expect(screen.queryByLabelText('Email')).toBeNull())
        await waitFor(() =>
            expect(calls.filter((c) => c.path === '/team' && c.method === 'GET').length).toBe(2)
        )
    })

    test('an invite the server refuses shows the reason and keeps the dialog open', async () => {
        inviteReply = { status: 409, message: 'this person has an invite already' }
        renderPage()
        await screen.findByText('Arjun Mehta')

        fireEvent.click(screen.getByRole('button', { name: 'Invite' }))
        const email = screen.getByLabelText('Email')
        typeInto(email, 'meera@example.com')
        fireEvent.submit(email.closest('form')!)

        const alert = await screen.findByRole('alert')
        expect(alert.textContent).toBe('This person has an invite already')
        expect(screen.getByLabelText('Email')).toBeDefined()
    })

    test('a role change sends the PATCH for that member', async () => {
        renderPage()
        const select = await screen.findByLabelText('Role of Arjun Mehta')

        fireEvent.change(select, { target: { value: 'MEMBER' } })

        await waitFor(() => expect(writes()).toEqual(['PATCH /team/members/u-arjun']))
        expect(JSON.parse(calls.find((c) => c.method === 'PATCH')!.body)).toEqual({
            role: 'MEMBER',
        })
    })

    test('remove asks first, then sends the DELETE for that member', async () => {
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Remove Arjun Mehta' }))
        expect(writes()).toEqual([])

        expect(screen.getByText('Remove Arjun Mehta?')).toBeDefined()
        // the row button is named "Remove Arjun Mehta", the button of the dialog "Remove"
        fireEvent.submit(screen.getByRole('button', { name: 'Remove' }).closest('form')!)

        await waitFor(() => expect(writes()).toEqual(['DELETE /team/members/u-arjun']))
    })

    test('revoke sends the DELETE for that invite', async () => {
        renderPage()
        fireEvent.click(
            await screen.findByRole('button', { name: 'Revoke the invite of meera@example.com' })
        )

        await waitFor(() => expect(writes()).toEqual(['DELETE /team/invites/inv-1']))
    })

    test('leave sends the DELETE for the own user in the other team', async () => {
        renderPage()
        fireEvent.click(await screen.findByRole('button', { name: 'Leave Kiln Labs' }))
        expect(screen.getByText('Leave Kiln Labs?')).toBeDefined()
        fireEvent.submit(screen.getByRole('button', { name: 'Leave' }).closest('form')!)

        await waitFor(() => expect(writes()).toEqual(['DELETE /team/members/u-asha?teamId=team-9']))
    })

    test('no "teams you are in" section for a user who joined no team', async () => {
        teamData = { ...team(), memberOf: [] }
        renderPage()
        await screen.findByText('Arjun Mehta')
        expect(screen.queryByText('Teams you are in')).toBeNull()
    })

    test('the audit log opens as a list with a link to the csv export', async () => {
        renderPage()
        await screen.findByText('Arjun Mehta')

        fireEvent.click(screen.getByRole('button', { name: 'View the audit log' }))

        await screen.findByText('Role changed')
        expect(calls.some((c) => c.path === '/team/audit?page=1&limit=50')).toBe(true)
        expect(screen.getByText('arjun@example.com · Member to Admin')).toBeDefined()
        expect(screen.getByText(/^Asha Rao · Nov 20/)).toBeDefined()
        // the actor of the second row has no account any more
        expect(screen.getByText('Joined')).toBeDefined()
        expect(screen.getByText(/^Deleted account · Nov 18/)).toBeDefined()

        const link = screen.getByRole('link', { name: 'Export CSV' })
        expect(link.getAttribute('href')).toMatch(/\/api\/v1\/team\/audit\/export$/)
    })

    test('single sign-on is not built and has no sample control: Soon, with the preview on too', async () => {
        const first = renderPage()
        await screen.findByText('Arjun Mehta')
        const row = () => screen.getByText('Single sign-on').closest('div')!.parentElement!
        expect(within(row()).getByText('Soon')).toBeDefined()
        expect(screen.queryByText('Demo')).toBeNull()
        first.unmount()

        setConnectionsDemo(true)
        renderPage()
        await screen.findByText('Arjun Mehta')
        expect(within(row()).getByText('Soon')).toBeDefined()
        expect(screen.queryByText('Demo')).toBeNull()
    })
})
