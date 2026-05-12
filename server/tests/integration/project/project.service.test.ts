import { describe, it, expect, beforeEach, afterAll } from 'bun:test'

import { prisma } from '../../../src/config/db'
import { projectService } from '../../../src/modules/project/project.service'

const createUser = async (overrides: Record<string, unknown> = {}) => {
    return prisma.user.create({
        data: {
            name: 'Test User',
            email: `test-${crypto.randomUUID()}@example.com`,
            username: `user-${crypto.randomUUID()}`,
            password: 'hashed-password',
            emailVerified: true,
            isDeleted: false,
            ...overrides,
        },
    })
}

const createProject = async (userId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.project.create({
        data: {
            name: 'Test Project',
            prompt: 'Build a landing page',
            description: 'A test project',
            isStarred: false,
            userId,
            ...overrides,
        },
    })
}

const createProjectVersion = async (projectId: string, overrides: Record<string, unknown> = {}) => {
    return prisma.projectVersion.create({
        data: {
            versionNumber: 1,
            label: 'v1',
            sourcePrompt: 'Build a landing page',
            summary: 'Generated successfully',
            status: 'READY',
            objectStoragePrefix: `projects/${projectId}/v1`,
            manifestJson: [
                { path: 'src/index.ts', key: 'file-1', size: 100 },
                { path: 'src/app.ts', key: 'file-2', size: 200 },
            ],
            projectId,
            ...overrides,
        },
    })
}

const createSoftDeletedUser = () => createUser({ isDeleted: true })

describe('project.service.integration', () => {
    let userId: string
    let projectId: string

    beforeEach(async () => {
        await prisma.project.deleteMany()
        await prisma.session.deleteMany()
        await prisma.user.deleteMany()

        const user = await createUser()
        userId = user.id

        const project = await createProject(userId)
        projectId = project.id
    })

    afterAll(async () => {
        await prisma.$disconnect()
    })

    describe('getAllProjects', () => {
        it('should return all projects for a valid user', async () => {
            await createProject(userId, { name: 'Second Project' })

            const result = await projectService.getAllProjects(userId)

            expect(Array.isArray(result)).toBe(true)
            expect(result.length).toBe(2)
            const names = result.map((p) => p.name)
            expect(names).toContain('Test Project')
            expect(names).toContain('Second Project')
        })

        it('should return an empty array when user has no projects', async () => {
            await prisma.project.deleteMany({ where: { userId } })

            const result = await projectService.getAllProjects(userId)

            expect(result).toEqual([])
        })

        it('should throw "user not found" for a non-existent userId', async () => {
            await expect(projectService.getAllProjects('non-existent-user-id')).rejects.toThrow(
                'user not found'
            )
        })

        it('should throw "user not found" for a soft-deleted user', async () => {
            const deletedUser = await createSoftDeletedUser()

            await expect(projectService.getAllProjects(deletedUser.id)).rejects.toThrow(
                'user not found'
            )
        })

        it('should only return projects belonging to the requesting user', async () => {
            const otherUser = await createUser()
            await createProject(otherUser.id, { name: 'Other User Project' })

            const result = await projectService.getAllProjects(userId)

            const names = result.map((p) => p.name)
            expect(names).not.toContain('Other User Project')
            expect(names).toContain('Test Project')
        })
    })

    describe('getProjectById', () => {
        it('should return project with versions and empty generatedFiles when no version exists', async () => {
            const result = await projectService.getProjectById({ userId, projectId })

            expect(result.project.id).toBe(projectId)
            expect(result.project.name).toBe('Test Project')
            expect(result.versions).toEqual([])
            expect(result.selectedVersionId).toBeNull()
            expect(result.activeVersion).toBeNull()
            expect(result.chatMessages).toEqual([])
            expect(result.generatedFiles).toEqual({})
        })

        it('should throw "user not found" for non-existent user', async () => {
            await expect(
                projectService.getProjectById({ userId: 'bad-user', projectId })
            ).rejects.toThrow('user not found')
        })

        it('should throw "user not found" for soft-deleted user', async () => {
            const deletedUser = await createSoftDeletedUser()
            const deletedUserProject = await createProject(deletedUser.id)

            await expect(
                projectService.getProjectById({
                    userId: deletedUser.id,
                    projectId: deletedUserProject.id,
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw "project not found" for non-existent projectId', async () => {
            await expect(
                projectService.getProjectById({ userId, projectId: 'bad-project' })
            ).rejects.toThrow('project not found')
        })

        it("should throw 'project not found' when projectId belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            await expect(
                projectService.getProjectById({ userId, projectId: otherProject.id })
            ).rejects.toThrow('project not found')
        })

        it('should throw "project version not found" for invalid versionId', async () => {
            await createProjectVersion(projectId)

            await expect(
                projectService.getProjectById({
                    userId,
                    projectId,
                    versionId: '00000000-0000-0000-0000-000000000000',
                })
            ).rejects.toThrow('project version not found')
        })

        it('should return correct project name and description', async () => {
            const result = await projectService.getProjectById({ userId, projectId })

            expect(result.project.name).toBe('Test Project')
            expect(result.project.description).toBe('A test project')
            expect(result.project.userId).toBe(userId)
        })
    })

    describe('createProject', () => {
        it('should create a project with all fields', async () => {
            const result = await projectService.createProject({
                name: 'New Project',
                description: 'Valid description',
                prompt: 'Build a SaaS app',
                userId,
            })

            expect(result.id).toBeTruthy()
            expect(result.name).toBe('New Project')
            expect(result.description).toBe('Valid description')
            expect(result.prompt).toBe('Build a SaaS app')
            expect(result.userId).toBe(userId)
            expect(result.isStarred).toBe(false)

            const db = await prisma.project.findUnique({ where: { id: result.id } })
            expect(db).not.toBeNull()
            expect(db!.name).toBe('New Project')
        })

        it('should create a project without description', async () => {
            const result = await projectService.createProject({
                name: 'No Desc Project',
                description: undefined,
                prompt: 'Some prompt',
                userId,
            })

            expect(result.id).toBeTruthy()
            expect(result.description).toBeNull()
        })

        it('should throw "user not found" for non-existent user', async () => {
            await expect(
                projectService.createProject({
                    name: 'Ghost Project',
                    description: undefined,
                    prompt: 'Something',
                    userId: 'non-existent',
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw "user not found" when user is soft-deleted', async () => {
            const deletedUser = await createSoftDeletedUser()

            await expect(
                projectService.createProject({
                    name: 'Deleted User Project',
                    description: undefined,
                    prompt: 'Build it',
                    userId: deletedUser.id,
                })
            ).rejects.toThrow('user not found')
        })

        it('should persist project to database', async () => {
            const result = await projectService.createProject({
                name: 'Persist Test',
                description: 'A description',
                prompt: 'Build app',
                userId,
            })

            const db = await prisma.project.findUnique({ where: { id: result.id } })
            expect(db!.name).toBe('Persist Test')
            expect(db!.userId).toBe(userId)
        })

        it('should set isStarred to false by default', async () => {
            const result = await projectService.createProject({
                name: 'Star Test',
                description: undefined,
                prompt: 'Build app',
                userId,
            })

            expect(result.isStarred).toBe(false)
        })
    })

    describe('renameProject', () => {
        it('should rename a project successfully', async () => {
            const result = await projectService.renameProject({
                projectId,
                userId,
                rename: 'Renamed Project',
            })

            expect(result.message).toBe('project updated')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.name).toBe('Renamed Project')
        })

        it('should throw "user not found" when user does not exist', async () => {
            await expect(
                projectService.renameProject({
                    projectId,
                    userId: 'bad-user',
                    rename: 'New Name',
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw "user not found" when user is soft-deleted', async () => {
            const deletedUser = await createSoftDeletedUser()
            const deletedUserProject = await createProject(deletedUser.id)

            await expect(
                projectService.renameProject({
                    projectId: deletedUserProject.id,
                    userId: deletedUser.id,
                    rename: 'New Name',
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw "project not found" when projectId does not exist', async () => {
            await expect(
                projectService.renameProject({
                    projectId: 'non-existent-project',
                    userId,
                    rename: 'New Name',
                })
            ).rejects.toThrow('project not found')
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            await expect(
                projectService.renameProject({
                    projectId: otherProject.id,
                    userId,
                    rename: 'Hijack Name',
                })
            ).rejects.toThrow('project not found')
        })

        it('should persist the new name to the database', async () => {
            await projectService.renameProject({ projectId, userId, rename: 'Updated Name' })

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.name).toBe('Updated Name')
        })
    })

    describe('deleteProject', () => {
        it('should delete a project successfully', async () => {
            const result = await projectService.deleteProject({ userId, projectId })

            expect(result.message).toBe('project deleted')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db).toBeNull()
        })

        it('should throw "user not found" for non-existent user', async () => {
            await expect(
                projectService.deleteProject({ userId: 'bad-user', projectId })
            ).rejects.toThrow('user not found')
        })

        it('should throw "user not found" for soft-deleted user', async () => {
            const deletedUser = await createSoftDeletedUser()
            const deletedUserProject = await createProject(deletedUser.id)

            await expect(
                projectService.deleteProject({
                    userId: deletedUser.id,
                    projectId: deletedUserProject.id,
                })
            ).rejects.toThrow('user not found')
        })

        it('should throw "project not found" for non-existent project', async () => {
            await expect(
                projectService.deleteProject({ userId, projectId: 'non-existent' })
            ).rejects.toThrow('project not found')
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            await expect(
                projectService.deleteProject({ userId, projectId: otherProject.id })
            ).rejects.toThrow('project not found')
        })

        it('should remove the project from the database permanently', async () => {
            await projectService.deleteProject({ userId, projectId })

            const count = await prisma.project.count({ where: { id: projectId } })
            expect(count).toBe(0)
        })

        it('should delete cascading project versions', async () => {
            await createProjectVersion(projectId)

            await projectService.deleteProject({ userId, projectId })

            const versions = await prisma.projectVersion.findMany({ where: { projectId } })
            expect(versions).toEqual([])
        })
    })

    describe('duplicateProject', () => {
        it('should duplicate a project without a version', async () => {
            const result = await projectService.duplicateProject({ userId, projectId })

            expect(result.name).toBe('Copy of Test Project')
            expect(result.userId).toBe(userId)

            const allProjects = await prisma.project.findMany({ where: { userId } })
            expect(allProjects.length).toBe(2)
        })

        it('should set duplicate project name as "Copy of {original}"', async () => {
            const result = await projectService.duplicateProject({ userId, projectId })
            expect(result.name).toBe('Copy of Test Project')
        })

        it('should throw "project not found" for non-existent project', async () => {
            await expect(
                projectService.duplicateProject({ userId, projectId: 'bad-project' })
            ).rejects.toThrow('project not found')
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            await expect(
                projectService.duplicateProject({ userId, projectId: otherProject.id })
            ).rejects.toThrow('project not found')
        })

        it('should preserve the original project after duplication', async () => {
            await projectService.duplicateProject({ userId, projectId })

            const original = await prisma.project.findUnique({ where: { id: projectId } })
            expect(original).not.toBeNull()
            expect(original!.name).toBe('Test Project')
        })

        it('should copy description from original project', async () => {
            const result = await projectService.duplicateProject({ userId, projectId })
            expect(result.description).toBe('A test project')
        })

        it('should set the new project status to DRAFT when no version exists', async () => {
            const result = await projectService.duplicateProject({ userId, projectId })
            expect(result.projectStatus).toBe('DRAFT')
        })
    })

    describe('shareProjectAsTemplate', () => {
        it('should share project as template successfully', async () => {
            const result = await projectService.shareProjectAsTemplate({
                userId,
                projectId,
                isSharedAsTemplate: true,
            })

            expect(result.message).toBe('project shared as template')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isSharedAsTemplate).toBe(true)
        })

        it('should unshare project as template successfully', async () => {
            await projectService.shareProjectAsTemplate({
                userId,
                projectId,
                isSharedAsTemplate: true,
            })

            const result = await projectService.shareProjectAsTemplate({
                userId,
                projectId,
                isSharedAsTemplate: false,
            })

            expect(result.message).toBe('project unshared as template')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isSharedAsTemplate).toBe(false)
        })

        it('should throw "project not found" for non-existent project', async () => {
            await expect(
                projectService.shareProjectAsTemplate({
                    userId,
                    projectId: 'non-existent',
                    isSharedAsTemplate: true,
                })
            ).rejects.toThrow('project not found')
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            await expect(
                projectService.shareProjectAsTemplate({
                    userId,
                    projectId: otherProject.id,
                    isSharedAsTemplate: true,
                })
            ).rejects.toThrow('project not found')
        })

        it('should throw "project not found" when user is soft-deleted', async () => {
            const deletedUser = await createSoftDeletedUser()
            const deletedUserProject = await createProject(deletedUser.id)

            await expect(
                projectService.shareProjectAsTemplate({
                    userId: deletedUser.id,
                    projectId: deletedUserProject.id,
                    isSharedAsTemplate: true,
                })
            ).rejects.toThrow('project not found')
        })

        it('should persist isSharedAsTemplate flag in database', async () => {
            await projectService.shareProjectAsTemplate({
                userId,
                projectId,
                isSharedAsTemplate: true,
            })

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isSharedAsTemplate).toBe(true)
        })
    })

    describe('toggleStarProject', () => {
        it('should star a project (set isStarred to true)', async () => {
            const result = await projectService.toggleStarProject({
                userId,
                projectId,
                isStarred: true,
            })

            expect(result.message).toBe('project isStarred state updated')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isStarred).toBe(true)
        })

        it('should unstar a project (set isStarred to false)', async () => {
            await prisma.project.update({ where: { id: projectId }, data: { isStarred: true } })

            const result = await projectService.toggleStarProject({
                userId,
                projectId,
                isStarred: false,
            })

            expect(result.message).toBe('project isStarred state updated')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isStarred).toBe(false)
        })

        it('should throw "project not found" for non-existent project', async () => {
            await expect(
                projectService.toggleStarProject({
                    userId,
                    projectId: 'non-existent',
                    isStarred: true,
                })
            ).rejects.toThrow('project not found')
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            await expect(
                projectService.toggleStarProject({
                    userId,
                    projectId: otherProject.id,
                    isStarred: true,
                })
            ).rejects.toThrow('project not found')
        })

        it('should throw "project not found" when user is soft-deleted', async () => {
            const deletedUser = await createSoftDeletedUser()
            const deletedUserProject = await createProject(deletedUser.id)

            await expect(
                projectService.toggleStarProject({
                    userId: deletedUser.id,
                    projectId: deletedUserProject.id,
                    isStarred: true,
                })
            ).rejects.toThrow('project not found')
        })

        it('should persist isStarred=true in the database', async () => {
            await projectService.toggleStarProject({ userId, projectId, isStarred: true })

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isStarred).toBe(true)
        })

        it('should persist isStarred=false after toggling back', async () => {
            await projectService.toggleStarProject({ userId, projectId, isStarred: true })
            await projectService.toggleStarProject({ userId, projectId, isStarred: false })

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.isStarred).toBe(false)
        })
    })

    describe('downloadProjectVersion', () => {
        it('should throw "project version not found" when project has no versions', async () => {
            await expect(
                projectService.downloadProjectVersion({ userId, projectId })
            ).rejects.toThrow('project version not found')
        })

        it('should throw "user not found" for non-existent user', async () => {
            await expect(
                projectService.downloadProjectVersion({ userId: 'bad-user', projectId })
            ).rejects.toThrow('user not found')
        })

        it('should throw "project not found" for non-existent project', async () => {
            await expect(
                projectService.downloadProjectVersion({ userId, projectId: 'bad-project' })
            ).rejects.toThrow('project not found')
        })
    })
})
