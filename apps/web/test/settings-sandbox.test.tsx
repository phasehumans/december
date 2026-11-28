import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { sandboxAPI } = await import('../src/features/profile/api/sandbox')
const { ProfileSandboxSettings } =
    await import('../src/features/profile/components/ProfileSandboxSettings')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')

import type {
    RunningSandbox,
    SandboxSettings,
    SetupCommands,
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

const running: RunningSandbox[] = [
    {
        sessionId: 'session-1',
        title: 'fix-login-redirect',
        repoFullName: 'acme/web',
        startedAt: '2026-11-25T10:00:00.000Z',
        costInCents: 21,
        sandboxStatus: 'RUNNING',
    },
    {
        sessionId: 'session-2',
        title: 'add-csv-export',
        repoFullName: 'acme/api',
        startedAt: '2026-11-25T10:30:00.000Z',
        costInCents: 3,
        sandboxStatus: 'STARTING',
    },
]

describe('sandbox settings page (#637)', () => {
    let settings: SandboxSettings
    let patches: unknown[]
    let setupSaves: SetupCommands[]
    let stops: string[]
    let stopAnswer: (sessionId: string) => StoppedSession

    beforeEach(() => {
        cleanup()
        resetPreviewValues()
        setConnectionsDemo(false)
        settings = {
            idleStopMinutes: 10,
            archiveAfterDays: null,
            setupCommands: [
                { repoFullName: 'acme/api', commands: 'pip install -r requirements.txt' },
            ],
        }
        patches = []
        setupSaves = []
        stops = []
        stopAnswer = (sessionId) => ({ sessionId, vmStatus: 'STOPPED', sandboxStatus: 'PAUSED' })

        spyOn(sandboxAPI, 'getSettings').mockImplementation(async () => ({ ...settings }))
        spyOn(sandboxAPI, 'getRunning').mockImplementation(async () => ({ items: running }))
        spyOn(sandboxAPI, 'updateSettings').mockImplementation(async (patch) => {
            patches.push(patch)
            settings = { ...settings, ...patch }
            return { ...settings }
        })
        spyOn(sandboxAPI, 'setSetupCommands').mockImplementation(async (data) => {
            setupSaves.push(data)
            const others = settings.setupCommands.filter(
                (row) => row.repoFullName !== data.repoFullName.toLowerCase()
            )
            settings = {
                ...settings,
                setupCommands: data.commands
                    ? [...others, { ...data, repoFullName: data.repoFullName.toLowerCase() }]
                    : others,
            }
            return { ...settings }
        })
        spyOn(sandboxAPI, 'stop').mockImplementation(async (sessionId) => {
            stops.push(sessionId)
            return stopAnswer(sessionId)
        })
        spyOn(profileAPI, 'getProfile').mockImplementation(
            async () => ({ id: 'user-1', githubConnected: true }) as any
        )
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => ({
            repos: [
                { id: 1, fullName: 'Acme/Web', defaultBranch: 'main' } as any,
                { id: 2, fullName: 'acme/api', defaultBranch: 'main' } as any,
            ],
            unavailable: [],
            truncated: false,
        }))
        spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
            available: false,
            connected: false,
            username: null,
        }))
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
        mock.restore()
    })

    test('lists the running sandboxes from the api, for every user', async () => {
        wrap(<ProfileSandboxSettings />)

        expect(await screen.findByText('fix-login-redirect')).toBeDefined()
        expect(screen.queryByText('Sandbox settings are coming soon')).toBeNull()
        expect(screen.getByText('add-csv-export')).toBeDefined()
        expect(screen.getByText('2 running')).toBeDefined()
        expect(screen.getByText(/acme\/web · .* · \$0\.21/)).toBeDefined()
        expect(screen.getByText(/acme\/api · Starting · \$0\.03/)).toBeDefined()
    })

    test('Stop sends the stop, and the row leaves the list when the answer says paused', async () => {
        wrap(<ProfileSandboxSettings />)

        fireEvent.click(await screen.findByRole('button', { name: 'Stop fix-login-redirect' }))

        await waitFor(() => expect(stops).toEqual(['session-1']))
        await waitFor(() => expect(screen.queryByText('fix-login-redirect')).toBeNull())
        expect(screen.getByText('add-csv-export')).toBeDefined()
        expect(screen.getByText('1 running')).toBeDefined()
        // the answer is the new state: the list is not read again at once
        expect(sandboxAPI.getRunning).toHaveBeenCalledTimes(1)
    })

    test('a sandbox that still starts stays in the list after Stop', async () => {
        stopAnswer = (sessionId) => ({ sessionId, vmStatus: 'STOPPED', sandboxStatus: 'STARTING' })
        wrap(<ProfileSandboxSettings />)

        fireEvent.click(await screen.findByRole('button', { name: 'Stop add-csv-export' }))

        await waitFor(() => expect(stops).toEqual(['session-2']))
        expect(screen.getByText('add-csv-export')).toBeDefined()
        expect(screen.getByText('2 running')).toBeDefined()
    })

    test('shows the saved idle time and archive time, and a change saves only that field', async () => {
        settings = { ...settings, idleStopMinutes: 30, archiveAfterDays: 7 }
        wrap(<ProfileSandboxSettings />)

        await waitFor(() =>
            expect(screen.getByRole('radio', { name: '30 min' }).getAttribute('aria-checked')).toBe(
                'true'
            )
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
    })

    test('the machine size row is hidden without the preview', async () => {
        wrap(<ProfileSandboxSettings />)

        await screen.findByRole('radio', { name: '10 min' })
        expect(screen.queryByText('Machine size')).toBeNull()
        expect(screen.queryByRole('radio', { name: 'Large' })).toBeNull()
        expect(screen.queryByText('Demo')).toBeNull()
    })

    test('with the preview the machine size row shows with a Demo pill', async () => {
        setConnectionsDemo(true)
        wrap(<ProfileSandboxSettings />)

        expect(await screen.findByRole('radio', { name: 'Large' })).toBeDefined()
        expect(screen.getByText('Machine size')).toBeDefined()
        expect(screen.getAllByText('Demo').length).toBe(1)
    })

    test('lists the setup commands, and saves the commands of a picked repository', async () => {
        wrap(<ProfileSandboxSettings />)

        expect(await screen.findByText('pip install -r requirements.txt')).toBeDefined()

        fireEvent.click(screen.getByRole('button', { name: 'Add repository' }))
        const repository = (await screen.findByRole('combobox', {
            name: 'Repository',
        })) as HTMLSelectElement
        await waitFor(() =>
            expect(Array.from(repository.options).map((o) => o.textContent)).toEqual([
                'Pick a repository',
                'Acme/Web',
            ])
        )
        fireEvent.change(repository, { target: { value: 'Acme/Web' } })
        fireEvent.change(screen.getByRole('textbox', { name: 'Commands' }), {
            target: { value: 'bun install' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() =>
            expect(setupSaves).toEqual([{ repoFullName: 'Acme/Web', commands: 'bun install' }])
        )
        expect(await screen.findByText('bun install')).toBeDefined()
    })

    test('Remove in the dialog of a repository deletes its setup commands', async () => {
        wrap(<ProfileSandboxSettings />)

        fireEvent.click(
            await screen.findByRole('button', { name: 'Edit setup commands of acme/api' })
        )
        fireEvent.click(await screen.findByRole('button', { name: 'Remove' }))

        await waitFor(() =>
            expect(setupSaves).toEqual([{ repoFullName: 'acme/api', commands: '' }])
        )
        await waitFor(() =>
            expect(screen.queryByText('pip install -r requirements.txt')).toBeNull()
        )
        expect(screen.getByText('No setup commands yet')).toBeDefined()
    })
})
