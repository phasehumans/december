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

// a new prompt box starts on fast and december credits; plan first and open pull request
// come from "save as default" in the box. the Defaults page and its other values are gone
describe('the prompt box start values', () => {
    let queryClient: QueryClient
    let account: Partial<Profile>

    beforeEach(() => {
        // the stores are shared across tests in one bun process
        useModelSelection.getState().reset()
        usePromptConfig.setState({ values: BASE_PROMPT_CONFIG, defaults: BASE_PROMPT_CONFIG })
        queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        account = { id: 'user-1', githubConnected: true }

        spyOn(profileAPI, 'getProfile').mockImplementation(async () => account as Profile)
        spyOn(profileAPI, 'getGithubRepos').mockImplementation(async () => ({
            repos: [repo('web'), repo('api', 'trunk')],
            unavailable: [],
            truncated: false,
        }))
        spyOn(profileAPI, 'getGitlabStatus').mockImplementation(async () => ({
            available: false,
            connected: false,
            username: null,
        }))
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

    it('starts on Fast and December credits, and sends fast', async () => {
        const onSubmit = mock((_prompt: string, _options?: any) => {})
        const { result } = openBox(onSubmit)

        await waitFor(() => expect(profileAPI.getProfile).toHaveBeenCalled())
        expect(result.current.selectedSpeed).toBe('fast')
        expect(result.current.selectedSource).toBe('CREDITS')

        act(() => result.current.handleInputChange('add a login page'))
        act(() => result.current.handleSubmit())
        expect(onSubmit.mock.calls[0][1].runConfig.effort).toBe('fast')
    })

    it('the user can switch to Deep in the box', async () => {
        const onSubmit = mock((_prompt: string, _options?: any) => {})
        const { result } = openBox(onSubmit)
        act(() => result.current.handleSelectSpeed('deep'))
        expect(result.current.selectedSpeed).toBe('deep')

        act(() => result.current.handleInputChange('a hard refactor'))
        act(() => result.current.handleSubmit())
        expect(onSubmit.mock.calls[0][1].runConfig.effort).toBe('deep')
    })

    it('an old saved speed of deep no longer applies: the box starts on Fast', async () => {
        // the Defaults page is gone; a value saved there before stays in the database
        account = { ...account, defaultPlanFirst: true, defaultEffort: 'deep' } as any
        const { result } = openBox()

        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))
        expect(result.current.selectedSpeed).toBe('fast')
    })

    it('starts on plan first and no pull request from "save as default"', async () => {
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
            effort: 'fast',
            openPullRequest: false,
        })
    })

    it('stays on credits with saved keys while the model source is credits', async () => {
        account = { ...account, defaultModelSource: 'CREDITS', defaultPlanFirst: true }
        const { result } = openBox()

        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))
        await waitFor(() => expect(byokAPI.list).toHaveBeenCalled())
        expect(result.current.selectedSource).toBe('CREDITS')
        expect(result.current.selectedModel).toBe('')
    })

    it('starts on the first key and its default model when the model source is your keys', async () => {
        // an old saved own-key model is ignored: the key's own default is used
        account = {
            ...account,
            defaultModelSource: 'OWN_KEY',
            defaultOwnKeyProvider: 'groq',
            defaultOwnKeyModel: 'qwen-qwq-32b',
        } as any
        const { result } = openBox()

        await waitFor(() => expect(result.current.selectedSource).toBe('OWN_KEY'))
        expect(result.current.selectedProvider).toBe('openai')
        expect(result.current.selectedModel).toBe('gpt-5')
    })

    it('starts with no repository and does not load the list, even with an old saved repo', async () => {
        account = {
            ...account,
            defaultPlanFirst: true,
            defaultRepository: 'acme/api',
            defaultBaseBranch: 'develop',
        } as any
        const { result } = openBox()

        await waitFor(() => expect(usePromptConfig.getState().values.planFirst).toBe(true))
        expect(result.current.selectedRepos).toEqual([])
        expect(result.current.selectedBranch).toBe('')
        expect(profileAPI.getGithubRepos).not.toHaveBeenCalled()
    })

    it('a repository picked by hand starts on its default branch', async () => {
        account = { ...account, defaultBaseBranch: 'develop' } as any
        const onSubmit = mock((_prompt: string, _options?: any) => {})
        const { result } = openBox(onSubmit)

        act(() => result.current.handleSelectRepo(repo('api', 'trunk')))
        expect(result.current.selectedRepos[0].fullName).toBe('acme/api')
        expect(result.current.selectedBranch).toBe('trunk')

        act(() => result.current.handleInputChange('fix the tests'))
        act(() => result.current.handleSubmit())
        expect(onSubmit.mock.calls[0][1]).toMatchObject({
            repoUrl: 'https://github.com/acme/api',
            branch: 'trunk',
        })
    })

    it('a repository with no default branch starts on main', async () => {
        const { result } = openBox()
        act(() => result.current.handleSelectRepo({ ...repo('web'), defaultBranch: '' }))
        expect(result.current.selectedBranch).toBe('main')
    })
})
