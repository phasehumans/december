import { describe, it, expect } from 'bun:test'
import { create } from 'zustand'
import { createChatSlice, ChatSlice } from '@/features/chat/slice'
import { Message } from '@/features/chat/types'

describe('Chat Slice', () => {
    const useStore = create<ChatSlice>()(createChatSlice)

    it('has correct initial state', () => {
        const state = useStore.getState()
        expect(state.messages).toEqual([])
        expect(state.generationPhase).toBe(null)
        expect(state.activeOperation).toBe(null)
        expect(state.isGenerating).toBe(false)
        expect(state.currentGenerationFilePaths).toEqual([])
    })

    it('setMessages updates messages', () => {
        const msg: Message = { id: '1', role: 'user', content: 'hello' }
        useStore.getState().setMessages([msg])
        expect(useStore.getState().messages).toEqual([msg])

        // Using callback
        useStore
            .getState()
            .setMessages((prev) => [...prev, { id: '2', role: 'assistant', content: 'hi' }])
        expect(useStore.getState().messages.length).toBe(2)
    })

    it('setGenerationPhase updates phase', () => {
        useStore.getState().setGenerationPhase('thinking')
        expect(useStore.getState().generationPhase).toBe('thinking')
    })

    it('setIsGenerating updates state', () => {
        useStore.getState().setIsGenerating(true)
        expect(useStore.getState().isGenerating).toBe(true)
    })

    it('setCurrentGenerationFilePaths updates state', () => {
        useStore.getState().setCurrentGenerationFilePaths(['/app.ts'])
        expect(useStore.getState().currentGenerationFilePaths).toEqual(['/app.ts'])
    })
})
