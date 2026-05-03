import { describe, test, expect } from 'bun:test'

import {
    createProjectSchema,
    renameProjectSchema,
    getProjectByIdSchema,
    downloadProjectVersionSchema,
    toogleStarProjectSchema,
} from '../../src/modules/project/project.schema'

import {
    isVersionSchemaMissing,
    parseStoredProjectFiles,
    mapVersionSummary,
} from '../../src/modules/project/project.utils'

// ---------------------------------------------------------------------------
// project.schema
// ---------------------------------------------------------------------------

describe('project.schema', () => {
    // -----------------------------------------------------------------------
    // createProjectSchema
    // -----------------------------------------------------------------------
    describe('createProjectSchema', () => {
        test('should pass with all valid fields', () => {
            const data = {
                name: 'My Project',
                description: 'This is valid desc',
                prompt: 'Build landing page',
            }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should pass without optional description', () => {
            const data = { name: 'My Project', prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should pass with name of exactly 3 chars', () => {
            const data = { name: 'App', prompt: 'Build it' }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should pass with name of exactly 20 chars', () => {
            const data = { name: 'A'.repeat(20), prompt: 'Build it' }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should fail if name is too short (2 chars)', () => {
            const data = { name: 'Hi', prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if name is too long (21 chars)', () => {
            const data = { name: 'A'.repeat(21), prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if name is missing', () => {
            const data = { prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if name is a number', () => {
            const data = { name: 42, prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if prompt is missing', () => {
            const data = { name: 'My Project' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if prompt is too short (2 chars)', () => {
            const data = { name: 'My Project', prompt: 'Hi' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should pass if prompt has exactly 3 chars', () => {
            const data = { name: 'My Project', prompt: 'Hi!' }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should fail if description is too short (< 10 chars)', () => {
            const data = { name: 'My Project', description: 'short', prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if description is too long (> 30 chars)', () => {
            const data = {
                name: 'My Project',
                description: 'This description is definitely too long for the schema',
                prompt: 'Build app',
            }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should pass if description is exactly 10 chars', () => {
            const data = {
                name: 'My Project',
                description: '1234567890',
                prompt: 'Build app',
            }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should pass if description is exactly 30 chars', () => {
            const data = {
                name: 'My Project',
                description: 'A'.repeat(30),
                prompt: 'Build app',
            }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should fail if description is a number', () => {
            const data = { name: 'My Project', description: 123, prompt: 'Build app' }
            expect(createProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail when completely empty', () => {
            expect(createProjectSchema.safeParse({}).success).toBe(false)
        })
    })

    // -----------------------------------------------------------------------
    // renameProjectSchema
    // -----------------------------------------------------------------------
    describe('renameProjectSchema', () => {
        test('should pass with a valid rename string', () => {
            const data = { rename: 'New Name' }
            expect(renameProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should pass with empty string rename (no min set)', () => {
            const data = { rename: '' }
            expect(renameProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should fail if rename is missing', () => {
            expect(renameProjectSchema.safeParse({}).success).toBe(false)
        })

        test('should fail if rename is a number', () => {
            const data = { rename: 123 }
            expect(renameProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if rename is null', () => {
            const data = { rename: null }
            expect(renameProjectSchema.safeParse(data).success).toBe(false)
        })
    })

    // -----------------------------------------------------------------------
    // getProjectByIdSchema
    // -----------------------------------------------------------------------
    describe('getProjectByIdSchema', () => {
        test('should pass without versionId (all optional)', () => {
            expect(getProjectByIdSchema.safeParse({}).success).toBe(true)
        })

        test('should pass with a valid UUID versionId', () => {
            const data = { versionId: '550e8400-e29b-41d4-a716-446655440000' }
            expect(getProjectByIdSchema.safeParse(data).success).toBe(true)
        })

        test('should fail with an invalid UUID versionId', () => {
            const data = { versionId: 'not-a-uuid' }
            expect(getProjectByIdSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if versionId is a number', () => {
            const data = { versionId: 12345 }
            expect(getProjectByIdSchema.safeParse(data).success).toBe(false)
        })

        test('should fail with partial UUID', () => {
            const data = { versionId: '550e8400-e29b-41d4' }
            expect(getProjectByIdSchema.safeParse(data).success).toBe(false)
        })
    })

    // -----------------------------------------------------------------------
    // downloadProjectVersionSchema
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // toogleStarProjectSchema
    // -----------------------------------------------------------------------
    describe('toogleStarProjectSchema', () => {
        test('should pass with isStarred true', () => {
            expect(toogleStarProjectSchema.safeParse({ isStarred: true }).success).toBe(true)
        })

        test('should pass with isStarred false', () => {
            expect(toogleStarProjectSchema.safeParse({ isStarred: false }).success).toBe(true)
        })

        test('should fail if isStarred is missing', () => {
            expect(toogleStarProjectSchema.safeParse({}).success).toBe(false)
        })

        test('should fail if isStarred is a string "true"', () => {
            expect(toogleStarProjectSchema.safeParse({ isStarred: 'true' }).success).toBe(false)
        })

        test('should fail if isStarred is a number 1', () => {
            expect(toogleStarProjectSchema.safeParse({ isStarred: 1 }).success).toBe(false)
        })

        test('should fail if isStarred is null', () => {
            expect(toogleStarProjectSchema.safeParse({ isStarred: null }).success).toBe(false)
        })
    })
})

// ---------------------------------------------------------------------------
// project.utils
// ---------------------------------------------------------------------------

describe('project.utils', () => {
    // -----------------------------------------------------------------------
    // isVersionSchemaMissing
    // -----------------------------------------------------------------------
    describe('isVersionSchemaMissing', () => {
        test('should return true when message includes "ProjectVersion"', () => {
            expect(
                isVersionSchemaMissing(new Error('Relation ProjectVersion does not exist'))
            ).toBe(true)
        })

        test('should return true when message includes "projectversion" (case-insensitive)', () => {
            expect(isVersionSchemaMissing(new Error('table projectversion missing'))).toBe(true)
        })

        test('should return true when message includes "ProjectMessage"', () => {
            expect(isVersionSchemaMissing(new Error('Table projectMessage missing'))).toBe(true)
        })

        test('should return true when message includes "projectmessage" (case-insensitive)', () => {
            expect(isVersionSchemaMissing(new Error('unknown column projectmessage.id'))).toBe(true)
        })

        test('should return true when message includes "currentVersionId"', () => {
            expect(isVersionSchemaMissing(new Error('Column currentVersionId not found'))).toBe(
                true
            )
        })

        test('should return true when message includes "currentversionid" (case-insensitive)', () => {
            expect(isVersionSchemaMissing(new Error('unknown field currentversionid'))).toBe(true)
        })

        test('should return true when message includes "versionCount"', () => {
            expect(isVersionSchemaMissing(new Error('Unknown field versionCount'))).toBe(true)
        })

        test('should return true when message includes "versioncount" (case-insensitive)', () => {
            expect(isVersionSchemaMissing(new Error('invalid column versioncount'))).toBe(true)
        })

        test('should return false for completely unrelated error messages', () => {
            expect(isVersionSchemaMissing(new Error('Something else failed'))).toBe(false)
        })

        test('should return false for a network error message', () => {
            expect(isVersionSchemaMissing(new Error('ECONNREFUSED 127.0.0.1:5432'))).toBe(false)
        })

        test('should return false when input is not an Error object (string)', () => {
            expect(isVersionSchemaMissing('some error string')).toBe(false)
        })

        test('should return false when input is a plain object', () => {
            expect(isVersionSchemaMissing({ message: 'projectVersion' })).toBe(false)
        })

        test('should return false when input is null', () => {
            expect(isVersionSchemaMissing(null)).toBe(false)
        })

        test('should return false when input is undefined', () => {
            expect(isVersionSchemaMissing(undefined)).toBe(false)
        })

        test('should return false when input is a number', () => {
            expect(isVersionSchemaMissing(42)).toBe(false)
        })
    })

    // -----------------------------------------------------------------------
    // parseStoredProjectFiles
    // -----------------------------------------------------------------------
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
            expect(result[0].contentType).toBe('application/json')
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
            expect(result[0].path).toBe('src/a.ts')
            expect(result[1].path).toBe('src/b.ts')
            expect(result[2].path).toBe('src/c.ts')
        })

        test('should handle very large size numbers correctly', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/big.ts', key: 'big-key', size: Number.MAX_SAFE_INTEGER },
            ])
            expect(result[0].size).toBe(Number.MAX_SAFE_INTEGER)
        })

        test('should handle size of 0 explicitly', () => {
            const result = parseStoredProjectFiles([
                { path: 'src/empty.ts', key: 'empty-key', size: 0 },
            ])
            expect(result[0].size).toBe(0)
        })
    })

    // -----------------------------------------------------------------------
    // mapVersionSummary
    // -----------------------------------------------------------------------
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
