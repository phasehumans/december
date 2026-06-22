import { prisma } from '@december/database'

export const runtimeRepository = {
    async updateProjectPreviewImage(data: { projectId: string; key: string }) {
        const { projectId, key } = data
        return prisma.project.update({
            where: { id: projectId },
            data: { previewImageKey: key },
        })
    },

    async findProjectForPreview(data: { projectId: string; userId: string }) {
        const { projectId, userId } = data
        return prisma.project.findFirst({
            where: {
                id: projectId,
                userId,
            },
            select: {
                id: true,
                currentVersionId: true,
                githubRepoUrl: true,
            },
        })
    },

    async findProjectVersion(data: { projectId: string; versionId?: string }) {
        const { projectId, versionId } = data
        return prisma.projectVersion.findFirst({
            where: {
                projectId,
                id: versionId || undefined,
            },
            orderBy: versionId
                ? undefined
                : {
                      versionNumber: 'desc',
                  },
        })
    },

    async findProjectImport(data: { projectId: string }) {
        const { projectId } = data
        return prisma.projectImport.findFirst({
            where: { projectId },
        })
    },

    async findProjectForStatus(data: { previewId: string; userId: string }) {
        const { previewId, userId } = data
        return prisma.project.findFirst({
            where: {
                id: previewId,
                userId,
            },
            select: {
                id: true,
                currentVersionId: true,
            },
        })
    },

    async findProjectForDelete(data: { previewId: string; userId: string }) {
        const { previewId, userId } = data
        return prisma.project.findFirst({
            where: {
                id: previewId,
                userId,
            },
            select: {
                id: true,
            },
        })
    },
}
