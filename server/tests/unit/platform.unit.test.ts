import fs from 'fs'

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test'

import { downloadProjectVersionSchema } from '../../src/modules/platform/platform.schema'

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

// Import platformService
import { platformService } from '../../src/modules/platform/platform.service'

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
        expect(
            platformService.deployDecemberProject({ projectId: 'proj-123', userId: 'user-123' })
        ).rejects.toThrow('project not found')
    })

    test('should throw 400 if project has no compiled version', async () => {
        mockProject.currentVersionId = null
        expect(
            platformService.deployDecemberProject({ projectId: 'proj-123', userId: 'user-123' })
        ).rejects.toThrow('project has no compiled version to deploy')
    })

    test('should invoke checkSandboxCompilation and build files', async () => {
        const result = await platformService.deployDecemberProject({
            projectId: 'proj-123',
            userId: 'user-123',
        })
        expect(mockCheckCalled).toBe(true)
        expect(result.deploymentUrl).toBe('http://proj-123.december.localhost:8085')
    })

    test('should throw 400 if compilation fails', async () => {
        mockCheckSuccess = false
        mockCheckErrors = 'Vite Build error in App.tsx'
        expect(
            platformService.deployDecemberProject({ projectId: 'proj-123', userId: 'user-123' })
        ).rejects.toThrow('Compilation check failed: Vite Build error in App.tsx')
    })

    test('should throw 400 if dist directory does not exist after build', async () => {
        fsExistsMock = false // Make existSync('dist') return false
        expect(
            platformService.deployDecemberProject({ projectId: 'proj-123', userId: 'user-123' })
        ).rejects.toThrow('Built production assets not found')
    })
})

describe('platform.schema', () => {
    describe('downloadProjectVersionSchema', () => {
        test('should pass without versionId', () => {
            expect(downloadProjectVersionSchema.safeParse({}).success).toBe(true)
        })

        test('should pass with valid UUID versionId', () => {
            const data = { versionId: '550e8400-e29b-41d4-a716-446655440000' }
            expect(downloadProjectVersionSchema.safeParse(data).success).toBe(true)
        })

        test('should fail with an invalid UUID versionId', () => {
            const data = { versionId: 'bad-id' }
            expect(downloadProjectVersionSchema.safeParse(data).success).toBe(false)
        })
    })
})
