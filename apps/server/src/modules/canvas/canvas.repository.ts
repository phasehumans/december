import { prisma } from '@december/database'

async function findSessionAccess(data: { sessionId: string; userId: string }) {
    const { sessionId, userId } = data
    return prisma.session.findFirst({
        where: {
            id: sessionId,
            OR: [{ userId }, { collaborators: { some: { userId } } }],
        },
        select: {
            id: true,
        },
    })
}

export const canvasRepository = {
    findSessionAccess,
}
