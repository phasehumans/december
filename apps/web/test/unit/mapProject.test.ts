import { describe, it, expect } from 'bun:test'
import { mapBackendProjectToUIProject } from '@/app/mapProject'
import type { BackendProject } from '@/features/projects/api/project'

describe('mapProject utils', () => {
    it('maps backend project to UI project correctly', () => {
        const backendProject: BackendProject = {
            id: '1',
            name: 'Test Project',
            description: 'Desc',
            isStarred: true,
            isSharedAsTemplate: false,
            projectStatus: 'READY',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            versionCount: 5,
            currentVersionId: 'v2',
            user: { username: 'john' } as any,
        }

        const uiProject = mapBackendProjectToUIProject(backendProject)

        expect(uiProject.id).toBe('1')
        expect(uiProject.title).toBe('Test Project')
        expect(uiProject.description).toBe('Desc')
        expect(uiProject.isStarred).toBe(true)
        expect(uiProject.isSharedAsTemplate).toBe(false)
        expect(uiProject.status).toBe('Generated')
        expect(uiProject.versionCount).toBe(5)
        expect(uiProject.currentVersionId).toBe('v2')
        expect(uiProject.createdByUsername).toBe('john')
        expect(uiProject.createdAt).toBe('less than minute ago') // Since we used now
    })

    it('handles default values when missing fields', () => {
        const backendProject = {
            id: '2',
            name: 'Minimal Project',
            projectStatus: 'DRAFT',
            createdAt: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
            updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
        } as BackendProject

        const uiProject = mapBackendProjectToUIProject(backendProject)

        expect(uiProject.description).toBe('')
        expect(uiProject.isSharedAsTemplate).toBe(false)
        expect(uiProject.status).toBe('Draft')
        expect(uiProject.versionCount).toBe(0)
        expect(uiProject.currentVersionId).toBe(null)
        expect(uiProject.createdByUsername).toBe('unknown')
        expect(uiProject.createdAt).toBe('1 minute ago')
        expect(uiProject.updatedAt).toBe('2 hours ago')
    })

    it('maps different project statuses', () => {
        const createProjectWithStatus = (status: any) =>
            ({
                ...({} as any),
                id: '1',
                name: 'Status Test',
                projectStatus: status,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }) as BackendProject

        expect(mapBackendProjectToUIProject(createProjectWithStatus('GENERATING')).status).toBe(
            'Generating'
        )
        expect(mapBackendProjectToUIProject(createProjectWithStatus('READY')).status).toBe(
            'Generated'
        )
        expect(mapBackendProjectToUIProject(createProjectWithStatus('DEPLOYED')).status).toBe(
            'Deployed'
        )
        expect(mapBackendProjectToUIProject(createProjectWithStatus('FAILED')).status).toBe(
            'Failed'
        )
        expect(mapBackendProjectToUIProject(createProjectWithStatus('UNKNOWN_STATUS')).status).toBe(
            'Draft'
        )
    })
})
