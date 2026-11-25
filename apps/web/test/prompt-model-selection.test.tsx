import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, mock, beforeEach } from 'bun:test'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { renderHook, act } = await import('@testing-library/react')
const { render, fireEvent, screen } = await import('@testing-library/react')
const { usePromptInputController } =
    await import('../src/features/home/hooks/usePromptInputController')
const { PromptFooter } = await import('../src/shared/components/ui/PromptFooter')
const { useModelSelection } = await import('../src/features/home/model-selection')

describe('Model and provider routing', () => {
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

    it('defaults to gemini-2.5-pro and submits selected model and provider in PromptInputSubmitOptions', () => {
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

        expect(result.current.selectedModel).toBe('gemini-2.5-pro')
        expect(result.current.selectedProvider).toBe('gemini')

        // Switch model to Claude 3.7 Sonnet
        act(() => {
            result.current.handleSelectModel('claude-3-7-sonnet-latest', 'anthropic')
        })

        expect(result.current.selectedModel).toBe('claude-3-7-sonnet-latest')
        expect(result.current.selectedProvider).toBe('anthropic')

        // Submit prompt
        act(() => {
            result.current.handleInputChange('Analyze code architecture')
        })

        act(() => {
            result.current.handleSubmit()
        })

        expect(onSubmit).toHaveBeenCalledTimes(1)
        const [submittedPrompt, submittedOptions] = onSubmit.mock.calls[0]
        expect(submittedPrompt).toBe('Analyze code architecture')
        expect(submittedOptions).toEqual({
            repoUrl: undefined,
            branch: undefined,
            issueNumber: undefined,
            model: 'claude-3-7-sonnet-latest',
            provider: 'anthropic',
            billingSource: 'CREDITS',
            // any credit model that is not the fast one is deep (#632)
            runConfig: { planFirst: false, effort: 'deep', openPullRequest: true },
        })
    })

    it('shows Fast and Deep on December credits and calls onSelectModel with the model of the speed', () => {
        const onSelectModel = mock((model: string, provider?: string) => {})

        render(
            <MemoryRouter>
                <QueryClientProvider client={queryClient}>
                    <PromptFooter
                        onUpload={() => {}}
                        onSubmit={() => {}}
                        hasInput={true}
                        isLoading={false}
                        isAuthenticated={true}
                        selectedModel="gemini-2.5-pro"
                        selectedProvider="gemini"
                        onSelectModel={onSelectModel}
                    />
                </QueryClientProvider>
            </MemoryRouter>
        )

        // no model names on credits: gemini-2.5-pro is "Deep"
        const deep = screen.getByRole('radio', { name: 'Deep' })
        const fast = screen.getByRole('radio', { name: 'Fast' })
        expect(deep.getAttribute('aria-checked')).toBe('true')
        expect(screen.queryByRole('button', { name: /Select Model/i })).toBeNull()
        expect(screen.queryByText('Gemini 2.5 Pro')).toBeNull()

        fireEvent.click(fast)

        expect(onSelectModel).toHaveBeenCalledTimes(1)
        expect(onSelectModel).toHaveBeenCalledWith('gemini-2.5-flash', 'gemini', 'CREDITS')
    })

    it('sends model and provider in send_prompt socket event via generateProjectStream', async () => {
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

        void generationAPI.generateProjectStream({
            prompt: 'Test prompt',
            sessionId: 'test-session-123',
            model: 'claude-3-7-sonnet-latest',
            provider: 'anthropic',
            onEvent: () => {},
        })

        expect(emittedPromptData).toEqual({
            sessionId: 'test-session-123',
            projectId: 'test-session-123',
            prompt: 'Test prompt',
            model: 'claude-3-7-sonnet-latest',
            provider: 'anthropic',
            billingSource: 'CREDITS',
            // on credits the server picks the model from the tier (#632)
            tier: 'deep',
        })
    })
})
