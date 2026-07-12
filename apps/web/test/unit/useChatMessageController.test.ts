import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useChatMessageController } from '@/features/chat/hooks/useChatMessageController'

describe('useChatMessageController hook', () => {
    beforeEach(() => {
        sessionStorage.clear()
    })

    afterEach(() => {
        cleanup()
    })

    it('initializes with correct defaults', () => {
        const { result } = renderHook(() =>
            useChatMessageController({
                id: 'msg-1',
                content: 'Hello',
                status: 'done',
                index: 0,
                projectType: 'generated',
            })
        )

        expect(result.current.feedback).toBe(null)
        expect(result.current.isThoughtsOpen).toBe(false)
        expect(result.current.isStreamFinished).toBe(true)
        expect(result.current.shouldForceStream).toBe(false)
    })

    it('updates thoughts open state when status changes to building', () => {
        const { result, rerender } = renderHook((props) => useChatMessageController(props), {
            initialProps: {
                id: 'msg-1',
                content: 'Hello',
                status: 'thinking',
                index: 0,
                projectType: 'generated',
            },
        })

        expect(result.current.isThoughtsOpen).toBe(true)

        // Re-render with new status
        rerender({
            id: 'msg-1',
            content: 'Hello',
            status: 'building',
            index: 0,
            projectType: 'generated',
        } as any)

        expect(result.current.isThoughtsOpen).toBe(false)
    })

    it('sets feedback correctly', () => {
        const { result } = renderHook(() =>
            useChatMessageController({
                id: 'msg-1',
                content: 'Hello',
                status: 'done',
            })
        )

        act(() => {
            result.current.setFeedback('like')
        })

        expect(result.current.feedback).toBe('like')
    })

    it('forces stream for first import view', () => {
        sessionStorage.setItem('december_actively_importing_proj-1', 'true')

        const { result } = renderHook(() =>
            useChatMessageController({
                id: 'msg-import',
                content: 'Importing...',
                status: 'done',
                index: 1,
                projectType: 'import',
                projectId: 'proj-1',
            })
        )

        expect(result.current.shouldForceStream).toBe(true)
        expect(result.current.isStreamFinished).toBe(false)
    })
})
