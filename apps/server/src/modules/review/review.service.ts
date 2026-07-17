import { prisma } from '@december/database'

import type { CreateReviewDto } from './review.schema'

export async function createReview(userId: string, data: CreateReviewDto) {
    // Validate session ownership
    const session = await prisma.session.findUnique({ where: { id: data.sessionId } })
    if (!session || session.userId !== userId) {
        throw new Error('Unauthorized or session not found')
    }

    return prisma.reviewComment.create({
        data: {
            sessionId: data.sessionId,
            content: data.content,
            prUrl: data.prUrl,
            githubCommentId: data.githubCommentId,
        },
    })
}

export async function getReviewsForSession(userId: string, sessionId: string) {
    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId) {
        throw new Error('Unauthorized or session not found')
    }

    return prisma.reviewComment.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
    })
}
