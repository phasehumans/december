import fs from 'fs'

import { describe, expect, test, mock, beforeEach, afterAll } from 'bun:test'

let mockProject: any = null
let mockCheckSuccess = true
let mockCheckErrors = ''
let mockCheckCalled = false
let fsExistsMock = true

mock.module('@december/database', () => ({
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

import { downloadProjectVersionSchema } from '../../src/modules/platform/platform.schema'
import { buildProjectZip } from '../../src/modules/platform/platform.utils'

describe('platform schemas', () => {
    describe('downloadProjectVersionSchema', () => {
        test('should validate a valid versionId UUID', () => {
            const res = downloadProjectVersionSchema.safeParse({
                versionId: '11111111-2222-4333-8444-555555555555',
            })
            expect(res.success).toBe(true)
        })

        test('should validate undefined/missing versionId since it is optional', () => {
            const res = downloadProjectVersionSchema.safeParse({})
            expect(res.success).toBe(true)
        })

        test('should reject invalid versionId UUID', () => {
            const res = downloadProjectVersionSchema.safeParse({
                versionId: 'not-a-uuid',
            })
            expect(res.success).toBe(false)
        })
    })
})

describe('platform utils', () => {
    describe('buildProjectZip', () => {
        test('should successfully compile file entries into a ZIP buffer structure', () => {
            const entries = [
                { path: 'index.html', content: '<html></html>' },
                { path: 'src/App.tsx', content: 'export const App = () => null' },
            ]
            const buffer = buildProjectZip(entries)
            expect(buffer).toBeInstanceOf(Uint8Array)
            expect(buffer.length).toBeGreaterThan(0)

            // A ZIP file starts with the local file header signature: PK\x03\x04
            expect(buffer[0]).toBe(0x50) // P
            expect(buffer[1]).toBe(0x4b) // K
            expect(buffer[2]).toBe(0x03) // \x03
            expect(buffer[3]).toBe(0x04) // \x04
        })
    })
})
