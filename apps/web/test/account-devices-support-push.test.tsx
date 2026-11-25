import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

import { useAppStore } from '../src/app/store'
import { useNavigationController } from '../src/features/navigation/hooks/useNavigationController'
import { AccountNotificationsSection } from '../src/features/profile/components/AccountNotificationsSection'
import { AccountSections } from '../src/features/profile/components/AccountSections'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, screen, fireEvent, waitFor } = await import('@testing-library/react')

// #636: devices, support access and browser push on the Account page, against the server

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/this-browser'

interface Call {
    path: string
    method: string
    body: unknown
}

let calls: Call[] = []
// what the server answers
let publicKey: string | null = 'AQIDBA'
let subscribedOnServer = false

const json = (status: number, data?: unknown) =>
    new Response(JSON.stringify({ success: status < 400, message: 'ok', data }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

const sent = (method: string, pathEnd: string) =>
    calls.filter((call) => call.method === method && call.path.endsWith(pathEnd))

// the browser's push: one subscription for the site, kept when another user signs in
let browserSubscription: { endpoint: string } | null = null
let browserUnsubscribes = 0

const makeSubscription = () => ({
    endpoint: ENDPOINT,
    toJSON: () => ({
        endpoint: ENDPOINT,
        keys: { p256dh: 'browser-p256dh', auth: 'browser-auth' },
    }),
    unsubscribe: async () => {
        browserUnsubscribes += 1
        browserSubscription = null
        return true
    },
})

const registration = {
    pushManager: {
        getSubscription: async () => browserSubscription,
        subscribe: async () => {
            browserSubscription = makeSubscription()
            return browserSubscription
        },
    },
}

const fakeServiceWorker = {
    getRegistration: async () => registration,
    register: async () => registration,
    ready: Promise.resolve(registration),
}
const fakeNotification = { permission: 'default', requestPermission: async () => 'granted' }

const originalFetch = globalThis.fetch
const originalReplace = window.location.replace

const setGlobal = (name: string, value: unknown) => {
    for (const target of [globalThis, window] as object[]) {
        Object.defineProperty(target, name, { value, configurable: true, writable: true })
    }
}

/** a browser with push (happy-dom has none), or one without it */
const setBrowserPush = (supported: boolean) => {
    if (supported) {
        Object.defineProperty(navigator, 'serviceWorker', {
            value: fakeServiceWorker,
            configurable: true,
        })
        setGlobal('PushManager', class {})
        setGlobal('Notification', fakeNotification)
    } else {
        delete (navigator as unknown as Record<string, unknown>).serviceWorker
        for (const target of [globalThis, window] as unknown as Record<string, unknown>[]) {
            delete target.PushManager
            delete target.Notification
        }
    }
}

const wrap = (node: React.ReactNode) =>
    render(
        <MemoryRouter>
            <QueryClientProvider
                client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
            >
                {node}
            </QueryClientProvider>
        </MemoryRouter>
    )

beforeEach(() => {
    calls = []
    publicKey = 'AQIDBA'
    subscribedOnServer = false
    browserSubscription = null
    browserUnsubscribes = 0
    setBrowserPush(true)
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input)
        const method = init?.method ?? 'GET'
        calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })

        if (path.includes('/auth/refresh')) return json(401)
        if (path.endsWith('/auth/sessions')) {
            return json(200, [
                {
                    id: 'session-here',
                    label: 'Chrome on Windows',
                    kind: 'web',
                    lastActiveAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    isCurrent: true,
                },
                {
                    id: 'session-cli',
                    label: 'December CLI on Linux',
                    kind: 'cli',
                    lastActiveAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    isCurrent: false,
                },
            ])
        }
        if (path.includes('/auth/sessions/')) {
            return json(200, { id: path.split('/').pop(), isCurrent: false })
        }
        if (path.endsWith('/auth/signout')) return json(200)
        if (path.endsWith('/setting/support-access')) {
            return json(200, { supportAccessUntil: '2026-12-02T10:00:00.000Z' })
        }
        if (path.endsWith('/setting/export')) return json(200, { export: null })
        if (path.endsWith('/setting')) {
            return json(200, { id: 'user-1', email: 'dev@example.com', supportAccessUntil: null })
        }
        if (path.endsWith('/notification/push/key')) return json(200, { publicKey })
        if (path.endsWith('/notification/push/status')) {
            return json(200, { subscribed: subscribedOnServer })
        }
        if (path.endsWith('/notification/push/subscribe')) {
            subscribedOnServer = method === 'POST'
            return method === 'POST'
                ? json(201, { notifyPush: true })
                : json(200, { notifyPush: false, devices: 0 })
        }
        return json(404)
    }) as typeof fetch
})

afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    window.location.replace = originalReplace
    setBrowserPush(false)
    useAppStore.setState({ isAuthenticated: false, isAuthRestored: false })
})

describe('account page: devices and support access', () => {
    const renderSections = (onSignOut = () => {}) =>
        wrap(
            <AccountSections
                onSignOut={onSignOut}
                onOpenSignOutAllSessionsModal={() => {}}
                onOpenDeleteAccountModal={() => {}}
            />
        )

    test('"Sign out" on a device row sends the DELETE for that device', async () => {
        renderSections()

        fireEvent.click(
            await screen.findByRole('button', { name: 'Sign out December CLI on Linux' })
        )

        await waitFor(() => expect(sent('DELETE', '/auth/sessions/session-cli')).toHaveLength(1))
        // the list is read again after it
        await waitFor(() => expect(sent('GET', '/auth/sessions').length).toBeGreaterThan(1))
    })

    test('"Sign out" on this device signs out the normal way, with no DELETE', async () => {
        let signedOut = 0
        renderSections(() => {
            signedOut += 1
        })

        fireEvent.click(await screen.findByRole('button', { name: 'Sign out Chrome on Windows' }))

        expect(signedOut).toBe(1)
        expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)
    })

    test('the support switch sends the PATCH', async () => {
        renderSections()
        await screen.findByText('December CLI on Linux')

        const toggle = screen.getByRole('switch', {
            name: 'Let December support open my sessions',
        })
        expect(toggle.getAttribute('aria-checked')).toBe('false')
        fireEvent.click(toggle)

        await waitFor(() => expect(sent('PATCH', '/setting/support-access')).toHaveLength(1))
        expect(sent('PATCH', '/setting/support-access')[0]?.body).toEqual({ enabled: true })
    })
})

describe('account page: browser push', () => {
    const renderNotifications = () =>
        wrap(<AccountNotificationsSection onNotificationChange={() => {}} />)

    const pushSwitch = () => screen.findByRole('switch', { name: 'Browser push' })
    const isOn = (el: HTMLElement) => el.getAttribute('aria-checked') === 'true'
    const isReady = (el: HTMLElement) => !el.hasAttribute('disabled')

    test('turning it on sends the subscribe POST with the browser subscription', async () => {
        renderNotifications()
        const toggle = await pushSwitch()
        await waitFor(() => expect(isReady(toggle)).toBe(true))
        expect(isOn(toggle)).toBe(false)

        fireEvent.click(toggle)

        await waitFor(() => expect(sent('POST', '/notification/push/subscribe')).toHaveLength(1))
        expect(sent('POST', '/notification/push/subscribe')[0]?.body).toEqual({
            endpoint: ENDPOINT,
            keys: { p256dh: 'browser-p256dh', auth: 'browser-auth' },
        })
        await waitFor(() => expect(isOn(toggle)).toBe(true))
    })

    test('turning it off sends the DELETE and ends the browser subscription', async () => {
        browserSubscription = makeSubscription()
        subscribedOnServer = true
        renderNotifications()
        const toggle = await pushSwitch()
        await waitFor(() => expect(isOn(toggle)).toBe(true))

        fireEvent.click(toggle)

        await waitFor(() => expect(sent('DELETE', '/notification/push/subscribe')).toHaveLength(1))
        expect(sent('DELETE', '/notification/push/subscribe')[0]?.body).toEqual({
            endpoint: ENDPOINT,
        })
        await waitFor(() => expect(isOn(toggle)).toBe(false))
        expect(browserUnsubscribes).toBe(1)
    })

    test('with no VAPID key from the server the switch is hidden', async () => {
        publicKey = null
        renderNotifications()

        await waitFor(() => expect(sent('GET', '/notification/push/key')).toHaveLength(1))
        await waitFor(() =>
            expect(screen.queryByRole('switch', { name: 'Browser push' })).toBeNull()
        )
        // the other rows are there
        expect(screen.getByRole('switch', { name: 'Email' })).toBeDefined()
    })

    test('the switch shows the server state for this user, not what the browser has', async () => {
        // the last user of this browser had push on and the browser kept its subscription
        browserSubscription = makeSubscription()
        subscribedOnServer = false
        renderNotifications()
        const toggle = await pushSwitch()

        await waitFor(() => expect(isReady(toggle)).toBe(true))
        expect(isOn(toggle)).toBe(false)
        expect(sent('POST', '/notification/push/status')[0]?.body).toEqual({ endpoint: ENDPOINT })
    })
})

describe('sign out and browser push', () => {
    const signOut = async () => {
        window.location.replace = (() => {}) as typeof window.location.replace
        useAppStore.setState({ isAuthenticated: true, isAuthRestored: true })
        let handleSignOut: (() => Promise<void>) | null = null
        const Harness = () => {
            handleSignOut = useNavigationController().handleSignOut
            return null
        }
        wrap(<Harness />)
        await handleSignOut!()
    }

    test('sign out turns push off for this browser first, then signs out', async () => {
        browserSubscription = makeSubscription()
        subscribedOnServer = true

        await signOut()

        const order = calls
            .filter((call) => call.method !== 'GET')
            .map((call) => `${call.method} ${call.path.replace(/^.*\/api\/v1/, '')}`)
        expect(order).toEqual(['DELETE /notification/push/subscribe', 'POST /auth/signout'])
        expect(sent('DELETE', '/notification/push/subscribe')[0]?.body).toEqual({
            endpoint: ENDPOINT,
        })
        // the next user of this browser starts with no subscription
        expect(browserUnsubscribes).toBe(1)
        expect(browserSubscription).toBeNull()
    })

    test('sign out with no push in this browser only signs out', async () => {
        await signOut()

        expect(sent('DELETE', '/notification/push/subscribe')).toHaveLength(0)
        expect(sent('POST', '/auth/signout')).toHaveLength(1)
    })
})
