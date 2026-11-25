import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { renderHook, act, waitFor } = await import('@testing-library/react')
const { usePromptInputController } =
    await import('../src/features/home/hooks/usePromptInputController')
const { useModelSelection } = await import('../src/features/home/model-selection')
const { BASE_PROMPT_CONFIG, usePromptConfig } = await import('../src/features/home/promptConfig')
const { byokAPI } = await import('../src/features/profile/api/byok')
const { profileAPI } = await import('../src/features/profile/api/profile')

import type { Profile } from '../src/features/profile/api/profile'

const repo = (name: string, defaultBranch = 'main') => ({
    id: name.length,
    name,
    fullName: `acme/${name}`,
    private: true,
    defaultBranch,
    updatedAt: '2026-11-25T00:00:00.000Z',
    htmlUrl: `https://github.com/acme/${name}`,
    cloneUrl: `https://github.com/acme/${name}.git`,
    language: null,
    description: null,
    owner: { login: 'acme', avatarUrl: '' },
    provider: 'GITHUB' as const,
})

// issue 637: a new prompt box starts from the defaults saved on the account
describe('the prompt box starts from the account defaults (#637)', () => {
    let queryClient: QueryClient
    let account: Partial<Profile>
    let branchChecks: { repository: string; branch: string }[]
    let branchesOnHost: string[]

    beforeEach(() => {
        // the stores are shared across tests in one bun process
        useModelSelection.getState().reset()
        usePromptConfig.setState({ values: BASE_PROMPT_CONFIG, defaults: BASE_PROMPT_CONFIG })
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        account = { id: 'user-1', githubConnected: true }
        branchChecks = []
        branchesOnHost = []

        spyOn(profileAPI, 'getProfile').mockImplementation(async () => account as Profile)
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => [
            repo('web'),
            repo('api', 'trunk'),
        ])
        spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
            available: false,
            connected: false,
            username: null,
        }))
        spyOn(profileAPI, 'checkRepoBranch').mockImplementation(async (data) => {
            branchChecks.push({ repository: data.repository, branch: data.branch })
            return { exists: branchesOnHost.includes(data.branch) }
        })
        spyOn(byokAPI, 'list').mockImplementation(async () => ({
            providers: [
                { id: 'openai', name: 'OpenAI', keyUrl: '' },
                { id: 'groq', name: 'Groq', keyUrl: '' },
            ],
            credentials: [
                {
                    provider: 'openai',
                    keyHint: '1111',
                    models: ['gpt-5', 'gpt-5-mini'],
                    defaultModel: 'gpt-5',
                    verifiedAt: '2026-11-25T00:00:00.000Z',
                    lastUsedAt: null,
                },
                {
                    provider: 'groq',
                    keyHint: '2222',
                    models: ['llama-3.3-70b-versatile', 'qwen-qwq-32b'],
                    defaultModel: 'llama-3.3-70b-versatile',
                    verifiedAt: '2026-11-25T00:00:00.000Z',
                    lastUsedAt: null,
                },
            ],
        }))
    })

    afterEach(() => {
        mock.restore()
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const openBox = (onSubmit = mock((_prompt: string, _options?: any) => {})) =>
        renderHook(
            () => usePromptInputController({ onSubmit, isAuthenticated: true, mode: 'agent' }),
            { wrapper }
        )

    it('starts on Fast when the account default is fast', async () => {
        account = { ...account, defaultEffort: 'fast' }
        const onSubmit = mock((_prompt: string, _options?: any) => {})
        const { result } = openBox(onSubmit)

        await waitFor(() => expect(result.current.selectedSpeed).toBe('fast'))

        act(() => result.current.handleInputChange('add a login page'))
        act(() => result.current.handleSubmit())
        expect(onSubmit.mock.calls[0][1].runConfig.effort).toBe('fast')
    })

    it('stays on Deep when the account default is deep', async () => {
        account = { ...account, defaultEffort: 'deep', defaultPlanFirst: true }
        const { result } = openBox()

        // plan first comes from the same profile answer, so the defaults are applied by now
        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))
        expect(result.current.selectedSpeed).toBe('deep')
    })

    it('keeps the speed the user picked in the box', async () => {
        account = { ...account, defaultEffort: 'fast', defaultPlanFirst: true }
        const { result } = openBox()
        act(() => result.current.handleSelectSpeed('deep'))

        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))
        expect(result.current.selectedSpeed).toBe('deep')
    })

    it('starts on plan first and no pull request from the account', async () => {
        account = { ...account, defaultPlanFirst: true, defaultOpenPullRequest: false }
        const onSubmit = mock((_prompt: string, _options?: any) => {})
        const { result } = openBox(onSubmit)

        await waitFor(() =>
            expect(usePromptConfig.getState().values).toEqual({
                planFirst: true,
                openPullRequest: false,
            })
        )
        act(() => result.current.handleInputChange('add a login page'))
        act(() => result.current.handleSubmit())
        expect(onSubmit.mock.calls[0][1].runConfig).toEqual({
            planFirst: true,
            effort: 'deep',
            openPullRequest: false,
        })
    })

    it('starts on the default model of your keys when the source is your keys', async () => {
        account = {
            ...account,
            defaultModelSource: 'OWN_KEY',
            defaultOwnKeyProvider: 'groq',
            defaultOwnKeyModel: 'qwen-qwq-32b',
        }
        const { result } = openBox()

        await waitFor(() => expect(result.current.selectedSource).toBe('OWN_KEY'))
        expect(result.current.selectedProvider).toBe('groq')
        expect(result.current.selectedModel).toBe('qwen-qwq-32b')
    })

    it('starts on the first key when the key of the default model is gone', async () => {
        account = {
            ...account,
            defaultModelSource: 'OWN_KEY',
            defaultOwnKeyProvider: 'anthropic',
            defaultOwnKeyModel: 'claude-sonnet-4-5',
        }
        const { result } = openBox()

        await waitFor(() => expect(result.current.selectedSource).toBe('OWN_KEY'))
        expect(result.current.selectedProvider).toBe('openai')
        expect(result.current.selectedModel).toBe('gpt-5')
    })

    it('on credits, a switch to your keys picks the default model', async () => {
        account = {
            ...account,
            defaultModelSource: 'CREDITS',
            defaultOwnKeyProvider: 'groq',
            defaultOwnKeyModel: 'qwen-qwq-32b',
        }
        const { result } = openBox()

        await waitFor(() =>
            expect(useModelSelection.getState().lastOwnKey).toEqual({
                provider: 'groq',
                model: 'qwen-qwq-32b',
            })
        )
        expect(result.current.selectedSource).toBe('CREDITS')
    })

    it('starts with no repository on "last used"', async () => {
        account = { ...account, defaultRepository: 'last-used', defaultPlanFirst: true }
        const { result } = openBox()

        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))
        expect(result.current.selectedRepos).toEqual([])
        expect(result.current.selectedBranch).toBe('')
        expect(profileAPI.getGithubRepos).not.toHaveBeenCalled()
    })

    it('starts on the default repository and its default branch', async () => {
        account = { ...account, defaultRepository: 'acme/api', defaultBaseBranch: 'default' }
        const onSubmit = mock((_prompt: string, _options?: any) => {})
        const { result } = openBox(onSubmit)

        await waitFor(() => expect(result.current.selectedRepos.length).toBe(1))
        expect(result.current.selectedRepos[0].fullName).toBe('acme/api')
        expect(result.current.selectedBranch).toBe('trunk')
        expect(branchChecks).toEqual([])

        act(() => result.current.handleInputChange('fix the tests'))
        act(() => result.current.handleSubmit())
        expect(onSubmit.mock.calls[0][1]).toMatchObject({
            repoUrl: 'https://github.com/acme/api',
            branch: 'trunk',
        })
    })

    it('starts on the default base branch when the repository has it', async () => {
        account = { ...account, defaultRepository: 'acme/web', defaultBaseBranch: 'develop' }
        branchesOnHost = ['develop']
        const { result } = openBox()

        await waitFor(() => expect(result.current.selectedBranch).toBe('develop'))
        expect(result.current.selectedRepos[0].fullName).toBe('acme/web')
        expect(branchChecks).toEqual([{ repository: 'acme/web', branch: 'develop' }])
    })

    it('uses the default branch of the repository when it has no such branch', async () => {
        account = { ...account, defaultRepository: 'acme/web', defaultBaseBranch: 'develop' }
        const { result } = openBox()

        await waitFor(() =>
            expect(branchChecks).toEqual([{ repository: 'acme/web', branch: 'develop' }])
        )
        // the answer of the check is in by the next tick
        await act(async () => {
            await Promise.resolve()
        })
        expect(result.current.selectedBranch).toBe('main')
    })

    it('a repository picked by hand also starts on the default base branch', async () => {
        account = { ...account, defaultBaseBranch: 'develop', defaultPlanFirst: true }
        branchesOnHost = ['develop']
        const { result } = openBox()
        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))

        act(() => result.current.handleSelectRepo(repo('api', 'trunk')))
        expect(result.current.selectedBranch).toBe('trunk')
        await waitFor(() => expect(result.current.selectedBranch).toBe('develop'))
        expect(branchChecks).toEqual([{ repository: 'acme/api', branch: 'develop' }])
    })

    it('does not put the default repository back after the user removes it', async () => {
        account = { ...account, defaultRepository: 'acme/web' }
        const { result } = openBox()

        await waitFor(() => expect(result.current.selectedRepos.length).toBe(1))
        act(() => result.current.handleRemoveRepo(0))
        expect(result.current.selectedRepos).toEqual([])
        act(() => result.current.handleInputChange('no repository this time'))
        expect(result.current.selectedRepos).toEqual([])
    })
})
