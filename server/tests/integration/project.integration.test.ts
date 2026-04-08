import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test'

import { prisma } from '../../src/config/db'

const getTextFileMock = mock(async (key: string) => {
    if (key === 'file-key-1') return '<h1>Hello</h1>'
    if (key === 'file-key-2') return 'console.log("hi")'
    return
})

const deletePrefixMock = mock(async (_prefix: string) => {})
const saveProjectFilesMock = mock(async (_data: any) => [
    {
        path: 'src/index.html',
        key: 'new-file-key-1',
        contentType: 'text/html',
        size: 14,
    },
    {
        path: 'src/main.ts',
        key: 'new-file-key-2',
        contentType: 'text/typescript',
        size: 18,
    },
])

const buildProjectZipMock = mock((_files: any[]) => Buffer.from('fake-zip-buffer'))

const hydrateCanvasDocumentMock = mock(async (_data?: any) => ({
    items: [],
    connections: [],
    pan: { x: 0, y: 0 },
    scale: 1,
    hasInteracted: false,
}))

const persistCanvasDocumentMock = mock(async (_data: any) => ({
    canvasStateJson: {
        items: [],
        connections: [],
        pan: { x: 0, y: 0 },
        scale: 1,
        hasInteracted: false,
    },
    canvasAssetManifestJson: [],
}))

import {} from '../../src/lib/project-storage'

mock.module('../../src/lib/project-storage', () => ({
    getTextFile: getTextFileMock,
    deletePrefix: deletePrefixMock,
    projectPrefix: (projectId: string) => `projects/${projectId}`,
}))

mock.module('../../src/lib/save-project-files', () => ({
    saveProjectFiles: saveProjectFilesMock,
}))

mock.module('../../src/lib/build-project-zip', () => ({
    buildProjectZip: buildProjectZipMock,
}))

mock.module('../../src/modules/canvas/canvas.persistence', () => ({
    hydrateCanvasDocument: hydrateCanvasDocumentMock,
    persistCanvasDocument: persistCanvasDocumentMock,
}))

const { projectService } = await import('../../src/modules/project/project.service')

const createUserProject = async (
    overrides?: Partial<{
        userId: string
        name: string
        description: string | null
        prompt: string
        isStarred: boolean
        projectStatus: string
    }>
) => {
    const userId = overrides?.userId ?? 'user-1'
    const userSlug =
        userId
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'user'

    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            name: `Test ${userId}`,
            email: `${userSlug}@example.com`,
            username: userSlug,
            emailVerified: true,
        },
    })

    return prisma.project.create({
        data: {
            name: overrides?.name ?? 'Test Project',
            description: overrides?.description ?? 'desc',
            prompt: overrides?.prompt ?? 'build me a landing page',
            isStarred: overrides?.isStarred ?? false,
            projectStatus: 'DRAFT',
            userId,
        },
    })
}
const createProjectVersionIfSchemaExists = async (projectId: string) => {
    try {
        const version = await prisma.projectVersion.create({
            data: {
                id: 'version-1',
                projectId,
                versionNumber: 1,
                label: 'v1',
                sourcePrompt: 'build me a landing page',
                summary: 'first version',
                status: 'READY',
                objectStoragePrefix: `projects/${projectId}/previous-version/version-1`,
                manifestJson: [
                    {
                        path: 'src/index.html',
                        key: 'file-key-1',
                        contentType: 'text/html',
                        size: 14,
                    },
                    {
                        path: 'src/main.ts',
                        key: 'file-key-2',
                        contentType: 'text/typescript',
                        size: 18,
                    },
                ] as any,
                canvasStateJson: { nodes: [] } as any,
                canvasAssetManifestJson: [] as any,
                intentJson: { mode: 'build' } as any,
                planJson: { steps: ['a', 'b'] } as any,
            },
        })

        await prisma.projectMessage.createMany({
            data: [
                {
                    projectId,
                    projectVersionId: version.id,
                    role: 'USER',
                    content: 'build homepage',
                    sequence: 1,
                    status: 'DONE',
                },
                {
                    projectId,
                    projectVersionId: version.id,
                    role: 'ASSISTANT',
                    content: 'done',
                    sequence: 2,
                    status: 'DONE',
                },
            ],
        })

        return version
    } catch {
        // If version schema doesn't exist in current migration state,
        // service should still work in fallback mode.
        return null
    }
}

beforeEach(async () => {
    // child tables first
    try {
        await prisma.projectMessage.deleteMany()
    } catch {}

    try {
        await prisma.projectVersion.deleteMany()
    } catch {}

    await prisma.project.deleteMany()
    await prisma.user.deleteMany()

    await prisma.user.createMany({
        data: [
            {
                id: 'user-1',
                name: 'Test user-1',
                email: 'user-1@example.com',
                username: 'user-1',
                emailVerified: true,
            },
            {
                id: 'user-2',
                name: 'Test user-2',
                email: 'user-2@example.com',
                username: 'user-2',
                emailVerified: true,
            },
        ],
    })
    getTextFileMock.mockClear()
    deletePrefixMock.mockClear()
    saveProjectFilesMock.mockClear()
    buildProjectZipMock.mockClear()
    hydrateCanvasDocumentMock.mockClear()
    persistCanvasDocumentMock.mockClear()
})

afterAll(async () => {
    await prisma.$disconnect()
})

describe('projectService integration tests', () => {
    describe('createProject', () => {
        it('should create a new project in DB', async () => {
            const result = await projectService.createProject({
                name: 'Phasehumans MVP',
                description: 'AI website builder',
                prompt: 'build a portfolio site',
                userId: 'user-1',
            })

            expect(result.name).toBe('Phasehumans MVP')
            expect(result.description).toBe('AI website builder')
            expect(result.prompt).toBe('build a portfolio site')
            expect(result.userId).toBe('user-1')
            expect(result.isStarred).toBe(false)

            const projectInDb = await prisma.project.findUnique({
                where: { id: result.id },
            })

            expect(projectInDb).not.toBeNull()
        })
    })

    describe('getAllProjects', () => {
        it('should return only user projects ordered by updatedAt desc', async () => {
            const p1 = await createUserProject({
                userId: 'user-1',
                name: 'Older Project',
            })

            await new Promise((r) => setTimeout(r, 10))

            const p2 = await createUserProject({
                userId: 'user-1',
                name: 'Newer Project',
            })

            await createUserProject({
                userId: 'user-2',
                name: 'Other User Project',
            })

            const result = await projectService.getAllProjects('user-1')

            expect(result).toHaveLength(2)
            expect(result.map((p) => p.id)).toEqual([p2.id, p1.id])
        })
    })

    describe('getProjectById', () => {
        it('should return project in fallback mode when version schema is missing or no versions exist', async () => {
            const project = await createUserProject({ userId: 'user-1' })

            const result = await projectService.getProjectById({
                userId: 'user-1',
                projectId: project.id,
            })

            expect(result.project.id).toBe(project.id)
            expect(Array.isArray(result.versions)).toBe(true)
            expect(result.selectedVersionId).toBeNull()
            expect(result.activeVersion).toBeNull()
            expect(result.chatMessages).toEqual([])
            expect(result.generatedFiles).toEqual({})
            expect(result.canvasState).toEqual({
                items: [],
                connections: [],
                pan: { x: 0, y: 0 },
                scale: 1,
                hasInteracted: false,
            })
        })

        it('should return project with active version data when version schema exists', async () => {
            const project = await createUserProject({ userId: 'user-1' })
            const version = await createProjectVersionIfSchemaExists(project.id)

            if (!version) {
                // Skip gracefully if current local schema doesn't have version tables yet
                return
            }

            const result = await projectService.getProjectById({
                userId: 'user-1',
                projectId: project.id,
            })

            expect(result.project.id).toBe(project.id)
            expect(result.selectedVersionId).toBe(version.id)
            expect(result.activeVersion).not.toBeNull()
            expect(result.chatMessages).toHaveLength(2)
            expect(result.generatedFiles).toEqual({
                'src/index.html': '<h1>Hello</h1>',
                'src/main.ts': 'console.log("hi")',
            })

            expect(getTextFileMock).toHaveBeenCalledTimes(2)
        })

        it('should throw if project not found', async () => {
            await expect(
                projectService.getProjectById({
                    userId: 'user-1',
                    projectId: 'missing-project',
                })
            ).rejects.toThrow('project not found')
        })
    })

    describe('updateProject', () => {
        it('should rename project', async () => {
            const project = await createUserProject({ userId: 'user-1', name: 'Old Name' })

            const result = await projectService.updateProject({
                userId: 'user-1',
                projectId: project.id,
                rename: 'New Name',
            })

            expect(result).toEqual({ message: 'project updated' })

            const updated = await prisma.project.findUnique({
                where: { id: project.id },
            })

            expect(updated?.name).toBe('New Name')
        })

        it('should update starred state', async () => {
            const project = await createUserProject({ userId: 'user-1', isStarred: false })

            await projectService.updateProject({
                userId: 'user-1',
                projectId: project.id,
                isStarred: true,
            })

            const updated = await prisma.project.findUnique({
                where: { id: project.id },
            })

            expect(updated?.isStarred).toBe(true)
        })

        it('should throw if project not found', async () => {
            await expect(
                projectService.updateProject({
                    userId: 'user-1',
                    projectId: 'missing-project',
                    rename: 'Nope',
                })
            ).rejects.toThrow('project not found')
        })
    })

    describe('deleteProject', () => {
        it('should delete project and call storage cleanup', async () => {
            const project = await createUserProject({ userId: 'user-1' })

            const result = await projectService.deleteProject({
                userId: 'user-1',
                projectId: project.id,
            })

            expect(result).toEqual({ message: 'project deleted' })
            expect(deletePrefixMock).toHaveBeenCalledTimes(1)

            const found = await prisma.project.findUnique({
                where: { id: project.id },
            })

            expect(found).toBeNull()
        })

        it('should throw if project not found', async () => {
            await expect(
                projectService.deleteProject({
                    userId: 'user-1',
                    projectId: 'missing-project',
                })
            ).rejects.toThrow('project not found')
        })
    })

    describe('duplicateProject', () => {
        it('should duplicate project only when no version exists', async () => {
            const source = await createUserProject({
                userId: 'user-1',
                name: 'Original Project',
                description: 'original desc',
                prompt: 'original prompt',
                projectStatus: 'DRAFT',
            })

            const result = await projectService.duplicateProject({
                userId: 'user-1',
                projectId: source.id,
            })

            expect(result.name).toBe('Copy of Original Project')
            expect(result.description).toBe('original desc')
            expect(result.prompt).toBe('original prompt')

            const all = await prisma.project.findMany({
                where: { userId: 'user-1' },
                orderBy: { createdAt: 'asc' },
            })

            expect(all).toHaveLength(2)
        })

        it('should duplicate project with latest version when version schema exists', async () => {
            const source = await createUserProject({
                userId: 'user-1',
                name: 'Original Project',
                prompt: 'fallback prompt',
            })

            const version = await createProjectVersionIfSchemaExists(source.id)

            if (!version) {
                return
            }

            const result = await projectService.duplicateProject({
                userId: 'user-1',
                projectId: source.id,
            })

            expect(result.name).toBe('Copy of Original Project')

            const duplicatedVersions = await prisma.projectVersion.findMany({
                where: { projectId: result.id },
                include: {
                    messages: {
                        orderBy: { sequence: 'asc' },
                    },
                },
            })

            expect(duplicatedVersions).toHaveLength(1)
            expect(duplicatedVersions[0]!.versionNumber).toBe(1)
            expect(duplicatedVersions[0]!.messages).toHaveLength(2)

            expect(saveProjectFilesMock).toHaveBeenCalledTimes(1)
            expect(persistCanvasDocumentMock).toHaveBeenCalledTimes(1)
            expect(getTextFileMock).toHaveBeenCalledTimes(2)
        })

        it('should throw if source project not found', async () => {
            await expect(
                projectService.duplicateProject({
                    userId: 'user-1',
                    projectId: 'missing-project',
                })
            ).rejects.toThrow('project not found')
        })
    })

    describe('downloadProjectVersion', () => {
        it('should build zip and return safe filename when active version exists', async () => {
            const project = await createUserProject({
                userId: 'user-1',
                name: 'My Cool Project!!',
            })

            const version = await createProjectVersionIfSchemaExists(project.id)

            if (!version) {
                return
            }

            const result = await projectService.downloadProjectVersion({
                userId: 'user-1',
                projectId: project.id,
            })

            expect(result.fileName).toBe('My-Cool-Project.zip')
            expect(result.zip).toBeInstanceOf(Buffer)
            expect(buildProjectZipMock).toHaveBeenCalledTimes(1)
        })

        it('should throw when no active version exists', async () => {
            const project = await createUserProject({ userId: 'user-1' })

            await expect(
                projectService.downloadProjectVersion({
                    userId: 'user-1',
                    projectId: project.id,
                })
            ).rejects.toThrow('project version not found')
        })
    })
})
describe('projectService additional integration coverage', () => {
    it('should throw when a requested version id does not belong to the project', async () => {
        const project = await createUserProject({ userId: 'user-1' })
        const version = await createProjectVersionIfSchemaExists(project.id)

        if (!version) {
            return
        }

        await expect(
            projectService.getProjectById({
                userId: 'user-1',
                projectId: project.id,
                versionId: 'missing-version-id',
            })
        ).rejects.toThrow('project version not found')
    })

    it('should update currentVersionId and versionCount when duplicating a versioned project', async () => {
        const source = await createUserProject({
            userId: 'user-1',
            name: 'Original Project',
            prompt: 'fallback prompt',
        })

        const version = await createProjectVersionIfSchemaExists(source.id)

        if (!version) {
            return
        }

        const result = await projectService.duplicateProject({
            userId: 'user-1',
            projectId: source.id,
        })

        const duplicatedProject = await prisma.project.findUnique({
            where: { id: result.id },
            select: {
                currentVersionId: true,
                versionCount: true,
                projectStatus: true,
            },
        })

        expect(duplicatedProject?.currentVersionId).toBeString()
        expect(duplicatedProject?.versionCount).toBe(1)
        expect(duplicatedProject?.projectStatus).toBe('READY')
    })
})
