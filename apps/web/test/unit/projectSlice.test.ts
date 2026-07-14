import { describe, it, expect } from 'bun:test'
import { create } from 'zustand'

import { createProjectSlice, ProjectSlice } from '@/features/projects/slice'

describe('Project Slice', () => {
    const useStore = create<ProjectSlice>()(createProjectSlice)

    it('has correct initial state', () => {
        const state = useStore.getState()
        expect(state.activeProjectId).toBe(null)
        expect(state.activeProjectName).toBe(null)
        expect(state.projectVersions).toEqual([])
        expect(state.activeProjectVersionId).toBe(null)
        expect(state.isProjectOpening).toBe(false)
        expect(state.projectLoadError).toBe(null)
        expect(typeof state.selectedModel).toBe('string')
    })

    it('setActiveProjectId updates state', () => {
        useStore.getState().setActiveProjectId('project-1')
        expect(useStore.getState().activeProjectId).toBe('project-1')
    })

    it('setActiveProjectName updates state', () => {
        useStore.getState().setActiveProjectName('My Project')
        expect(useStore.getState().activeProjectName).toBe('My Project')
    })

    it('setProjectVersions updates state', () => {
        const versions = [{ id: 'v1', createdAt: 'date' }] as any
        useStore.getState().setProjectVersions(versions)
        expect(useStore.getState().projectVersions).toEqual(versions)
    })

    it('setSelectedModel updates state and localStorage', () => {
        useStore.getState().setSelectedModel('model-x')
        expect(useStore.getState().selectedModel).toBe('model-x')
        expect(localStorage.getItem('december_selected_model')).toBe('model-x')

        useStore.getState().setSelectedModel('')
        expect(useStore.getState().selectedModel).toBe('')
        expect(localStorage.getItem('december_selected_model')).toBe(null)
    })
})
