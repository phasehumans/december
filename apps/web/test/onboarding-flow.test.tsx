import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, test, describe, afterEach } from 'bun:test'
import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { OnboardingPage } from '../src/features/onboarding/components/OnboardingPage'
import { getOnboardingRedirect } from '../src/features/onboarding/gate'
import { profileAPI } from '../src/features/profile/api/profile'

import type { OnboardingState } from '../src/features/onboarding/api/onboarding'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, cleanup, fireEvent, waitFor } = await import('@testing-library/react')

afterEach(() => {
    cleanup()
})

const newUserState = (overrides: Partial<OnboardingState> = {}): OnboardingState => ({
    completedAt: null,
    step: null,
    steps: { models: false, github: false },
    github: null,
    wallet: { balanceInCents: 0 },
    ownKey: null,
    ...overrides,
})

const renderOnboarding = (
    state: OnboardingState,
    entry = '/onboarding',
    gitlab = { available: false, connected: false, username: null as string | null }
) => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: Infinity },
            mutations: { retry: false },
        },
    })
    queryClient.setQueryData(['onboarding'], state)
    queryClient.setQueryData(['billing-overview'], { creditBalance: 0, usdToInrRate: 90 })
    queryClient.setQueryData(['byok'], {
        providers: [
            { id: 'openai', name: 'OpenAI', keyUrl: '' },
            {
                id: 'anthropic',
                name: 'Anthropic',
                keyUrl: 'https://platform.claude.com/settings/keys',
            },
            { id: 'groq', name: 'Groq', keyUrl: '' },
        ],
        credentials: [
            {
                provider: 'anthropic',
                keyHint: 'a9F2',
                models: ['claude-sonnet', 'claude-haiku'],
                defaultModel: 'claude-sonnet',
                verifiedAt: '2026-11-22T10:00:00.000Z',
                lastUsedAt: null,
            },
        ],
    })
    queryClient.setQueryData(['profile'], { id: 'u1', name: 'Test', email: 't@example.com' })
    queryClient.setQueryData(['integrations', 'gitlab'], gitlab)

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[entry]}>
                <Routes>
                    <Route path="/onboarding" element={<OnboardingPage />} />
                    <Route path="/" element={<div>HOME</div>} />
                    <Route path="/sessions/:id" element={<div>SESSION</div>} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )
}

describe('onboarding gate', () => {
    const base = { isAuthenticated: true, pathname: '/', search: '' }

    test('sends a signed-in user who has not finished to /onboarding, keeping the target', () => {
        expect(
            getOnboardingRedirect({
                ...base,
                pathname: '/sessions/abc',
                search: '?tab=preview',
                profile: { onboardingCompletedAt: null },
            })
        ).toBe(`/onboarding?redirect=${encodeURIComponent('/sessions/abc?tab=preview')}`)
    })

    test('treats a profile without the field as not finished', () => {
        expect(getOnboardingRedirect({ ...base, profile: {} })).toBe(
            `/onboarding?redirect=${encodeURIComponent('/')}`
        )
    })

    test('does nothing for a finished user', () => {
        expect(
            getOnboardingRedirect({
                ...base,
                profile: { onboardingCompletedAt: '2026-11-22T10:00:00.000Z' },
            })
        ).toBeNull()
    })

    test('does nothing while signed out, while the profile loads, or on /onboarding', () => {
        expect(
            getOnboardingRedirect({
                ...base,
                isAuthenticated: false,
                profile: { onboardingCompletedAt: null },
            })
        ).toBeNull()
        expect(getOnboardingRedirect({ ...base, profile: undefined })).toBeNull()
        expect(
            getOnboardingRedirect({
                ...base,
                pathname: '/onboarding',
                profile: { onboardingCompletedAt: null },
            })
        ).toBeNull()
    })
})

describe('OnboardingPage', () => {
    test('a new user starts on step 1 with GitHub and a GitLab "coming soon" button', () => {
        const { getByText, getByRole } = renderOnboarding(newUserState())

        expect(getByText('Connect your Git provider')).not.toBeNull()
        expect(getByText('Continue with GitHub')).not.toBeNull()
        expect(getByText('Skip for now')).not.toBeNull()
        expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('1')

        fireEvent.click(getByText('Continue with GitLab'))
        expect(getByText('GitLab is coming soon')).not.toBeNull()
    })

    test('with the GitLab app on the server, GitLab opens the connect flow', async () => {
        const original = profileAPI.getGitlabConnectUrl
        const returnPaths: (string | undefined)[] = []
        profileAPI.getGitlabConnectUrl = (returnPath?: string) => {
            returnPaths.push(returnPath)
            return 'about:blank#gitlab'
        }

        try {
            const { getByText } = renderOnboarding(newUserState(), '/onboarding', {
                available: true,
                connected: false,
                username: null,
            })

            fireEvent.click(getByText('Continue with GitLab'))

            expect(getByText('Opening GitLab...')).not.toBeNull()
            await waitFor(() => expect(returnPaths).toEqual(['/onboarding']))
        } finally {
            profileAPI.getGitlabConnectUrl = original
        }
    })

    test('a GitLab account held by another user comes back with a short message', () => {
        const happyDOM = (window as unknown as { happyDOM: { setURL: (url: string) => void } })
            .happyDOM
        const originalUrl = window.location.href
        happyDOM.setURL('http://localhost/onboarding?gitlab=in_use')

        try {
            const { getByRole } = renderOnboarding(newUserState(), '/onboarding', {
                available: true,
                connected: false,
                username: null,
            })
            expect(getByRole('alert').textContent).toBe(
                'This GitLab account is connected to another December account.'
            )
        } finally {
            happyDOM.setURL(originalUrl)
        }
    })

    test('shows a connected GitLab account as done', () => {
        const { getByText } = renderOnboarding(
            newUserState({
                steps: { models: false, github: true },
                gitlab: { username: 'jo-gl' },
            })
        )

        expect(getByText('jo-gl')).not.toBeNull()
        expect(getByText('Continue')).not.toBeNull()
    })

    test('resumes at the saved step', () => {
        const { getByText, queryByText } = renderOnboarding(newUserState({ step: 'start' }))

        expect(getByText('Where do you want to start?')).not.toBeNull()
        expect(getByText('December CLI')).not.toBeNull()
        expect(getByText('npm install -g @trydecember/cli')).not.toBeNull()
        expect(getByText('Continue with web')).not.toBeNull()
        expect(queryByText('@trydecember')).toBeNull()
    })

    test('shows a connected GitHub account as done', () => {
        const { getByText } = renderOnboarding(
            newUserState({
                steps: { models: false, github: true },
                github: { accountLogin: 'octo-org' },
            })
        )

        expect(getByText('octo-org')).not.toBeNull()
        expect(getByText('Continue')).not.toBeNull()
    })

    test('step 3 offers only credits and an own key, and no skip warning', () => {
        const { getByText, queryByText } = renderOnboarding(newUserState({ step: 'models' }))

        expect(getByText('Choose how to pay for models')).not.toBeNull()
        expect(getByText('Add credits to your wallet')).not.toBeNull()
        expect(getByText('Use your own API key')).not.toBeNull()
        expect(queryByText(/Request \$5/)).toBeNull()

        fireEvent.click(getByText('Add credits to your wallet'))
        expect(getByText('Add $10 (about ₹900)')).not.toBeNull()
        fireEvent.click(getByText('$1'))
        expect(getByText('Add $1 (about ₹90)')).not.toBeNull()
        expect(getByText('$5')).not.toBeNull()
        expect(queryByText('$25')).toBeNull()
        expect(queryByText('$50')).toBeNull()
    })

    test('Custom asks for a whole dollar amount from $1 to $50', () => {
        const { getByText, getByLabelText, queryByLabelText } = renderOnboarding(
            newUserState({ step: 'models' })
        )

        fireEvent.click(getByText('Add credits to your wallet'))
        expect(queryByLabelText('Custom amount in USD')).toBeNull()

        fireEvent.click(getByText('Custom'))
        expect(getByLabelText('Custom amount in USD')).not.toBeNull()

        // nothing typed yet: the button waits for an amount
        const payButton = getByText('Add credits').closest('button') as HTMLButtonElement
        expect(payButton.disabled).toBe(true)
    })

    test('the own key form picks Anthropic first and another provider can be chosen', () => {
        const { getByText, getByLabelText, getAllByRole, queryByText } = renderOnboarding(
            newUserState({ step: 'models' })
        )

        fireEvent.click(getByText('Use your own API key'))
        expect(getByText('Anthropic')).not.toBeNull()

        fireEvent.click(getByText('Anthropic'))
        expect(getAllByRole('option')).toHaveLength(3)

        // typing in the search box is checked in a real browser: happy-dom does not
        // deliver input events to this field
        expect(getByLabelText('Search providers')).not.toBeNull()

        fireEvent.click(getByText('Groq'))
        expect(queryByText('OpenAI')).toBeNull()
        expect(getByText('Groq')).not.toBeNull()
        expect(getByText('Save key')).not.toBeNull()
    })

    test('the provider list works with the keyboard and offers a key link', () => {
        const { getByText, getByLabelText, getAllByRole, queryAllByRole } = renderOnboarding(
            newUserState({ step: 'models' })
        )

        fireEvent.click(getByText('Use your own API key'))
        expect(getByText('Get key').closest('a')?.getAttribute('target')).toBe('_blank')

        fireEvent.click(getByText('Anthropic'))
        // popular providers first: Anthropic, OpenAI, then the rest
        expect(getAllByRole('option').map((option) => option.textContent)).toEqual([
            'Anthropic',
            'OpenAI',
            'Groq',
        ])

        const search = getByLabelText('Search providers')
        fireEvent.keyDown(search, { key: 'ArrowDown' })
        fireEvent.keyDown(search, { key: 'ArrowDown' })
        fireEvent.keyDown(search, { key: 'ArrowUp' })
        fireEvent.keyDown(search, { key: 'Enter' })

        expect(getByText('OpenAI')).not.toBeNull()
        expect(queryAllByRole('option')).toHaveLength(0)
    })

    test('a saved key shows its models and can be changed', () => {
        const { getByText } = renderOnboarding(
            newUserState({
                step: 'models',
                steps: { models: true, github: false },
                ownKey: { provider: 'anthropic', keyHint: 'a9F2' },
            })
        )

        expect(getByText(/····a9F2 · 2 models/)).not.toBeNull()
        fireEvent.click(getByText('Change'))
        expect(getByText('Save key')).not.toBeNull()

        fireEvent.click(getByText('Keep current key'))
        expect(getByText('Start building')).not.toBeNull()
    })

    test('a user who already pays sees the done state and Start building', () => {
        const { getByText } = renderOnboarding(
            newUserState({
                step: 'models',
                steps: { models: true, github: false },
                wallet: { balanceInCents: 1240 },
            })
        )

        expect(getByText('$12.40 in your wallet')).not.toBeNull()
        expect(getByText('Start building')).not.toBeNull()
    })

    test('a finished user is sent on to the page they came for', async () => {
        const { findByText } = renderOnboarding(
            newUserState({ completedAt: '2026-11-22T10:00:00.000Z' }),
            `/onboarding?redirect=${encodeURIComponent('/sessions/abc')}`
        )

        expect(await findByText('SESSION')).not.toBeNull()
    })

    test('an unsafe redirect falls back to home', async () => {
        const { findByText } = renderOnboarding(
            newUserState({ completedAt: '2026-11-22T10:00:00.000Z' }),
            `/onboarding?redirect=${encodeURIComponent('//evil.example.com')}`
        )

        await waitFor(async () => {
            expect(await findByText('HOME')).not.toBeNull()
        })
    })
})
