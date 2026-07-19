import { prisma } from '@december/database'

export const runtimeRepository = {
    async updateSessionPreviewImage(data: { sessionId: string; key: string }) {
        // no previewimagekey field in session schema, we just keep the image in s3
    },

    async findSessionForPreview(data: { sessionId: string; userId: string }) {
        const { sessionId, userId } = data
        return prisma.session.findFirst({
            where: {
                id: sessionId,
                OR: [
                    { userId },
                    { collaborators: { some: { userId } } },
                ],
            },
            select: {
                id: true,
                githubRepoUrl: true,
            },
        })
    },

    async findSessionImport(data: { sessionId: string }) {
        const { sessionId } = data
        return prisma.sessionImport.findFirst({
            where: { sessionId },
        })
    },

    async findSessionForStatus(data: { previewId: string; userId: string }) {
        const { previewId, userId } = data
        return prisma.session.findFirst({
            where: {
                id: previewId,
                OR: [
                    { userId },
                    { collaborators: { some: { userId } } },
                ],
            },
            select: {
                id: true,
            },
        })
    },

    async findSessionForDelete(data: { previewId: string; userId: string }) {
        const { previewId, userId } = data
        return prisma.session.findFirst({
            where: {
                id: previewId,
                OR: [
                    { userId },
                    { collaborators: { some: { userId } } },
                ],
            },
            select: {
                id: true,
            },
        })
    },
}
