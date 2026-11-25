import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, cleanup, fireEvent, waitFor } = await import('@testing-library/react')

const { setConnectionsDemo } = await import('../src/features/connections/lib/connectionsDemo')
const { byokAPI } = await import('../src/features/profile/api/byok')
const { profileAPI } = await import('../src/features/profile/api/profile')
const { ProfileDefaultsSettings } =
    await import('../src/features/profile/components/ProfileDefaultsSettings')
const { resetPreviewValues } = await import('../src/features/profile/components/SettingsUi')

import type { Profile, SessionDefaults } from '../src/features/profile/api/profile'

const account = {
    id: 'user-1',
    name: 'Ada',
    email: 'ada@example.com',
    githubConnected: true,
    defaultModelSource: 'OWN_KEY',
    defaultPlanFirst: true,
    defaultEffort: 'fast',
    defaultOpenPullRequest: false,
    defaultOwnKeyProvider: 'groq',
    defaultOwnKeyModel: 'qwen-qwq-32b',
    defaultRepository: 'acme/api',
    defaultBaseBranch: 'develop',
} as Profile

const wrap = (ui: React.ReactNode) =>
    render(
        <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
            {ui}
        </QueryClientProvider>
    )

const select = (name: string) => screen.getByRole('combobox', { name }) as HTMLSelectElement

describe('defaults settings page (#637)', () => {
    let profile: Profile
    let saved: Partial<SessionDefaults>[]

    beforeEach(() => {
        cleanup()
        resetPreviewValues()
        setConnectionsDemo(false)
        profile = { ...account }
        saved = []
        spyOn(profileAPI, 'getProfile').mockImplementation(async () => ({ ...profile }))
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => [
            { id: 1, fullName: 'acme/web', defaultBranch: 'main' } as any,
            { id: 2, fullName: 'acme/api', defaultBranch: 'main' } as any,
        ])
        spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
            available: false,
            connected: false,
            username: null,
        }))
        spyOn(byokAPI, 'list').mockImplementation(async () => ({
            providers: [{ id: 'groq', name: 'Groq', keyUrl: '' }],
            credentials: [
                {
                    provider: 'groq',
                    keyHint: '1234',
                    models: ['llama-3.3-70b-versatile', 'qwen-qwq-32b'],
                    defaultModel: 'llama-3.3-70b-versatile',
                    verifiedAt: '2026-11-25T00:00:00.000Z',
                    lastUsedAt: null,
                },
            ],
        }))
        spyOn(profileAPI, 'updateSessionDefaults').mockImplementation(async (patch) => {
            saved.push(patch)
            profile = { ...profile, ...patch }
            return profile as unknown as SessionDefaults
        })
    })

    afterEach(() => {
        cleanup()
        setConnectionsDemo(null)
        mock.restore()
    })

    test('shows the values of the account to every user', async () => {
        wrap(<ProfileDefaultsSettings />)

        expect(await screen.findByRole('switch', { name: 'Plan first' })).toBeDefined()
        expect(screen.queryByText('Defaults for new sessions are coming soon')).toBeNull()

        expect(screen.getByRole('radio', { name: 'Your keys' }).getAttribute('aria-checked')).toBe(
            'true'
        )
        expect(screen.getByRole('radio', { name: 'Fast' }).getAttribute('aria-checked')).toBe(
            'true'
        )
        expect(screen.getByRole('radio', { name: 'Deep' }).getAttribute('aria-checked')).toBe(
            'false'
        )
        expect(
            screen.getByRole('switch', { name: 'Plan first' }).getAttribute('aria-checked')
        ).toBe('true')
        expect(
            screen.getByRole('switch', { name: 'Open a pull request' }).getAttribute('aria-checked')
        ).toBe('false')
        expect(
            (screen.getByRole('textbox', { name: 'Base branch' }) as HTMLInputElement).value
        ).toBe('develop')

        await waitFor(() => {
            const model = select('Model for your keys')
            expect(model.selectedOptions[0]?.textContent).toBe('qwen-qwq-32b')
        })
        await waitFor(() => {
            const repository = select('Repository')
            expect(repository.selectedOptions[0]?.textContent).toBe('acme/api')
            expect(Array.from(repository.options).map((o) => o.textContent)).toEqual([
                'Last used',
                'acme/web',
                'acme/api',
            ])
        })
    })

    test('a change saves only that field', async () => {
        wrap(<ProfileDefaultsSettings />)

        fireEvent.click(await screen.findByRole('radio', { name: 'Deep' }))
        await waitFor(() => expect(saved).toEqual([{ defaultEffort: 'deep' }]))

        fireEvent.click(screen.getByRole('switch', { name: 'Plan first' }))
        await waitFor(() => expect(saved[1]).toEqual({ defaultPlanFirst: false }))

        fireEvent.click(screen.getByRole('switch', { name: 'Open a pull request' }))
        await waitFor(() => expect(saved[2]).toEqual({ defaultOpenPullRequest: true }))

        await waitFor(() => expect(select('Repository').options.length).toBe(3))
        fireEvent.change(select('Repository'), { target: { value: 'acme/web' } })
        await waitFor(() => expect(saved[3]).toEqual({ defaultRepository: 'acme/web' }))

        fireEvent.change(select('Repository'), { target: { value: 'last-used' } })
        await waitFor(() => expect(saved[4]).toEqual({ defaultRepository: 'last-used' }))
    })

    test('the model for your keys saves the provider and the model', async () => {
        wrap(<ProfileDefaultsSettings />)

        await waitFor(() => expect(select('Model for your keys').options.length).toBe(3))
        const options = Array.from(select('Model for your keys').options)
        expect(options.map((o) => o.textContent)).toEqual([
            'Default of the key',
            'llama-3.3-70b-versatile',
            'qwen-qwq-32b',
        ])

        fireEvent.change(select('Model for your keys'), { target: { value: options[1].value } })
        await waitFor(() =>
            expect(saved).toEqual([
                { defaultOwnKeyProvider: 'groq', defaultOwnKeyModel: 'llama-3.3-70b-versatile' },
            ])
        )

        fireEvent.change(select('Model for your keys'), { target: { value: options[0].value } })
        await waitFor(() =>
            expect(saved[1]).toEqual({ defaultOwnKeyProvider: null, defaultOwnKeyModel: null })
        )
    })

    test('the base branch saves when the field loses focus, and empty means the default branch', async () => {
        wrap(<ProfileDefaultsSettings />)

        const branch = (await screen.findByRole('textbox', {
            name: 'Base branch',
        })) as HTMLInputElement
        fireEvent.change(branch, { target: { value: 'release/2.0' } })
        expect(saved).toEqual([])
        fireEvent.blur(branch)
        await waitFor(() => expect(saved).toEqual([{ defaultBaseBranch: 'release/2.0' }]))

        fireEvent.change(branch, { target: { value: '  ' } })
        fireEvent.blur(branch)
        await waitFor(() => expect(saved[1]).toEqual({ defaultBaseBranch: 'default' }))
        await waitFor(() => expect(branch.value).toBe(''))
        expect(branch.getAttribute('placeholder')).toBe('Default branch')
    })

    test('the model for each step is hidden without the preview', async () => {
        wrap(<ProfileDefaultsSettings />)
        await screen.findByRole('switch', { name: 'Plan first' })

        expect(screen.queryByText('Model for each step')).toBeNull()
        expect(screen.queryByRole('combobox', { name: 'Model for the plan step' })).toBeNull()
        expect(screen.queryByRole('combobox', { name: 'Model for the build step' })).toBeNull()
        expect(screen.queryByRole('combobox', { name: 'Model for the review step' })).toBeNull()
        expect(screen.queryByText('Demo')).toBeNull()
    })

    test('with the preview on the model for each step shows with a Demo pill', async () => {
        setConnectionsDemo(true)
        wrap(<ProfileDefaultsSettings />)
        await screen.findByRole('switch', { name: 'Plan first' })

        expect(screen.getByText('Model for each step')).toBeDefined()
        expect(screen.getByText('Demo')).toBeDefined()
        expect(screen.getByRole('combobox', { name: 'Model for the plan step' })).toBeDefined()
        // sample values: a change sends nothing to the server
        fireEvent.change(select('Model for the review step'), {
            target: { value: 'Same as Model' },
        })
        expect(saved).toEqual([])
    })
})
