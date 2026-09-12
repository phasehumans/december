import { QueryClient } from '@tanstack/react-query'
import { describe, it, expect, beforeEach } from 'bun:test'

import { useAppStore } from '../src/app/store'
import * as soundModule from '../src/shared/utils/sound'

describe('Chat Controller Completion Sound Integration', () => {
    beforeEach(() => {
        soundModule._resetSoundDebounceForTesting()
        useAppStore.setState({
            messages: [],
            generationPhase: null,
            isGenerating: false,
        })
    })

    it('triggers sound notification on completion when preference is FIRST_GENERATION and messages count is 1', () => {
        let playCalled = false
        const mockPlay = () => {
            playCalled = true
        }

        // simulate 1 assistant message in store
        useAppStore.setState({
            messages: [
                { id: 'u1', role: 'user', content: 'hello' } as any,
                { id: 'a1', role: 'assistant', content: 'done' } as any,
            ],
        })

        const queryClient = new QueryClient()
        queryClient.setQueryData(['profile'], { generationSound: 'FIRST_GENERATION' })

        // invoke sound logic directly mimicking triggerCompletionSound
        const profile = queryClient.getQueryData<any>(['profile'])
        const soundPreference = profile?.generationSound ?? 'FIRST_GENERATION'
        const assistantCount = useAppStore
            .getState()
            .messages.filter((m) => m.role === 'assistant').length

        soundModule.playGenerationSoundNotification(soundPreference, {
            isFirstGeneration: assistantCount <= 1,
            playFn: mockPlay,
        })

        expect(playCalled).toBe(true)
    })

    it('marks isFirstGeneration as false when multiple assistant messages exist in store', () => {
        let playCalled = false
        const mockPlay = () => {
            playCalled = true
        }

        // simulate 2 assistant messages in store (subsequent generation)
        useAppStore.setState({
            messages: [
                { id: 'u1', role: 'user', content: 'hello' } as any,
                { id: 'a1', role: 'assistant', content: 'done' } as any,
                { id: 'u2', role: 'user', content: 'second prompt' } as any,
                { id: 'a2', role: 'assistant', content: 'second done' } as any,
            ],
        })

        const queryClient = new QueryClient()
        queryClient.setQueryData(['profile'], { generationSound: 'FIRST_GENERATION' })

        const profile = queryClient.getQueryData<any>(['profile'])
        const soundPreference = profile?.generationSound ?? 'FIRST_GENERATION'
        const assistantCount = useAppStore
            .getState()
            .messages.filter((m) => m.role === 'assistant').length

        soundModule.playGenerationSoundNotification(soundPreference, {
            isFirstGeneration: assistantCount <= 1,
            playFn: mockPlay,
        })

        expect(playCalled).toBe(false)
    })
})
