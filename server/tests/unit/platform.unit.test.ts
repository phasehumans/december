import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test'
import fs from 'fs'

let mockProject: any = null
let mockCheckSuccess = true
let mockCheckErrors = ''
let mockCheckCalled = false
let fsExistsMock = true

mock.module('../../src/config/db', () => ({
    prisma: {
        project: {
            findFirst: async () => mockProject,
            update: async ({ data }: any) => ({
                decemberDeploymentUrl: data.decemberDeploymentUrl,
                decemberLastDeployedAt: new Date(),
            }),
        },
    },
}))

mock.module('../../src/modules/runtime/runtime.service', () => ({
    runtimeService: {
        checkSandboxCompilation: async () => {
            mockCheckCalled = true
            return {
                success: mockCheckSuccess,
                errors: mockCheckErrors || undefined,
            }
        },
    },
}))

// Override fs methods directly
const originalExistsSync = fs.existsSync
const originalMkdirSync = fs.mkdirSync
const originalReaddirSync = fs.readdirSync
const originalRmSync = fs.rmSync
const originalCopyFileSync = fs.copyFileSync

fs.existsSync = (filePath: any): boolean => {
    const p = String(filePath)
    if (p.includes('proj-123')) {
        return fsExistsMock
    }
    return originalExistsSync(filePath)
}

fs.mkdirSync = (() => {}) as any
fs.readdirSync = (() => []) as any
fs.rmSync = (() => {}) as any
fs.copyFileSync = (() => {}) as any

afterAll(() => {
    // Restore original fs methods
    fs.existsSync = originalExistsSync
    fs.mkdirSync = originalMkdirSync
    fs.readdirSync = originalReaddirSync
    fs.rmSync = originalRmSync
    fs.copyFileSync = originalCopyFileSync
})

// Import projectService
import { projectService } from '../../src/modules/project/project.service'

describe('December Local Deployment Service', () => {
    beforeEach(() => {
        mockProject = {
            id: 'proj-123',
            name: 'Test Project',
            currentVersionId: 'ver-123',
        }
        mockCheckSuccess = true
        mockCheckErrors = ''
        mockCheckCalled = false
        fsExistsMock = true
    })

    test('should throw 404 if project is not found', async () => {
        mockProject = null
        expect(projectService.deployDecemberProject('proj-123', 'user-123')).rejects.toThrow(
            'project not found'
        )
    })

    test('should throw 400 if project has no compiled version', async () => {
        mockProject.currentVersionId = null
        expect(projectService.deployDecemberProject('proj-123', 'user-123')).rejects.toThrow(
            'project has no compiled version to deploy'
        )
    })

    test('should invoke checkSandboxCompilation and build files', async () => {
        const result = await projectService.deployDecemberProject('proj-123', 'user-123')
        expect(mockCheckCalled).toBe(true)
        expect(result.deploymentUrl).toBe('http://proj-123.december.localhost:8085')
    })

    test('should throw 400 if compilation fails', async () => {
        mockCheckSuccess = false
        mockCheckErrors = 'Vite Build error in App.tsx'
        expect(projectService.deployDecemberProject('proj-123', 'user-123')).rejects.toThrow(
            'Compilation check failed: Vite Build error in App.tsx'
        )
    })

    test('should throw 400 if dist directory does not exist after build', async () => {
        fsExistsMock = false // Make existSync('dist') return false
        expect(projectService.deployDecemberProject('proj-123', 'user-123')).rejects.toThrow(
            'Built production assets not found'
        )
    })
})
