import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { renderHook, act } = await import('@testing-library/react')
const { render, fireEvent, screen, waitFor } = await import('@testing-library/react')
const { usePromptInputController } =
    await import('../src/features/home/hooks/usePromptInputController')
const { PromptFooter } = await import('../src/shared/components/ui/PromptFooter')
const { useModelSelection } = await import('../src/features/home/model-selection')

describe('Speed, model and provider routing', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        // the picked model is shared across tests in one bun process
        useModelSelection.getState().reset()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </MemoryRouter>
    )

    it('on December credits the prompt goes out with the speed and no model', () => {
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

        // credits are the default, and Fast is the default speed
        expect(result.current.selectedSource).toBe('CREDITS')
        expect(result.current.selectedSpeed).toBe('fast')

        act(() => {
            result.current.handleSelectSpeed('deep')
        })
        expect(result.current.selectedSpeed).toBe('deep')

        act(() => {
            result.current.handleInputChange('Analyze code architecture')
        })
        act(() => {
            result.current.handleSubmit()
        })

        expect(onSubmit).toHaveBeenCalledTimes(1)
        const [submittedPrompt, submittedOptions] = onSubmit.mock.calls[0]
        expect(submittedPrompt).toBe('Analyze code architecture')
        // the server picks the model of the speed, so the browser names none (#632)
        expect(submittedOptions).toEqual({
            repoUrl: undefined,
            branch: undefined,
            issueNumber: undefined,
            model: undefined,
            provider: undefined,
            billingSource: 'CREDITS',
            runConfig: { planFirst: false, effort: 'deep', openPullRequest: true },
        })
    })

    it('on your own key the prompt goes out with the model, the provider and the speed', () => {
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

        act(() => {
            result.current.handleSelectModel('claude-sonnet-5', 'anthropic', 'OWN_KEY')
        })
        expect(result.current.selectedModel).toBe('claude-sonnet-5')
        expect(result.current.selectedProvider).toBe('anthropic')

        act(() => {
            result.current.handleSelectSpeed('fast')
        })
        act(() => {
            result.current.handleInputChange('Analyze code architecture')
        })
        act(() => {
            result.current.handleSubmit()
        })

        expect(onSubmit.mock.calls[0][1]).toEqual({
            repoUrl: undefined,
            branch: undefined,
            issueNumber: undefined,
            model: 'claude-sonnet-5',
            provider: 'anthropic',
            billingSource: 'OWN_KEY',
            runConfig: { planFirst: false, effort: 'fast', openPullRequest: true },
        })
    })

    it('shows Fast and Deep on December credits, and a pick tells the speed and no model', () => {
        const onSelectModel = mock((model: string, provider?: string) => {})
        const onSelectSpeed = mock((speed: string) => {})

        render(
            <MemoryRouter>
                <QueryClientProvider client={queryClient}>
                    <PromptFooter
                        onUpload={() => {}}
                        onSubmit={() => {}}
                        hasInput={true}
                        isLoading={false}
                        isAuthenticated={true}
                        selectedSpeed="deep"
                        onSelectModel={onSelectModel}
                        onSelectSpeed={onSelectSpeed}
                    />
                </QueryClientProvider>
            </MemoryRouter>
        )

        // no model names on credits
        const deep = screen.getByRole('radio', { name: 'Deep' })
        const fast = screen.getByRole('radio', { name: 'Fast' })
        expect(deep.getAttribute('aria-checked')).toBe('true')
        expect(screen.queryByRole('button', { name: /Select Model/i })).toBeNull()

        fireEvent.click(fast)

        expect(onSelectSpeed).toHaveBeenCalledTimes(1)
        expect(onSelectSpeed).toHaveBeenCalledWith('fast')
        expect(onSelectModel).not.toHaveBeenCalled()
    })

    it('on credits send_prompt has the tier and no model or provider', async () => {
        const { generationAPI, getSharedSocket } =
            await import('../src/features/generation/api/generation')
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'connected', {
            get: () => true,
            configurable: true,
        })
        let emittedPromptData: any = null
        socket.emit = mock((event: string, data: any) => {
            if (event === 'send_prompt') {
                emittedPromptData = data
            }
        }) as any

        useModelSelection.getState().setSpeed('fast')
        void generationAPI.generateProjectStream({
            prompt: 'Test prompt',
            sessionId: 'test-session-123',
            billingSource: 'CREDITS',
            onEvent: () => {},
        })

        expect(emittedPromptData).toEqual({
            sessionId: 'test-session-123',
            projectId: 'test-session-123',
            prompt: 'Test prompt',
            billingSource: 'CREDITS',
            // the server maps the tier to a model (#632)
            tier: 'fast',
        })
    })

    it('on credits a new session is created with the tier and no model or provider', async () => {
        const { generationAPI, getSharedSocket } =
            await import('../src/features/generation/api/generation')
        const { sessionAPI } = await import('../src/features/sessions/api/session')
        const socket = getSharedSocket()
        Object.defineProperty(socket, 'connected', {
            get: () => true,
            configurable: true,
        })
        socket.emit = mock(() => {}) as any
        let createdWith: any = null
        const create = spyOn(sessionAPI, 'createSession').mockImplementation(async (data: any) => {
            createdWith = data
            return { id: 'session-credits' } as any
        })

        void generationAPI.generateProjectStream({
            prompt: 'Test prompt',
            billingSource: 'CREDITS',
            runConfig: { planFirst: false, effort: 'deep', openPullRequest: true },
            onEvent: () => {},
        })

        await waitFor(() => expect(createdWith).not.toBeNull())
        expect(createdWith).toEqual({
            prompt: 'Test prompt',
            type: 'WEB',
            repoUrl: undefined,
            branch: undefined,
            gitRef: undefined,
            issueNumber: undefined,
            tier: 'deep',
            planFirst: false,
            effort: 'deep',
            openPullRequest: true,
        })
        create.mockRestore()
    })
})
