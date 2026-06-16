import { describe, test, expect } from 'bun:test'

import {
    createProjectSchema,
    renameProjectSchema,
    getProjectByIdSchema,
    toggleStarProjectSchema,
    duplicateProjectSchema,
    updateGeneralSettingsSchema,
    shareProjectAsTemplateSchema,
} from '../src'

describe('project.schema', () => {
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

        test('should pass with name of exactly 50 chars', () => {
            const data = { name: 'A'.repeat(50), prompt: 'Build it' }
            expect(createProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should fail if name is too short (2 chars)', () => {
            const data = { name: 'Hi', prompt: 'Build app' }
            const result = createProjectSchema.safeParse(data)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.name).toContain(
                    'name must be at least 3 characters'
                )
            }
        })

        test('should fail if name is too long (51 chars)', () => {
            const data = { name: 'A'.repeat(51), prompt: 'Build app' }
            const result = createProjectSchema.safeParse(data)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.name).toContain(
                    'name must be at most 50 characters'
                )
            }
        })

        test('should fail if name is missing', () => {
            const data = { prompt: 'Build app' }
            const result = createProjectSchema.safeParse(data)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.name).toContain('name is required')
            }
        })

        test('should fail if name is a number', () => {
            const data = { name: 42, prompt: 'Build app' }
            const result = createProjectSchema.safeParse(data)
            expect(result.success).toBe(false)
            if (!result.success) {
                expect(result.error.flatten().fieldErrors.name).toContain('name is required')
            }
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

        test('should fail if description is too long (> 500 chars)', () => {
            const data = {
                name: 'My Project',
                description: 'A'.repeat(501),
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

        test('should pass if description is exactly 500 chars', () => {
            const data = {
                name: 'My Project',
                description: 'A'.repeat(500),
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

    describe('renameProjectSchema', () => {
        test('should pass with a valid rename string', () => {
            const data = { rename: 'New Name' }
            expect(renameProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should fail with empty string rename (min 3 chars required)', () => {
            const data = { rename: '' }
            expect(renameProjectSchema.safeParse(data).success).toBe(false)
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

    describe('toggleStarProjectSchema', () => {
        test('should pass with isStarred true', () => {
            expect(toggleStarProjectSchema.safeParse({ isStarred: true }).success).toBe(true)
        })

        test('should pass with isStarred false', () => {
            expect(toggleStarProjectSchema.safeParse({ isStarred: false }).success).toBe(true)
        })

        test('should fail if isStarred is missing', () => {
            expect(toggleStarProjectSchema.safeParse({}).success).toBe(false)
        })

        test('should fail if isStarred is a string "true"', () => {
            expect(toggleStarProjectSchema.safeParse({ isStarred: 'true' }).success).toBe(false)
        })

        test('should fail if isStarred is a number 1', () => {
            expect(toggleStarProjectSchema.safeParse({ isStarred: 1 }).success).toBe(false)
        })

        test('should fail if isStarred is null', () => {
            expect(toggleStarProjectSchema.safeParse({ isStarred: null }).success).toBe(false)
        })
    })

    describe('duplicateProjectSchema', () => {
        test('should pass with all valid fields', () => {
            const data = { name: 'My Copy Project' }
            expect(duplicateProjectSchema.safeParse(data).success).toBe(true)
        })

        test('should pass if name is missing (it is optional)', () => {
            expect(duplicateProjectSchema.safeParse({}).success).toBe(true)
        })

        test('should fail if name is too short (2 chars)', () => {
            const data = { name: 'Hi' }
            expect(duplicateProjectSchema.safeParse(data).success).toBe(false)
        })

        test('should fail if name is too long (51 chars)', () => {
            const data = { name: 'A'.repeat(51) }
            expect(duplicateProjectSchema.safeParse(data).success).toBe(false)
        })
    })

    describe('updateGeneralSettingsSchema', () => {
        test('should pass with all valid fields', () => {
            const data = {
                name: 'Updated Name',
                description: 'Updated description of project',
                isStarred: true,
                isSharedAsTemplate: true,
                projectCategory: 'DASHBOARD',
            }
            expect(updateGeneralSettingsSchema.safeParse(data).success).toBe(true)
        })

        test('should pass with empty object', () => {
            expect(updateGeneralSettingsSchema.safeParse({}).success).toBe(true)
        })

        test('should pass with null description', () => {
            expect(updateGeneralSettingsSchema.safeParse({ description: null }).success).toBe(true)
        })

        test('should fail with description under 10 chars', () => {
            expect(updateGeneralSettingsSchema.safeParse({ description: 'short' }).success).toBe(
                false
            )
        })

        test('should fail if name is under 3 chars', () => {
            expect(updateGeneralSettingsSchema.safeParse({ name: 'Hi' }).success).toBe(false)
        })

        test('should fail if projectCategory is invalid enum value', () => {
            expect(
                updateGeneralSettingsSchema.safeParse({ projectCategory: 'INVALID' }).success
            ).toBe(false)
        })

        test('should fail if isStarred is not boolean', () => {
            expect(updateGeneralSettingsSchema.safeParse({ isStarred: 'true' }).success).toBe(false)
        })
    })

    describe('shareProjectAsTemplateSchema', () => {
        test('should pass with isSharedAsTemplate true', () => {
            expect(
                shareProjectAsTemplateSchema.safeParse({ isSharedAsTemplate: true }).success
            ).toBe(true)
        })

        test('should pass with category', () => {
            expect(
                shareProjectAsTemplateSchema.safeParse({
                    isSharedAsTemplate: false,
                    projectCategory: 'PORTFOLIO_BLOG',
                }).success
            ).toBe(true)
        })

        test('should fail if isSharedAsTemplate is missing', () => {
            expect(shareProjectAsTemplateSchema.safeParse({}).success).toBe(false)
        })

        test('should fail if isSharedAsTemplate is not boolean', () => {
            expect(shareProjectAsTemplateSchema.safeParse({ isSharedAsTemplate: 1 }).success).toBe(
                false
            )
        })

        test('should fail if projectCategory is invalid', () => {
            expect(
                shareProjectAsTemplateSchema.safeParse({
                    isSharedAsTemplate: true,
                    projectCategory: 'WRONG_CAT',
                }).success
            ).toBe(false)
        })
    })
})
