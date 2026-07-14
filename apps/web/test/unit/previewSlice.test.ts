import { describe, it, expect } from 'bun:test'
import { create } from 'zustand'

import { createPreviewSlice, PreviewSlice } from '@/features/preview/slice'

describe('Preview Slice', () => {
    const useStore = create<PreviewSlice>()(createPreviewSlice)

    it('has correct initial state', () => {
        const state = useStore.getState()
        expect(state.generatedFiles).toEqual({})
        expect(state.activeGeneratedFilePath).toBe(null)
        expect(state.previewSession).toBe(null)
        expect(state.previewSessionError).toBe(null)
    })

    it('setGeneratedFiles updates state', () => {
        const files = {
            'test.ts': {
                path: 'test.ts',
                content: 'hello',
                status: 'done',
                purpose: '',
                generator: '',
            },
        } as any
        useStore.getState().setGeneratedFiles(files)
        expect(useStore.getState().generatedFiles).toEqual(files)
    })

    it('setActiveGeneratedFilePath updates state', () => {
        useStore.getState().setActiveGeneratedFilePath('test.ts')
        expect(useStore.getState().activeGeneratedFilePath).toBe('test.ts')
    })

    it('resetGeneratedOutput clears output', () => {
        useStore.getState().resetGeneratedOutput()
        expect(useStore.getState().generatedFiles).toEqual({})
        expect(useStore.getState().activeGeneratedFilePath).toBe(null)
    })

    it('startGeneratedFile initializes a new file', () => {
        useStore.getState().startGeneratedFile({ path: 'new.ts', purpose: 'test', generator: 'ai' })
        const state = useStore.getState()
        expect(state.activeGeneratedFilePath).toBe('new.ts')
        expect(state.generatedFiles['new.ts']).toEqual({
            path: 'new.ts',
            content: '',
            status: 'building',
            purpose: 'test',
            generator: 'ai',
        })
    })

    it('appendGeneratedFileChunk appends content', () => {
        useStore.getState().appendGeneratedFileChunk('new.ts', 'const a = 1;')
        expect(useStore.getState().generatedFiles['new.ts'].content).toBe('const a = 1;')

        useStore.getState().appendGeneratedFileChunk('new.ts', 'const b = 2;')
        expect(useStore.getState().generatedFiles['new.ts'].content).toBe(
            'const a = 1;const b = 2;'
        )
    })

    it('completeGeneratedFile sets status to done', () => {
        useStore.getState().completeGeneratedFile('new.ts')
        expect(useStore.getState().generatedFiles['new.ts'].status).toBe('done')
    })

    it('markGeneratedFileError sets status to error', () => {
        useStore.getState().markGeneratedFileError('new.ts')
        expect(useStore.getState().generatedFiles['new.ts'].status).toBe('error')
    })
})
