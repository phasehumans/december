import { describe, test, expect } from 'bun:test'

import {
    createProjectSchema,
    updateProjectSchema,
    projectVersionQuerySchema,
} from '../../src/modules/project/project.schema'

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
