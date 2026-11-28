import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor, within, act } =
    await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { sandboxAPI } = await import('../src/features/profile/api/sandbox')
const { ProfileSandboxSettings, STOPPED_HIDE_MS, formatRunTime } =
    await import('../src/features/profile/components/ProfileSandboxSettings')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')
const { setSkeletonPreview } = await import('../src/shared/lib/skeletonPreview')
const { ApiError } = await import('../src/shared/api/client')

import type {
    RunningSandbox,
    SandboxSettings,
    StoppedSession,
} from '../src/features/profile/api/sandbox'

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    )

const MINUTE = 60 * 1000
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE).toISOString()

const sampleRunning = (): RunningSandbox[] => [
    {
        sessionId: 'session-1',
        title: 'fix-login-redirect',
        repoFullName: 'acme/web',
        startedAt: minutesAgo(38),
        costInCents: 21,
        sandboxStatus: 'RUNNING',
    },
    {
        sessionId: 'session-2',
        title: 'add-csv-export',
        repoFullName: 'acme/api',
        startedAt: minutesAgo(1),
        costInCents: 3,
        sandboxStatus: 'STARTING',
    },
]

/** a promise and the functions that settle it, for a request the test answers by hand */
const deferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

/** the window loses and gets focus, so React Query reads stale lists again */
const refocus = () =>
    act(() => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
    })

describe('sandbox settings page (#637)', () => {
    let settings: SandboxSettings
    let running: RunningSandbox[]
    let patches: unknown[]
    let stops: string[]
    let stopAnswer: (sessionId: string) => Promise<StoppedSession>

    beforeEach(() => {
        cleanup()
        resetPreviewValues()
        setConnectionsDemo(false)
        settings = { idleStopMinutes: 10, archiveAfterDays: null }
        running = sampleRunning()
        patches = []
        stops = []
        stopAnswer = async (sessionId) => ({
            sessionId,
            vmStatus: 'STOPPED',
            sandboxStatus: 'PAUSED',
        })

        spyOn(sandboxAPI, 'getSettings').mockImplementation(async () => ({ ...settings }))
        spyOn(sandboxAPI, 'getRunning').mockImplementation(async () => ({ items: [...running] }))
        spyOn(sandboxAPI, 'updateSettings').mockImplementation(async (patch) => {
            patches.push(patch)
            settings = { ...settings, ...patch }
            return { ...settings }
        })
        spyOn(sandboxAPI, 'stop').mockImplementation(async (sessionId) => {
            stops.push(sessionId)
            return stopAnswer(sessionId)
        })
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
        setSkeletonPreview(null)
        focusManager.setFocused(undefined)
        mock.restore()
    })

    describe('running now', () => {
        test('lists the running sandboxes with repository, time and cost', async () => {
            wrap(<ProfileSandboxSettings />)

            expect(await screen.findByText('fix-login-redirect')).toBeDefined()
            expect(screen.getByText('add-csv-export')).toBeDefined()
            expect(screen.getByText('2 running')).toBeDefined()
            expect(screen.getByText('acme/web · 38 min · $0.21')).toBeDefined()
            expect(screen.getByText('acme/api · Starting · $0.03')).toBeDefined()
        })

        test('a session with no title or repository still reads well', async () => {
            running = [
                {
                    sessionId: 'session-3',
                    title: null,
                    repoFullName: null,
                    startedAt: minutesAgo(125),
                    costInCents: 1234,
                    sandboxStatus: 'RUNNING',
                },
            ]
            wrap(<ProfileSandboxSettings />)

            expect(await screen.findByText('Untitled session')).toBeDefined()
            expect(screen.getByText('2 h 5 min · $12.34')).toBeDefined()
            expect(screen.getByRole('button', { name: 'Stop Untitled session' })).toBeDefined()
            expect(screen.getByText('1 running')).toBeDefined()
        })

        test('shows one grey line when nothing runs, and no count', async () => {
            running = []
            wrap(<ProfileSandboxSettings />)

            const empty = await screen.findByRole('heading', { name: 'No sandbox runs now' })
            expect(empty.parentElement!.querySelector('svg')).not.toBeNull()
            expect(screen.queryByText(/running$/)).toBeNull()
            expect(screen.queryByRole('button', { name: /^Stop/ })).toBeNull()
        })

        test('shows skeleton rows while the list loads', async () => {
            const pending = deferred<{ items: RunningSandbox[] }>()
            ;(sandboxAPI.getRunning as any).mockImplementation(() => pending.promise)
            wrap(<ProfileSandboxSettings />)

            expect(screen.getByTestId('running-skeleton')).toBeDefined()
            expect(screen.queryByText('No sandbox runs now')).toBeNull()

            await act(async () => pending.resolve({ items: sampleRunning() }))
            expect(await screen.findByText('fix-login-redirect')).toBeDefined()
            expect(screen.queryByTestId('running-skeleton')).toBeNull()
        })

        test('a list that did not load says so, and Try again reads it again', async () => {
            let fail = true
            ;(sandboxAPI.getRunning as any).mockImplementation(async () => {
                if (fail) throw new Error('boom')
                return { items: sampleRunning() }
            })
            wrap(<ProfileSandboxSettings />)

            expect(await screen.findByText('Could not load the running sandboxes.')).toBeDefined()
            // the limits still load on their own
            expect(await screen.findByRole('radio', { name: '10 min' })).toBeDefined()

            fail = false
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            expect(await screen.findByText('fix-login-redirect')).toBeDefined()
            expect(screen.queryByText('Could not load the running sandboxes.')).toBeNull()
        })

        test('reads the list again when the window gets focus', async () => {
            wrap(<ProfileSandboxSettings />)
            await screen.findByText('fix-login-redirect')
            expect(sandboxAPI.getRunning).toHaveBeenCalledTimes(1)

            running = [
                ...running,
                {
                    sessionId: 'session-4',
                    title: 'new-run',
                    repoFullName: 'acme/docs',
                    startedAt: minutesAgo(0),
                    costInCents: 0,
                    sandboxStatus: 'STARTING',
                },
            ]
            await refocus()

            expect(await screen.findByText('new-run')).toBeDefined()
            expect(screen.getByText('3 running')).toBeDefined()
        })

        test('a failed refresh keeps the rows that are there', async () => {
            wrap(<ProfileSandboxSettings />)
            await screen.findByText('fix-login-redirect')
            ;(sandboxAPI.getRunning as any).mockImplementation(async () => {
                throw new Error('offline')
            })
            await refocus()
            await waitFor(() => expect(sandboxAPI.getRunning).toHaveBeenCalledTimes(2))

            expect(screen.getByText('fix-login-redirect')).toBeDefined()
            expect(screen.queryByText('Could not load the running sandboxes.')).toBeNull()
        })
    })

    describe('Stop', () => {
        test('sends the stop, and the row leaves the list when the answer says paused', async () => {
            wrap(<ProfileSandboxSettings />)

            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))

            await waitFor(() => expect(stops).toEqual(['session-1']))
            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())
            expect(screen.getByText('add-csv-export')).toBeDefined()
            expect(screen.getByText('1 running')).toBeDefined()
        })

        test('a read before the worker paused the sandbox does not bring the row back', async () => {
            wrap(<ProfileSandboxSettings />)
            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))
            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())

            // the server still lists it as running for a moment (with a new cost, so the
            // page renders the new list)
            running = running.map((item) => ({ ...item, costInCents: item.costInCents + 1 }))
            await refocus()
            await waitFor(() => expect(sandboxAPI.getRunning).toHaveBeenCalledTimes(2))

            await screen.findByText('acme/api · Starting · $0.04')
            expect(screen.queryByText('fix-login-redirect')).toBeNull()
            expect(screen.getByText('1 running')).toBeDefined()
        })

        test('a sandbox that still runs long after the stop shows again', async () => {
            const realNow = Date.now
            wrap(<ProfileSandboxSettings />)
            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))
            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())

            // a new prompt held the sandbox, so the worker did not pause it
            const later = realNow() + STOPPED_HIDE_MS + 1000
            spyOn(Date, 'now').mockImplementation(() => later)
            // the next read (here: on focus; the page also reads every 15 s and renders
            // every 30 s) has its new cost
            running = running.map((item) =>
                item.sessionId === 'session-1' ? { ...item, costInCents: 40 } : item
            )
            await refocus()

            expect(await screen.findByText('fix-login-redirect')).toBeDefined()
            expect(screen.getByText('2 running')).toBeDefined()
        })

        test('the row is gone once the server stops listing it', async () => {
            wrap(<ProfileSandboxSettings />)
            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))
            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())

            running = running.filter((item) => item.sessionId !== 'session-1')
            await refocus()
            await waitFor(() => expect(sandboxAPI.getRunning).toHaveBeenCalledTimes(2))

            expect(screen.queryByText('fix-login-redirect')).toBeNull()
            expect(screen.getByText('1 running')).toBeDefined()
        })

        test('a sandbox that still starts stays in the list after Stop', async () => {
            stopAnswer = async (sessionId) => ({
                sessionId,
                vmStatus: 'STOPPED',
                sandboxStatus: 'STARTING',
            })
            wrap(<ProfileSandboxSettings />)

            fireEvent.click(await screen.findByRole('button', { name: 'Stop add-csv-export' }))

            await waitFor(() => expect(stops).toEqual(['session-2']))
            expect(screen.getByText('add-csv-export')).toBeDefined()
            expect(screen.getByText('acme/api · Starting · $0.03')).toBeDefined()
            expect(screen.getByText('2 running')).toBeDefined()
            await waitFor(() =>
                expect(
                    (
                        screen.getByRole('button', {
                            name: 'Stop add-csv-export',
                        }) as HTMLButtonElement
                    ).disabled
                ).toBe(false)
            )
        })

        test('a row that is stopping shows Stopping and cannot be sent twice', async () => {
            const answer = deferred<StoppedSession>()
            stopAnswer = () => answer.promise
            wrap(<ProfileSandboxSettings />)

            const button = (await screen.findByRole('button', {
                name: 'Stop fix-login-redirect',
            })) as HTMLButtonElement
            fireEvent.click(button)

            await waitFor(() => expect(button.disabled).toBe(true))
            expect(button.textContent).toBe('Stopping')
            fireEvent.click(button)
            expect(stops).toEqual(['session-1'])
            // the other row is not blocked
            const other = screen.getByRole('button', {
                name: 'Stop add-csv-export',
            }) as HTMLButtonElement
            expect(other.disabled).toBe(false)

            await act(async () =>
                answer.resolve({
                    sessionId: 'session-1',
                    vmStatus: 'STOPPED',
                    sandboxStatus: 'PAUSED',
                })
            )
            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())
        })

        test('two stops at once each finish on their own row', async () => {
            const first = deferred<StoppedSession>()
            const second = deferred<StoppedSession>()
            stopAnswer = (sessionId) => (sessionId === 'session-1' ? first.promise : second.promise)
            wrap(<ProfileSandboxSettings />)

            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))
            fireEvent.click(screen.getByRole('button', { name: 'Stop add-csv-export' }))
            await waitFor(() => expect(stops).toEqual(['session-1', 'session-2']))

            // the second answer fails, the first works
            await act(async () => second.reject(new Error('could not stop the session')))
            await act(async () =>
                first.resolve({
                    sessionId: 'session-1',
                    vmStatus: 'STOPPED',
                    sandboxStatus: 'PAUSED',
                })
            )

            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())
            expect(await screen.findByRole('alert')).toBeDefined()
            expect(screen.getByRole('alert').textContent).toBe('could not stop the session')
        })

        test('a failed stop shows the error on its row, and a second try clears it', async () => {
            let fail = true
            stopAnswer = async (sessionId) => {
                if (fail) throw new ApiError('could not stop the session. try again', 503)
                return { sessionId, vmStatus: 'STOPPED', sandboxStatus: 'PAUSED' }
            }
            wrap(<ProfileSandboxSettings />)

            const button = (await screen.findByRole('button', {
                name: 'Stop fix-login-redirect',
            })) as HTMLButtonElement
            fireEvent.click(button)

            const alert = await screen.findByRole('alert')
            expect(alert.textContent).toBe('could not stop the session. try again')
            // the error replaces the grey line of that row only
            expect(screen.queryByText('acme/web · 38 min · $0.21')).toBeNull()
            expect(screen.getByText('acme/api · Starting · $0.03')).toBeDefined()
            expect(screen.getByText('fix-login-redirect')).toBeDefined()
            await waitFor(() => expect(button.disabled).toBe(false))
            expect(button.textContent).toBe('Stop')
            // the list is read again, in case the session is gone
            await waitFor(() => expect(sandboxAPI.getRunning).toHaveBeenCalledTimes(2))

            fail = false
            fireEvent.click(button)
            await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())
        })

        test('a stop error with no message has a plain fallback', async () => {
            stopAnswer = async () => {
                throw new Error('')
            }
            wrap(<ProfileSandboxSettings />)

            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))

            expect((await screen.findByRole('alert')).textContent).toBe(
                'Could not stop. Try again.'
            )
        })

        test('a stop for a session that is gone takes the row away on the next read', async () => {
            stopAnswer = async () => {
                throw new ApiError('Session not found', 404)
            }
            wrap(<ProfileSandboxSettings />)
            fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))
            running = running.filter((item) => item.sessionId !== 'session-1')

            await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())
            expect(screen.queryByRole('alert')).toBeNull()
            expect(screen.getByText('1 running')).toBeDefined()
        })
    })

    describe('limits', () => {
        test('shows the saved idle time and archive time, and a change saves only that field', async () => {
            settings = { idleStopMinutes: 30, archiveAfterDays: 7 }
            wrap(<ProfileSandboxSettings />)

            await waitFor(() =>
                expect(
                    screen.getByRole('radio', { name: '30 min' }).getAttribute('aria-checked')
                ).toBe('true')
            )
            expect(screen.getByRole('radio', { name: '7 days' }).getAttribute('aria-checked')).toBe(
                'true'
            )

            fireEvent.click(screen.getByRole('radio', { name: '1 hour' }))
            await waitFor(() => expect(patches).toEqual([{ idleStopMinutes: 60 }]))
            expect(screen.getByRole('radio', { name: '1 hour' }).getAttribute('aria-checked')).toBe(
                'true'
            )

            fireEvent.click(screen.getByRole('radio', { name: 'Never' }))
            await waitFor(() => expect(patches[1]).toEqual({ archiveAfterDays: null }))

            fireEvent.click(screen.getByRole('radio', { name: '30 days' }))
            await waitFor(() => expect(patches[2]).toEqual({ archiveAfterDays: 30 }))
            expect(
                screen.getByRole('radio', { name: '30 days' }).getAttribute('aria-checked')
            ).toBe('true')
        })

        test('picking the value that is already saved sends nothing', async () => {
            wrap(<ProfileSandboxSettings />)

            fireEvent.click(await screen.findByRole('radio', { name: '10 min' }))
            fireEvent.click(screen.getByRole('radio', { name: 'Never' }))

            await new Promise((resolve) => setTimeout(resolve, 20))
            expect(patches).toEqual([])
        })

        test('a failed save goes back to the saved value and says why under the row', async () => {
            ;(sandboxAPI.updateSettings as any).mockImplementation(async () => {
                throw new ApiError('idleStopMinutes must be 10, 30 or 60', 400)
            })
            wrap(<ProfileSandboxSettings />)

            fireEvent.click(await screen.findByRole('radio', { name: '30 min' }))

            expect(await screen.findByText('idleStopMinutes must be 10, 30 or 60')).toBeDefined()
            await waitFor(() =>
                expect(
                    screen.getByRole('radio', { name: '10 min' }).getAttribute('aria-checked')
                ).toBe('true')
            )
            // the saved values are read again
            await waitFor(() => expect(sandboxAPI.getSettings).toHaveBeenCalledTimes(2))
            // the other row has no error
            const archiveRow = screen.getByText('Archive sessions after').parentElement!
            expect(within(archiveRow).queryByText(/must be/)).toBeNull()
        })

        test('shows a skeleton while the settings load', async () => {
            const pending = deferred<SandboxSettings>()
            ;(sandboxAPI.getSettings as any).mockImplementation(() => pending.promise)
            wrap(<ProfileSandboxSettings />)

            expect(screen.getByTestId('limits-skeleton')).toBeDefined()
            expect(screen.queryByRole('radio', { name: '10 min' })).toBeNull()
            // the page heading and the running list do not wait for the settings
            expect(screen.getByText('Sandbox')).toBeDefined()
            expect(await screen.findByText('fix-login-redirect')).toBeDefined()

            await act(async () => pending.resolve({ idleStopMinutes: 60, archiveAfterDays: 30 }))
            await waitFor(() =>
                expect(
                    screen.getByRole('radio', { name: '1 hour' }).getAttribute('aria-checked')
                ).toBe('true')
            )
        })

        test('settings that did not load say so, and Try again reads them again', async () => {
            let fail = true
            ;(sandboxAPI.getSettings as any).mockImplementation(async () => {
                if (fail) throw new Error('boom')
                return { ...settings }
            })
            wrap(<ProfileSandboxSettings />)

            expect(await screen.findByText('Could not load the settings.')).toBeDefined()
            expect(screen.queryByRole('radio', { name: '10 min' })).toBeNull()
            // the running list still shows
            expect(screen.getByText('fix-login-redirect')).toBeDefined()

            fail = false
            fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            expect(await screen.findByRole('radio', { name: '10 min' })).toBeDefined()
            expect(screen.queryByText('Could not load the settings.')).toBeNull()
        })

        test('the skeleton preview flag shows both skeletons', async () => {
            setSkeletonPreview(true)
            wrap(<ProfileSandboxSettings />)

            await waitFor(() => expect(sandboxAPI.getRunning).toHaveBeenCalled())
            expect(screen.getByTestId('running-skeleton')).toBeDefined()
            expect(screen.getByTestId('limits-skeleton')).toBeDefined()
        })
    })

    describe('machine size and removed parts', () => {
        test('the machine size section is hidden without the preview', async () => {
            wrap(<ProfileSandboxSettings />)

            await screen.findByRole('radio', { name: '10 min' })
            expect(screen.queryByText('Machine size')).toBeNull()
            expect(screen.queryByRole('radio', { name: 'Large' })).toBeNull()
            expect(screen.queryByText('Demo')).toBeNull()
        })

        test('with the preview the machine size section shows with a Demo pill and saves nothing', async () => {
            setConnectionsDemo(true)
            wrap(<ProfileSandboxSettings />)

            expect(await screen.findByRole('radio', { name: 'Large' })).toBeDefined()
            expect(screen.getByRole('heading', { name: 'Machine size' })).toBeDefined()
            expect(screen.getAllByText('Demo').length).toBe(1)

            fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
            expect(screen.getByRole('radio', { name: 'Large' }).getAttribute('aria-checked')).toBe(
                'true'
            )
            expect(patches).toEqual([])
        })

        test('has no setup commands any more', async () => {
            wrap(<ProfileSandboxSettings />)

            await screen.findByRole('radio', { name: '10 min' })
            expect(screen.queryByText(/setup commands/i)).toBeNull()
            expect(screen.queryByRole('button', { name: 'Add repository' })).toBeNull()
            expect('setSetupCommands' in sandboxAPI).toBe(false)
        })
    })

    describe('phone layout', () => {
        test('long names truncate and the Stop button keeps its width', async () => {
            running = [
                {
                    ...sampleRunning()[0],
                    title: 'a very long session title that does not fit on a phone screen at all',
                    repoFullName: 'a-long-organisation-name/a-long-repository-name',
                },
            ]
            wrap(<ProfileSandboxSettings />)

            const title = await screen.findByText(/a very long session title/)
            expect(title.className).toContain('truncate')
            const note = screen.getByText(/a-long-organisation-name/)
            expect(note.className).toContain('truncate')
            // the text column can shrink, so the row never scrolls sideways
            expect(title.parentElement?.className).toContain('min-w-0')
            const button = screen.getByRole('button', { name: /^Stop a very long/ })
            expect(button.className).toContain('shrink-0')
        })

        test('the limit rows can put the choices under the label', async () => {
            wrap(<ProfileSandboxSettings />)

            const group = await screen.findByRole('radiogroup', { name: 'Archive sessions after' })
            // SettingsRow wraps, and the choice group scrolls inside itself when it must
            const row = group.parentElement?.parentElement as HTMLElement
            expect(row.className).toContain('flex-wrap')
            expect(group.className).toContain('max-w-full')
        })
    })
})

describe('formatRunTime', () => {
    const start = '2026-11-28T10:00:00.000Z'
    const at = (minutes: number) => new Date(start).getTime() + minutes * MINUTE

    test('minutes under an hour, then hours and minutes', () => {
        expect(formatRunTime(start, at(0))).toBe('0 min')
        expect(formatRunTime(start, at(59))).toBe('59 min')
        expect(formatRunTime(start, at(60))).toBe('1 h 0 min')
        expect(formatRunTime(start, at(26 * 60 + 5))).toBe('26 h 5 min')
    })

    test('a start in the future (a clock that is off) reads 0 min', () => {
        expect(formatRunTime(start, at(-5))).toBe('0 min')
    })
})

describe('sandbox api', () => {
    const originalFetch = globalThis.fetch
    let calls: Array<{ path: string; method: string; body: unknown }>

    beforeEach(() => {
        calls = []
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = new URL(
                String(input instanceof Request ? input.url : input),
                'http://localhost'
            )
            calls.push({
                path: url.pathname.replace(/^.*\/api\/v1/, ''),
                method: init?.method ?? 'GET',
                body: init?.body ? JSON.parse(String(init.body)) : undefined,
            })
            return new Response(JSON.stringify({ success: true, message: 'ok', data: {} }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        }) as typeof fetch
    })

    afterEach(() => {
        globalThis.fetch = originalFetch
    })

    test('reads and saves the settings on /setting/sandbox', async () => {
        await sandboxAPI.getSettings()
        await sandboxAPI.updateSettings({ archiveAfterDays: null })

        expect(calls).toEqual([
            { path: '/setting/sandbox', method: 'GET', body: undefined },
            { path: '/setting/sandbox', method: 'PATCH', body: { archiveAfterDays: null } },
        ])
    })

    test('lists on /session/sandboxes and stops with a POST to the session', async () => {
        await sandboxAPI.getRunning()
        await sandboxAPI.stop('../setting/sandbox')

        expect(calls[0]).toEqual({ path: '/session/sandboxes', method: 'GET', body: undefined })
        // the id is encoded, so it cannot reach another route
        expect(calls[1].method).toBe('POST')
        expect(calls[1].path).toBe('/session/..%2Fsetting%2Fsandbox/stop')
    })
})
