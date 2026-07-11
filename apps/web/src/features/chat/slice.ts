import { StateCreator } from 'zustand'
import { Message } from '@/features/chat/types'
import { OutputOperation } from '@/features/preview/types'

export interface ChatSlice {
    messages: Message[]
    generationPhase: 'thinking' | 'building' | 'done' | null
    activeOperation: OutputOperation | null
    isGenerating: boolean
    currentGenerationFilePaths: string[]
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
    setGenerationPhase: (phase: ChatSlice['generationPhase']) => void
    setActiveOperation: (operation: ChatSlice['activeOperation']) => void
    setIsGenerating: (isGenerating: boolean) => void
    setCurrentGenerationFilePaths: (paths: string[]) => void
    updateAssistantMessage: (messageId: string, updater: (message: Message) => Message) => void
}

export const createChatSlice: StateCreator<ChatSlice> = (set, get) => ({
    messages: [],
    generationPhase: null,
    activeOperation: null,
    isGenerating: false,
    currentGenerationFilePaths: [],
    setMessages: (updater) =>
        set((state) => ({
            messages: typeof updater === 'function' ? updater(state.messages) : updater,
        })),
    setGenerationPhase: (generationPhase) => set({ generationPhase }),
    setActiveOperation: (activeOperation) => set({ activeOperation }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setCurrentGenerationFilePaths: (currentGenerationFilePaths) =>
        set({ currentGenerationFilePaths }),
    updateAssistantMessage: (messageId, updater) =>
        set((state) => ({
            messages: state.messages.map((msg) => (msg.id === messageId ? updater(msg) : msg)),
        })),
})
