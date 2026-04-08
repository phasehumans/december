import { describe, test, expect } from 'bun:test'

import {
    createProjectSchema,
    updateProjectSchema,
    projectVersionQuerySchema,
} from '../../src/modules/project/project.schema'

import {
    isVersionSchemaMissing,
    parseStoredProjectFiles,
    mapVersionSummary,
} from '../../src/modules/project/project.utils'

describe('project.schema', () => {
    describe('createProjectSchema', () => {
        test('should pass with valid data', () => {
            const data = {
                name: 'My Project',
                description: 'This is valid desc',
                prompt: 'Build landing page',
            }

            const result = createProjectSchema.safeParse(data)

            expect(result.success).toBe(true)
        })

        test('should fail if name is too short', () => {
            const data = {
                name: 'Hi',
                prompt: 'Build app',
            }

            const result = createProjectSchema.safeParse(data)

            expect(result.success).toBe(false)
        })

        test('should fail if description is too short', () => {
            const data = {
                name: 'My Project',
                description: 'short',
                prompt: 'Build app',
            }

            const result = createProjectSchema.safeParse(data)

            expect(result.success).toBe(false)
        })

        test('should pass without description', () => {
            const data = {
                name: 'My Project',
                prompt: 'Build app',
            }

            const result = createProjectSchema.safeParse(data)

            expect(result.success).toBe(true)
        })
    })

    describe('updateProjectSchema', () => {
        test('should pass with rename only', () => {
            const data = {
                rename: 'New Name',
            }

            const result = updateProjectSchema.safeParse(data)

            expect(result.success).toBe(true)
        })

        test('should pass with isStarred only', () => {
            const data = {
                isStarred: true,
            }

            const result = updateProjectSchema.safeParse(data)

            expect(result.success).toBe(true)
        })

        test('should pass with empty object', () => {
            const data = {}

            const result = updateProjectSchema.safeParse(data)

            expect(result.success).toBe(true)
        })

        test('should fail if isStarred is not boolean', () => {
            const data = {
                isStarred: 'yes',
            }

            const result = updateProjectSchema.safeParse(data)

            expect(result.success).toBe(false)
        })
    })

    describe('projectVersionQuerySchema', () => {
        test('should pass with valid uuid', () => {
            const data = {
                versionId: '550e8400-e29b-41d4-a716-446655440000',
            }

            const result = projectVersionQuerySchema.safeParse(data)

            expect(result.success).toBe(true)
        })

        test('should fail with invalid uuid', () => {
            const data = {
                versionId: 'invalid-uuid',
            }

            const result = projectVersionQuerySchema.safeParse(data)

            expect(result.success).toBe(false)
        })

        test('should pass without versionId', () => {
            const data = {}

            const result = projectVersionQuerySchema.safeParse(data)

            expect(result.success).toBe(true)
        })
    })
})

describe('project.utils', () => {
    describe('isVersionSchemaMissing', () => {
        test('should return true when error message contains projectVersion', () => {
            const error = new Error('Relation ProjectVersion does not exist')

            const result = isVersionSchemaMissing(error)

            expect(result).toBe(true)
        })

        test('should return true when error message contains projectMessage', () => {
            const error = new Error('Table projectMessage missing')

            const result = isVersionSchemaMissing(error)

            expect(result).toBe(true)
        })

        test('should return true when error message contains currentVersionId', () => {
            const error = new Error('Column currentVersionId not found')

            const result = isVersionSchemaMissing(error)

            expect(result).toBe(true)
        })

        test('should return true when error message contains versionCount', () => {
            const error = new Error('Unknown field versionCount')

            const result = isVersionSchemaMissing(error)

            expect(result).toBe(true)
        })

        test('should return false for unrelated error messages', () => {
            const error = new Error('Something else failed')

            const result = isVersionSchemaMissing(error)

            expect(result).toBe(false)
        })

        test('should return false when input is not an Error', () => {
            const result = isVersionSchemaMissing('random string error')

            expect(result).toBe(false)
        })
    })

    describe('parseStoredProjectFiles', () => {
        test('should return empty array when value is not an array', () => {
            const result = parseStoredProjectFiles('not-an-array')

            expect(result).toEqual([])
        })

        test('should return empty array when array contains invalid items', () => {
            const result = parseStoredProjectFiles([
                null,
                123,
                'hello',
                {},
                { path: 123, key: 'file-key' },
                { path: 'src/index.ts' },
            ])

            expect(result).toEqual([])
        })

        test('should parse valid files with required fields only', () => {
            const result = parseStoredProjectFiles([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                },
            ])

            expect(result).toEqual([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                    size: 0,
                },
            ])
        })

        test('should include contentType when it is a string', () => {
            const result = parseStoredProjectFiles([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                    contentType: 'text/typescript',
                    size: 120,
                },
            ])

            expect(result).toEqual([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                    contentType: 'text/typescript',
                    size: 120,
                },
            ])
        })

        test('should default size to 0 when size is missing or invalid', () => {
            const result = parseStoredProjectFiles([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                },
                {
                    path: 'src/app.ts',
                    key: 'file-2',
                    size: '100',
                },
            ])

            expect(result).toEqual([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                    size: 0,
                },
                {
                    path: 'src/app.ts',
                    key: 'file-2',
                    size: 0,
                },
            ])
        })

        test('should ignore invalid entries and keep valid ones', () => {
            const result = parseStoredProjectFiles([
                null,
                { path: 'src/index.ts', key: 'file-1', size: 50 },
                { path: 'src/app.ts' },
                { path: 'src/main.ts', key: 'file-2', contentType: 'text/typescript', size: 80 },
            ])

            expect(result).toEqual([
                {
                    path: 'src/index.ts',
                    key: 'file-1',
                    size: 50,
                },
                {
                    path: 'src/main.ts',
                    key: 'file-2',
                    contentType: 'text/typescript',
                    size: 80,
                },
            ])
        })
    })

    describe('mapVersionSummary', () => {
        test('should map version summary and use label when provided', () => {
            const createdAt = new Date('2026-04-08T10:00:00.000Z')
            const updatedAt = new Date('2026-04-08T11:00:00.000Z')

            const version = {
                id: 'version-1',
                versionNumber: 3,
                label: 'Stable Release',
                sourcePrompt: 'Build landing page',
                summary: 'Generated successfully',
                status: 'READY',
                objectStoragePrefix: 'projects/project-1/v3',
                manifestJson: [
                    { path: 'src/index.ts', key: 'file-1', size: 100 },
                    { path: 'src/app.ts', key: 'file-2', size: 200 },
                ],
                createdAt,
                updatedAt,
            }

            const result = mapVersionSummary(version)

            expect(result).toEqual({
                id: 'version-1',
                versionNumber: 3,
                label: 'Stable Release',
                sourcePrompt: 'Build landing page',
                summary: 'Generated successfully',
                status: 'READY',
                objectStoragePrefix: 'projects/project-1/v3',
                fileCount: 2,
                createdAt,
                updatedAt,
            })
        })

        test('should fallback label to v{versionNumber} when label is null', () => {
            const createdAt = new Date('2026-04-08T10:00:00.000Z')
            const updatedAt = new Date('2026-04-08T11:00:00.000Z')

            const version = {
                id: 'version-2',
                versionNumber: 5,
                label: null,
                sourcePrompt: 'Build dashboard',
                summary: null,
                status: 'PENDING',
                objectStoragePrefix: 'projects/project-1/v5',
                manifestJson: [{ path: 'src/index.ts', key: 'file-1', size: 100 }],
                createdAt,
                updatedAt,
            }

            const result = mapVersionSummary(version)

            expect(result).toEqual({
                id: 'version-2',
                versionNumber: 5,
                label: 'v5',
                sourcePrompt: 'Build dashboard',
                summary: null,
                status: 'PENDING',
                objectStoragePrefix: 'projects/project-1/v5',
                fileCount: 1,
                createdAt,
                updatedAt,
            })
        })

        test('should set fileCount to 0 when manifestJson is invalid', () => {
            const createdAt = new Date('2026-04-08T10:00:00.000Z')
            const updatedAt = new Date('2026-04-08T11:00:00.000Z')

            const version = {
                id: 'version-3',
                versionNumber: 1,
                label: null,
                sourcePrompt: 'Build API',
                summary: 'Waiting',
                status: 'PROCESSING',
                objectStoragePrefix: 'projects/project-1/v1',
                manifestJson: 'invalid-manifest',
                createdAt,
                updatedAt,
            }

            const result = mapVersionSummary(version)

            expect(result).toEqual({
                id: 'version-3',
                versionNumber: 1,
                label: 'v1',
                sourcePrompt: 'Build API',
                summary: 'Waiting',
                status: 'PROCESSING',
                objectStoragePrefix: 'projects/project-1/v1',
                fileCount: 0,
                createdAt,
                updatedAt,
            })
        })
    })
})
