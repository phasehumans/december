import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import React from 'react'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { renderHook, act, cleanup, waitFor } = await import('@testing-library/react')
const { useAppStore } = await import('../src/app/store')
const { sessionAPI } = await import('../src/features/sessions/api/session')
const { useSessionListMutations } =
    await import('../src/features/sessions/hooks/useSessionListMutations')

// a delete of the session that was last open leaves nothing pointing at it
describe('delete of the last open session', () => {
    const openSession = () =>
        useAppStore.setState({
            activeProjectId: 'sess-open',
            activeProjectName: 'Open one',
            messages: [{ id: 'm1', role: 'user', content: 'hi' }] as any,
            projectLoadError: 'old error',
        })

    const renderMutations = () => {
        const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
        const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
        return renderHook(
            () =>
                useSessionListMutations({
                    setActionError: () => {},
                    onRenameMutate: () => {},
                    onDeleteMutate: () => {},
                }),
            { wrapper }
        )
    }

    beforeEach(() => {
        spyOn(sessionAPI, 'deleteSession').mockResolvedValue({} as never)
    })

    afterEach(() => {
        cleanup()
        mock.restore()
        useAppStore.setState({ activeProjectId: null, activeProjectName: null, messages: [] })
    })

    test('clears the open session state when that session is deleted', async () => {
        openSession()
        const { result } = renderMutations()

        await act(async () => {
            result.current.deleteMutation.mutate('sess-open')
        })

        await waitFor(() => expect(useAppStore.getState().activeProjectId).toBeNull())
        const state = useAppStore.getState()
        expect(state.activeProjectName).toBeNull()
        expect(state.messages).toEqual([])
        expect(state.projectLoadError).toBeNull()
    })

    test('keeps the open session when another session is deleted', async () => {
        openSession()
        const { result } = renderMutations()

        await act(async () => {
            result.current.deleteMutation.mutate('sess-other')
        })

        await waitFor(() => expect(sessionAPI.deleteSession).toHaveBeenCalledWith('sess-other'))
        expect(useAppStore.getState().activeProjectId).toBe('sess-open')
        expect(useAppStore.getState().activeProjectName).toBe('Open one')
    })
})
