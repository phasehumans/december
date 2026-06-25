import { prisma } from '@december/database'

async function findProjectAccess(data: { projectId: string; userId: string }) {
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
}

async function findProjectById(projectId: string) {
    return prisma.project.findUnique({
        where: { id: projectId },
        select: { currentVersionId: true },
    })
}

async function updateProjectVersion(data: {
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
}

export const canvasRepository = {
    findProjectAccess,
    findProjectById,
    updateProjectVersion,
}
