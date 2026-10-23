import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { renderHook, act } = await import('@testing-library/react')
const { usePromptInputController } =
    await import('../src/features/home/hooks/usePromptInputController')

describe('usePromptInputController - repository and branch onboarding', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    it('should select repository and default branch, and submit options', () => {
        const onSubmit = mock((prompt: string, options?: any) => {})

        const { result } = renderHook(
            () =>
                usePromptInputController({
                    onSubmit,
                    isAuthenticated: true,
                    mode: 'agent',
                }),
            { wrapper }
        )

        // Select a repository
        act(() => {
            result.current.handleSelectRepo({
                id: 123,
                name: 'december',
                fullName: 'phasehumans/december',
                htmlUrl: 'https://github.com/phasehumans/december',
                cloneUrl: 'https://github.com/phasehumans/december.git',
                defaultBranch: 'main',
                owner: { login: 'phasehumans' },
            })
        })

        expect(result.current.selectedRepos.length).toBe(1)
        expect(result.current.selectedRepos[0].name).toBe('december')
        expect(result.current.selectedBranch).toBe('main')

        // Change branch
        act(() => {
            result.current.setSelectedBranch('feature/auth-v2')
        })
        expect(result.current.selectedBranch).toBe('feature/auth-v2')

        // Submit with prompt
        act(() => {
            result.current.handleInputChange('Implement repository onboarding #583')
        })

        act(() => {
            result.current.handleSubmit()
        })

        expect(onSubmit).toHaveBeenCalledTimes(1)
        const [submittedPrompt, submittedOptions] = onSubmit.mock.calls[0]
        expect(submittedPrompt).toContain('https://github.com/phasehumans/december')
        expect(submittedPrompt).toContain('Implement repository onboarding #583')
        expect(submittedOptions).toEqual({
            repoUrl: 'https://github.com/phasehumans/december',
            branch: 'feature/auth-v2',
            issueNumber: 583,
        })
    })

    it('should handle removing repository and resetting branch', () => {
        const onSubmit = mock(() => {})

        const { result } = renderHook(
            () =>
                usePromptInputController({
                    onSubmit,
                    isAuthenticated: true,
                    mode: 'agent',
                }),
            { wrapper }
        )

        act(() => {
            result.current.handleSelectRepo({
                id: 1,
                name: 'repo-one',
                htmlUrl: 'https://github.com/org/repo-one',
                defaultBranch: 'develop',
                owner: { login: 'org' },
            })
        })

        expect(result.current.selectedRepos.length).toBe(1)
        expect(result.current.selectedBranch).toBe('develop')

        act(() => {
            result.current.handleRemoveRepo(0)
        })

        expect(result.current.selectedRepos.length).toBe(0)
        expect(result.current.selectedBranch).toBe('')
    })
})
