import { describe, it, expect, beforeEach, afterAll } from 'bun:test'

import { prisma } from '../../../src/config/db'
import { templateService } from '../../../src/modules/template/template.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Test User',
            email: `test-${crypto.randomUUID()}@example.com`,
            username: `user_${crypto.randomUUID().slice(0, 12)}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createTemplate = async (userId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.project.create({
        data: {
            name: 'Test Template',
            prompt: 'Build a landing page',
            description: 'A shared template',
            isSharedAsTemplate: true,
            isFeatured: false,
            userId,
            ...overrides,
        },
    })
}

const createSoftDeletedUser = () => createUser({ isDeleted: true })

describe('template.service.integration', () => {
    let userId: string
    let templateId: string

    beforeEach(async () => {
        await prisma.projectLike.deleteMany()
        await prisma.projectVersion.deleteMany()
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id

        const template = await createTemplate(userId)
        templateId = template.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('getAllTemplates', () => {
        it('should return all shared templates', async () => {
            await createTemplate(userId, { name: 'Second Template' })

            const result = await templateService.getAllTemplates()

            expect(Array.isArray(result)).toBe(true)
            expect(result.length).toBe(2)
            const names = result.map((t) => t.name)
            expect(names).toContain('Test Template')
            expect(names).toContain('Second Template')
        })

        it('should return empty array when no templates exist', async () => {
            await prisma.project.deleteMany()

            const result = await templateService.getAllTemplates()

            expect(result).toEqual([])
        })

        it('should not return non-shared projects', async () => {
            await prisma.project.create({
                data: {
                    name: 'Private Project',
                    prompt: 'private',
                    userId,
                    isSharedAsTemplate: false,
                },
            })

            const result = await templateService.getAllTemplates()

            const names = result.map((t) => t.name)
            expect(names).not.toContain('Private Project')
            expect(names).toContain('Test Template')
        })

        it('should only return projects with isSharedAsTemplate true', async () => {
            const result = await templateService.getAllTemplates()

            result.forEach((t) => {
                expect(t.isSharedAsTemplate).toBe(true)
            })
        })

        it('should return templates from all users', async () => {
            const otherUser = await createUser()
            await createTemplate(otherUser.id, { name: 'Other User Template' })

            const result = await templateService.getAllTemplates()

            const names = result.map((t) => t.name)
            expect(names).toContain('Test Template')
            expect(names).toContain('Other User Template')
        })
    })

    describe('getTemplateById', () => {
        it('should return template for valid templateId', async () => {
            const result = await templateService.getTemplateById(templateId)

            expect(result.id).toBe(templateId)
            expect(result.name).toBe('Test Template')
            expect(result.isSharedAsTemplate).toBe(true)
        })

        it('should throw "template not found" for non-existent id', async () => {
            await expect(templateService.getTemplateById('non-existent-id')).rejects.toThrow(
                'template not found'
            )
        })

        it('should throw "template not found" for project not shared as template', async () => {
            const privateProject = await prisma.project.create({
                data: {
                    name: 'Private',
                    prompt: 'private',
                    userId,
                    isSharedAsTemplate: false,
                },
            })

            await expect(templateService.getTemplateById(privateProject.id)).rejects.toThrow(
                'template not found'
            )
        })

        it('should return correct description and prompt', async () => {
            const result = await templateService.getTemplateById(templateId)

            expect(result.description).toBe('A shared template')
            expect(result.prompt).toBe('Build a landing page')
        })

        it('should return the correct userId of the template owner', async () => {
            const result = await templateService.getTemplateById(templateId)

            expect(result.userId).toBe(userId)
        })
    })

    describe('getFeaturedTemplates', () => {
        it('should return only featured templates', async () => {
            await createTemplate(userId, { name: 'Featured One', isFeatured: true })
            await createTemplate(userId, { name: 'Featured Two', isFeatured: true })

            const result = await templateService.getFeaturedTemplates()

            const names = result.map((t) => t.name)
            expect(names).toContain('Featured One')
            expect(names).toContain('Featured Two')
        })

        it('should not return non-featured templates', async () => {
            await createTemplate(userId, { name: 'Not Featured', isFeatured: false })

            const result = await templateService.getFeaturedTemplates()

            const names = result.map((t) => t.name)
            expect(names).not.toContain('Not Featured')
            expect(names).not.toContain('Test Template')
        })

        it('should return empty array when no featured templates exist', async () => {
            const result = await templateService.getFeaturedTemplates()

            expect(result).toEqual([])
        })

        it('should not return non-shared featured projects', async () => {
            await prisma.project.create({
                data: {
                    name: 'Hidden Featured',
                    prompt: 'x',
                    userId,
                    isSharedAsTemplate: false,
                    isFeatured: true,
                },
            })

            const result = await templateService.getFeaturedTemplates()

            const names = result.map((t) => t.name)
            expect(names).not.toContain('Hidden Featured')
        })

        it('should only return results where isFeatured and isSharedAsTemplate are both true', async () => {
            await createTemplate(userId, { name: 'F', isFeatured: true })

            const result = await templateService.getFeaturedTemplates()

            result.forEach((t) => {
                expect(t.isFeatured).toBe(true)
                expect(t.isSharedAsTemplate).toBe(true)
            })
        })
    })

    describe('remixTemplate', () => {
        it('should create a new project from a template without versions', async () => {
            const result = await templateService.remixTemplate({ userId, templateId })

            expect(result.name).toBe('Remix of Test Template')
            expect(result.userId).toBe(userId)
        })

        it('should set remix name as "Remix of {original name}"', async () => {
            const result = await templateService.remixTemplate({ userId, templateId })

            expect(result.name).toBe('Remix of Test Template')
        })

        it('should throw "user not found" for non-existent userId', async () => {
            await expect(
                templateService.remixTemplate({ userId: 'bad-user', templateId })
            ).rejects.toThrow('user not found')
        })

        it('should throw "user not found" for soft-deleted user', async () => {
            const deletedUser = await createSoftDeletedUser()

            await expect(
                templateService.remixTemplate({ userId: deletedUser.id, templateId })
            ).rejects.toThrow('user not found')
        })

        it('should throw "template not found" for non-existent templateId', async () => {
            await expect(
                templateService.remixTemplate({ userId, templateId: 'bad-template' })
            ).rejects.toThrow('template not found')
        })

        it('should throw "template not found" for non-shared project', async () => {
            const privateProject = await prisma.project.create({
                data: {
                    name: 'Private',
                    prompt: 'private',
                    userId,
                    isSharedAsTemplate: false,
                },
            })

            await expect(
                templateService.remixTemplate({ userId, templateId: privateProject.id })
            ).rejects.toThrow('template not found')
        })

        it('should preserve original template after remix', async () => {
            await templateService.remixTemplate({ userId, templateId })

            const original = await prisma.project.findUnique({ where: { id: templateId } })
            expect(original).not.toBeNull()
            expect(original!.isSharedAsTemplate).toBe(true)
            expect(original!.name).toBe('Test Template')
        })

        it('should copy description from template', async () => {
            const result = await templateService.remixTemplate({ userId, templateId })

            expect(result.description).toBe('A shared template')
        })

        it('should set remixed project status to DRAFT when template has no version', async () => {
            const result = await templateService.remixTemplate({ userId, templateId })

            expect(result.projectStatus).toBe('DRAFT')
        })

        it('should persist the remixed project in the database', async () => {
            const result = await templateService.remixTemplate({ userId, templateId })

            const db = await prisma.project.findUnique({ where: { id: result.id } })
            expect(db).not.toBeNull()
            expect(db!.name).toBe('Remix of Test Template')
            expect(db!.userId).toBe(userId)
        })

        it('should not mark remixed project as a template', async () => {
            const result = await templateService.remixTemplate({ userId, templateId })

            const db = await prisma.project.findUnique({ where: { id: result.id } })
            expect(db!.isSharedAsTemplate).toBe(false)
        })

        it('should allow two different users to remix the same template', async () => {
            const otherUser = await createUser()

            const remix1 = await templateService.remixTemplate({ userId, templateId })
            const remix2 = await templateService.remixTemplate({ userId: otherUser.id, templateId })

            expect(remix1.id).not.toBe(remix2.id)
            expect(remix1.userId).toBe(userId)
            expect(remix2.userId).toBe(otherUser.id)
        })
    })

    describe('toggleLike', () => {
        it('should create a like record when liking for the first time', async () => {
            const result = await templateService.toggleLike({
                userId,
                templateId,
                isLiked: true,
            })

            expect(result.isLiked).toBe(true)
            expect(result.userId).toBe(userId)
            expect(result.projectId).toBe(templateId)
        })

        it('should create an unlike record when disliking for the first time', async () => {
            const result = await templateService.toggleLike({
                userId,
                templateId,
                isLiked: false,
            })

            expect(result.isLiked).toBe(false)
        })

        it('should update existing like to unlike', async () => {
            await templateService.toggleLike({ userId, templateId, isLiked: true })

            const result = await templateService.toggleLike({
                userId,
                templateId,
                isLiked: false,
            })

            expect(result.isLiked).toBe(false)
        })

        it('should update existing unlike to like', async () => {
            await templateService.toggleLike({ userId, templateId, isLiked: false })

            const result = await templateService.toggleLike({
                userId,
                templateId,
                isLiked: true,
            })

            expect(result.isLiked).toBe(true)
        })

        it('should return existing record unchanged when same isLiked value passed', async () => {
            const first = await templateService.toggleLike({ userId, templateId, isLiked: true })
            const second = await templateService.toggleLike({ userId, templateId, isLiked: true })

            expect(second.id).toBe(first.id)
            expect(second.isLiked).toBe(true)
        })

        it('should throw "user not found" for non-existent user', async () => {
            await expect(
                templateService.toggleLike({ userId: 'bad-user', templateId, isLiked: true })
            ).rejects.toThrow('user not found')
        })

        it('should throw "user not found" for soft-deleted user', async () => {
            const deletedUser = await createSoftDeletedUser()

            await expect(
                templateService.toggleLike({ userId: deletedUser.id, templateId, isLiked: true })
            ).rejects.toThrow('user not found')
        })

        it('should throw "template not found" for non-existent templateId', async () => {
            await expect(
                templateService.toggleLike({ userId, templateId: 'bad-template', isLiked: true })
            ).rejects.toThrow('template not found')
        })

        it('should throw "template not found" for non-shared project', async () => {
            const privateProject = await prisma.project.create({
                data: {
                    name: 'Private',
                    prompt: 'private',
                    userId,
                    isSharedAsTemplate: false,
                },
            })

            await expect(
                templateService.toggleLike({ userId, templateId: privateProject.id, isLiked: true })
            ).rejects.toThrow('template not found')
        })

        it('should persist like in database', async () => {
            await templateService.toggleLike({ userId, templateId, isLiked: true })

            const db = await prisma.projectLike.findUnique({
                where: { userId_projectId: { userId, projectId: templateId } },
            })

            expect(db).not.toBeNull()
            expect(db!.isLiked).toBe(true)
        })

        it('should allow different users to like the same template independently', async () => {
            const otherUser = await createUser()

            await templateService.toggleLike({ userId, templateId, isLiked: true })
            await templateService.toggleLike({ userId: otherUser.id, templateId, isLiked: true })

            const likes = await prisma.projectLike.findMany({ where: { projectId: templateId } })
            expect(likes.length).toBe(2)
            expect(likes.every((l) => l.isLiked)).toBe(true)
        })

        it('should create only one like record per user per template', async () => {
            await templateService.toggleLike({ userId, templateId, isLiked: true })
            await templateService.toggleLike({ userId, templateId, isLiked: false })
            await templateService.toggleLike({ userId, templateId, isLiked: true })

            const likes = await prisma.projectLike.findMany({
                where: { userId, projectId: templateId },
            })
            expect(likes.length).toBe(1)
        })
    })
})
