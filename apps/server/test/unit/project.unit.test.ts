import { describe, test, expect } from 'bun:test'

import { parseStoredProjectFiles, mapVersionSummary } from '../../src/modules/project/project.utils'

describe('project.utils', () => {
    describe('parseStoredProjectFiles', () => {
        test('should return empty array when input is not an array (string)', () => {
            expect(parseStoredProjectFiles('not-an-array')).toEqual([])
        })

        test('should return empty array when input is null', () => {
            expect(parseStoredProjectFiles(null)).toEqual([])
        })

        test('should return empty array when input is undefined', () => {
            expect(parseStoredProjectFiles(undefined)).toEqual([])
        })

        test('should return empty array when input is a number', () => {
            expect(parseStoredProjectFiles(42)).toEqual([])
        })

        test('should return empty array when input is a plain object', () => {
            expect(parseStoredProjectFiles({ path: 'a', key: 'b' })).toEqual([])
        })

        test('should return empty array when input is an empty array', () => {
            expect(parseStoredProjectFiles([])).toEqual([])
        })

        test('should skip null entries in array', () => {
            expect(parseStoredProjectFiles([null])).toEqual([])
        })

        test('should skip primitive entries (number) in array', () => {
            expect(parseStoredProjectFiles([123])).toEqual([])
        })

        test('should skip string entries in array', () => {
            expect(parseStoredProjectFiles(['hello'])).toEqual([])
        })

        test('should skip object without path', () => {
            expect(parseStoredProjectFiles([{ key: 'file-key' }])).toEqual([])
        })

        test('should skip object without key', () => {
            expect(parseStoredProjectFiles([{ path: 'src/index.ts' }])).toEqual([])
        })

        test('should skip object where path is a number', () => {
            expect(parseStoredProjectFiles([{ path: 123, key: 'file-key' }])).toEqual([])
        })

        test('should skip object where key is a number', () => {
            expect(parseStoredProjectFiles([{ path: 'src/index.ts', key: 456 }])).toEqual([])
        })

        test('should parse valid file with required fields only and default size to 0', () => {
            const result = parseStoredProjectFiles([{ path: 'src/index.ts', key: 'file-1' }])
            expect(result).toEqual([{ path: 'src/index.ts', key: 'file-1', size: 0 }])
        })

        test('should parse valid file with all fields including contentType and size', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/index.ts', key: 'file-1', contentType: 'text/typescript', size: 120 },
            ])
            expect(result).toEqual([
                { path: 'src/index.ts', key: 'file-1', contentType: 'text/typescript', size: 120 },
            ])
        })

        test('should default size to 0 when size is a string', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/app.ts', key: 'file-2', size: '100' },
            ])
            expect(result).toEqual([{ path: 'src/app.ts', key: 'file-2', size: 0 }])
        })

        test('should default size to 0 when size is missing', () => {
            const result = parseStoredProjectFiles([{ path: 'src/app.ts', key: 'file-2' }])
            expect(result).toEqual([{ path: 'src/app.ts', key: 'file-2', size: 0 }])
        })

        test('should default size to 0 when size is null', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/app.ts', key: 'file-2', size: null },
            ])
            expect(result).toEqual([{ path: 'src/app.ts', key: 'file-2', size: 0 }])
        })

        test('should include contentType when it is a valid string', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/index.ts', key: 'file-1', contentType: 'application/json', size: 50 },
            ])
            expect(result![0]!.contentType).toBe('application/json')
        })

        test('should omit contentType when it is a number', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/index.ts', key: 'file-1', contentType: 123, size: 10 },
            ])
            expect(result).toEqual([{ path: 'src/index.ts', key: 'file-1', size: 10 }])
            expect(result[0]).not.toHaveProperty('contentType')
        })

        test('should omit contentType when it is boolean', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/index.ts', key: 'file-1', contentType: true, size: 10 },
            ])
            expect(result[0]).not.toHaveProperty('contentType')
        })

        test('should omit contentType when it is null', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/index.ts', key: 'file-1', contentType: null, size: 10 },
            ])
            expect(result[0]).not.toHaveProperty('contentType')
        })

        test('should ignore invalid entries and keep valid ones in mixed array', () => {
            const result = parseStoredProjectFiles([
                null,
                { path: 'src/index.ts', key: 'file-1', size: 50 },
                { path: 'src/app.ts' }, // missing key
                'invalid-entry',
                { path: 'src/main.ts', key: 'file-2', contentType: 'text/typescript', size: 80 },
            ])
            expect(result).toEqual([
                { path: 'src/index.ts', key: 'file-1', size: 50 },
                { path: 'src/main.ts', key: 'file-2', contentType: 'text/typescript', size: 80 },
            ])
        })

        test('should parse multiple valid files correctly', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/a.ts', key: 'key-a', size: 10 },
                { path: 'src/b.ts', key: 'key-b', size: 20 },
                { path: 'src/c.ts', key: 'key-c', size: 30 },
            ])
            expect(result).toHaveLength(3)
            expect(result![0]!.path).toBe('src/a.ts')
            expect(result![1]!.path).toBe('src/b.ts')
            expect(result![2]!.path).toBe('src/c.ts')
        })

        test('should handle very large size numbers correctly', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/big.ts', key: 'big-key', size: Number.MAX_SAFE_INTEGER },
            ])
            expect(result![0]!.size).toBe(Number.MAX_SAFE_INTEGER)
        })

        test('should handle size of 0 explicitly', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/empty.ts', key: 'empty-key', size: 0 },
            ])
            expect(result![0]!.size).toBe(0)
        })
    })

    describe('mapVersionSummary', () => {
        const baseVersion = {
            id: 'version-1',
            versionNumber: 1,
            label: null as string | null,
            sourcePrompt: 'Build landing page',
            summary: null as string | null,
            status: 'READY',
            objectStoragePrefix: 'projects/project-1/v1',
            manifestJson: [] as unknown,
            createdAt: new Date('2026-04-08T10:00:00.000Z'),
            updatedAt: new Date('2026-04-08T11:00:00.000Z'),
        }

        test('should use label from version when it is provided', () => {
            const version = { ...baseVersion, id: 'v-a', label: 'Stable Release', versionNumber: 3 }
            const result = mapVersionSummary(version)
            expect(result.label).toBe('Stable Release')
        })

        test('should fallback label to v{versionNumber} when label is null', () => {
            const version = { ...baseVersion, id: 'v-b', label: null, versionNumber: 5 }
            const result = mapVersionSummary(version)
            expect(result.label).toBe('v5')
        })

        test('should fallback label for version 1', () => {
            const version = { ...baseVersion, label: null, versionNumber: 1 }
            const result = mapVersionSummary(version)
            expect(result.label).toBe('v1')
        })

        test('should count 0 files when manifestJson is an empty array', () => {
            const version = { ...baseVersion, manifestJson: [] }
            expect(mapVersionSummary(version).fileCount).toBe(0)
        })

        test('should count files from valid manifestJson entries', () => {
            const version = {
                ...baseVersion,
                manifestJson: [
                    { path: 'src/index.ts', key: 'file-1', size: 100 },
                    { path: 'src/app.ts', key: 'file-2', size: 200 },
                ],
            }
            expect(mapVersionSummary(version).fileCount).toBe(2)
        })

        test('should count only valid entries — skip invalid ones', () => {
            const version = {
                ...baseVersion,
                manifestJson: [
                    { path: 'src/index.ts', key: 'file-1', size: 100 },
                    { path: 'src/app.ts' }, // missing key
                    'invalid-entry',
                    null,
                ],
            }
            expect(mapVersionSummary(version).fileCount).toBe(1)
        })

        test('should return fileCount 0 when manifestJson is not an array (string)', () => {
            const version = { ...baseVersion, manifestJson: 'invalid-manifest' }
            expect(mapVersionSummary(version).fileCount).toBe(0)
        })

        test('should return fileCount 0 when manifestJson is null', () => {
            const version = { ...baseVersion, manifestJson: null }
            expect(mapVersionSummary(version).fileCount).toBe(0)
        })

        test('should return fileCount 0 when manifestJson is an object', () => {
            const version = { ...baseVersion, manifestJson: { path: 'a', key: 'b' } }
            expect(mapVersionSummary(version).fileCount).toBe(0)
        })

        test('should preserve all core fields in the output', () => {
            const createdAt = new Date('2026-04-08T10:00:00.000Z')
            const updatedAt = new Date('2026-04-08T11:00:00.000Z')
            const version = {
                id: 'version-abc',
                versionNumber: 7,
                label: 'v7-hotfix',
                sourcePrompt: 'Build API',
                summary: 'All done',
                status: 'READY',
                objectStoragePrefix: 'projects/proj/v7',
                manifestJson: [{ path: 'index.ts', key: 'k1', size: 10 }],
                createdAt,
                updatedAt,
            }
            const result = mapVersionSummary(version)
            expect(result).toEqual({
                id: 'version-abc',
                versionNumber: 7,
                label: 'v7-hotfix',
                sourcePrompt: 'Build API',
                summary: 'All done',
                status: 'READY',
                objectStoragePrefix: 'projects/proj/v7',
                fileCount: 1,
                createdAt,
                updatedAt,
            })
        })

        test('should pass through null summary', () => {
            const version = { ...baseVersion, summary: null }
            expect(mapVersionSummary(version).summary).toBeNull()
        })

        test('should pass through PENDING status', () => {
            const version = { ...baseVersion, status: 'PENDING' }
            expect(mapVersionSummary(version).status).toBe('PENDING')
        })

        test('should pass through GENERATING status', () => {
            const version = { ...baseVersion, status: 'GENERATING' }
            expect(mapVersionSummary(version).status).toBe('GENERATING')
        })

        test('should pass through FAILED status', () => {
            const version = { ...baseVersion, status: 'FAILED' }
            expect(mapVersionSummary(version).status).toBe('FAILED')
        })

        test('should preserve createdAt and updatedAt dates exactly', () => {
            const createdAt = new Date('2025-01-01T00:00:00.000Z')
            const updatedAt = new Date('2025-06-01T12:00:00.000Z')
            const version = { ...baseVersion, createdAt, updatedAt }
            const result = mapVersionSummary(version)
            expect(result.createdAt).toBe(createdAt)
            expect(result.updatedAt).toBe(updatedAt)
        })

        test('should not include manifestJson in output (stripped)', () => {
            const version = {
                ...baseVersion,
                manifestJson: [{ path: 'src/index.ts', key: 'file-1', size: 10 }],
            }
            const result = mapVersionSummary(version)
            expect(result).not.toHaveProperty('manifestJson')
        })

        test('should correctly map a PROCESSING version with no files', () => {
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

import {
    createProjectSchema,
    renameProjectSchema,
    updateGeneralSettingsSchema,
} from '../../src/modules/project/project.schema'

describe('project schemas', () => {
    describe('createProjectSchema', () => {
        test('validates correct project creation input', () => {
            const res = createProjectSchema.safeParse({
                name: 'test-project',
                description: 'this is a description with at least ten characters',
                prompt: 'create a nice button',
            })
            expect(res.success).toBe(true)
        })

        test('fails if name is too short', () => {
            const res = createProjectSchema.safeParse({
                name: 'ab',
                prompt: 'create a nice button',
            })
            expect(res.success).toBe(false)
        })

        test('fails if description is too short', () => {
            const res = createProjectSchema.safeParse({
                name: 'test-project',
                description: 'short',
                prompt: 'create a nice button',
            })
            expect(res.success).toBe(false)
        })
    })

    describe('renameProjectSchema', () => {
        test('validates valid rename input', () => {
            const res = renameProjectSchema.safeParse({ rename: 'new-name' })
            expect(res.success).toBe(true)
        })

        test('fails if rename is empty', () => {
            const res = renameProjectSchema.safeParse({ rename: '' })
            expect(res.success).toBe(false)
        })
    })

    describe('updateGeneralSettingsSchema', () => {
        test('validates valid partial updates', () => {
            const res = updateGeneralSettingsSchema.safeParse({
                isStarred: true,
                projectCategory: 'DASHBOARD',
            })
            expect(res.success).toBe(true)
        })

        test('fails if category is invalid', () => {
            const res = updateGeneralSettingsSchema.safeParse({
                projectCategory: 'INVALID_CATEGORY',
            })
            expect(res.success).toBe(false)
        })
    })
})
