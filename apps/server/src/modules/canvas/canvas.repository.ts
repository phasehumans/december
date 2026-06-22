import { prisma } from '@december/database'

export const canvasRepository = {
    async findProjectAccess(data: { projectId: string; userId: string }) {
        const { projectId, userId } = data
        return prisma.project.findFirst({
            where: {
                id: projectId,
                userId,
            },
            select: {
                id: true,
            },
        })
    },

    async findProjectById(projectId: string) {
        return prisma.project.findUnique({
            where: { id: projectId },
            select: { currentVersionId: true },
        })
    },

    async updateProjectVersion(data: {
        versionId: string
        canvasStateJson: any
        canvasAssetManifestJson: any
    }) {
        const { versionId, canvasStateJson, canvasAssetManifestJson } = data
        return prisma.projectVersion.update({
            where: { id: versionId },
            data: {
                canvasStateJson,
                canvasAssetManifestJson,
            },
        })
    },
}
