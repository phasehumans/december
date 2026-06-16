import { describe, it, expect, beforeEach, afterAll } from 'bun:test'

import { prisma } from '@december/database'
import { projectService } from '../../../src/modules/project/project.service'
import { parseStoredProjectFiles } from '../../../src/modules/project/project.utils'
import { putTextFile } from '../../../src/shared/project-storage'

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

            const result = await projectService.getAllProjects({ userId })

            expect(Array.isArray(result)).toBe(true)
            expect(result.length).toBe(2)
            const names = result.map((p) => p.name)
            expect(names).toContain('Test Project')
            expect(names).toContain('Second Project')
        })

        it('should return an empty array when user has no projects', async () => {
            await prisma.project.deleteMany({ where: { userId } })

            const result = await projectService.getAllProjects({ userId })

            expect(result).toEqual([])
        })

        it('should only return projects belonging to the requesting user', async () => {
            const otherUser = await createUser()
            await createProject(otherUser.id, { name: 'Other User Project' })

            const result = await projectService.getAllProjects({ userId })

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

        it('should throw "project not found" for non-existent projectId', async () => {
            let threw = false
            try {
                await projectService.getProjectById({ userId, projectId: 'bad-project' })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when projectId belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.getProjectById({ userId, projectId: otherProject.id })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it('should throw "project version not found" for invalid versionId', async () => {
            await createProjectVersion(projectId)

            let threw = false
            try {
                await projectService.getProjectById({
                    userId,
                    projectId,
                    versionId: '00000000-0000-0000-0000-000000000000',
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project version not found')
            }
            expect(threw).toBe(true)
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

        it('should throw "project not found" when projectId does not exist', async () => {
            let threw = false
            try {
                await projectService.renameProject({
                    projectId: 'non-existent-project',
                    userId,
                    rename: 'New Name',
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.renameProject({
                    projectId: otherProject.id,
                    userId,
                    rename: 'Hijack Name',
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
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

        it('should throw "project not found" for non-existent project', async () => {
            let threw = false
            try {
                await projectService.deleteProject({ userId, projectId: 'non-existent' })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.deleteProject({ userId, projectId: otherProject.id })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
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
            let threw = false
            try {
                await projectService.duplicateProject({ userId, projectId: 'bad-project' })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.duplicateProject({ userId, projectId: otherProject.id })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
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

        it('should duplicate a project with a version and copy files', async () => {
            const version = await createProjectVersion(projectId)
            // Update original project's currentVersionId
            await prisma.project.update({
                where: { id: projectId },
                data: { currentVersionId: version.id },
            })

            // Write mock files in S3/MinIO
            await putTextFile({ key: 'file-1', content: 'console.log("hello")' })
            await putTextFile({ key: 'file-2', content: 'console.log("world")' })

            const result = await projectService.duplicateProject({ userId, projectId })

            expect(result.id).toBeTruthy()
            expect(result.id).not.toBe(projectId)
            expect(result.name).toBe('Copy of Test Project')
            expect(result.projectStatus).toBe('READY') // since latest version exists
            expect(result.currentVersionId).not.toBeNull()
            expect(result.currentVersionId).not.toBe(version.id)
            expect(result.versionCount).toBe(1)

            // Verify version is duplicated in database
            const newVersion = await prisma.projectVersion.findFirst({
                where: { projectId: result.id },
            })
            expect(newVersion).not.toBeNull()
            expect(newVersion!.versionNumber).toBe(1)
            expect(newVersion!.sourcePrompt).toBe('Build a landing page')

            const newManifest = parseStoredProjectFiles(newVersion!.manifestJson)
            expect(newManifest.length).toBe(2)
            expect(newManifest[0]!.path).toBe('src/index.ts')
            expect(newManifest[0]!.key).not.toBe('file-1')
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
            let threw = false
            try {
                await projectService.shareProjectAsTemplate({
                    userId,
                    projectId: 'non-existent',
                    isSharedAsTemplate: true,
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.shareProjectAsTemplate({
                    userId,
                    projectId: otherProject.id,
                    isSharedAsTemplate: true,
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
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
            let threw = false
            try {
                await projectService.toggleStarProject({
                    userId,
                    projectId: 'non-existent',
                    isStarred: true,
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.toggleStarProject({
                    userId,
                    projectId: otherProject.id,
                    isStarred: true,
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
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

    describe('updateGeneralSettings', () => {
        it('should update name, description, and status successfully', async () => {
            const result = await projectService.updateGeneralSettings({
                projectId,
                userId,
                name: 'Completely New Name',
                description: 'Completely new description of project',
                isStarred: true,
                isSharedAsTemplate: true,
                projectCategory: 'PORTFOLIO_BLOG',
            })

            expect(result.message).toBe('project general settings updated')

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.name).toBe('Completely New Name')
            expect(db!.description).toBe('Completely new description of project')
            expect(db!.isStarred).toBe(true)
            expect(db!.isSharedAsTemplate).toBe(true)
            expect(db!.projectCategory).toBe('PORTFOLIO_BLOG')
        })

        it('should partial update name only and leave description intact', async () => {
            const originalProject = await prisma.project.findUnique({ where: { id: projectId } })
            const originalDesc = originalProject!.description

            await projectService.updateGeneralSettings({
                projectId,
                userId,
                name: 'Partial Rename',
            })

            const db = await prisma.project.findUnique({ where: { id: projectId } })
            expect(db!.name).toBe('Partial Rename')
            expect(db!.description).toBe(originalDesc)
        })

        it('should throw "project not found" for non-existent project', async () => {
            let threw = false
            try {
                await projectService.updateGeneralSettings({
                    projectId: 'non-existent-id',
                    userId,
                    name: 'Attempt',
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })

        it("should throw 'project not found' when project belongs to another user", async () => {
            const otherUser = await createUser()
            const otherProject = await createProject(otherUser.id)

            let threw = false
            try {
                await projectService.updateGeneralSettings({
                    projectId: otherProject.id,
                    userId,
                    name: 'Attempt Hijack',
                })
            } catch (err: any) {
                threw = true
                expect(err.message).toBe('project not found')
            }
            expect(threw).toBe(true)
        })
    })
})
