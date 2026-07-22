import { prisma } from '@december/database'
import type { Prisma } from '@december/database'

export async function createReview(data: Prisma.PullRequestReviewUncheckedCreateInput) {
    return prisma.pullRequestReview.create({ data })
}

export async function findReviewsByUserId(
    userId: string,
    filters?: {
        repository?: string
        status?: string
        isAutoReview?: boolean
        search?: string
        page?: number
        limit?: number
    }
) {
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const skip = (page - 1) * limit

    const where: Prisma.PullRequestReviewWhereInput = {
        userId,
        ...(filters?.repository && filters.repository !== 'ALL'
            ? { repository: { contains: filters.repository, mode: 'insensitive' } }
            : {}),
        ...(filters?.status && filters.status !== 'ALL' ? { status: filters.status as any } : {}),
        ...(typeof filters?.isAutoReview === 'boolean'
            ? { isAutoReview: filters.isAutoReview }
            : {}),
        ...(filters?.search
            ? {
                  OR: [
                      { title: { contains: filters.search, mode: 'insensitive' } },
                      { repository: { contains: filters.search, mode: 'insensitive' } },
                      { author: { contains: filters.search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    }

    const [reviews, total] = await Promise.all([
        prisma.pullRequestReview.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.pullRequestReview.count({ where }),
    ])

    return {
        reviews,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    }
}

export async function findReviewById(id: string, userId: string) {
    return prisma.pullRequestReview.findFirst({
        where: { id, userId },
    })
}

export async function updateReview(id: string, data: Prisma.PullRequestReviewUpdateInput) {
    return prisma.pullRequestReview.update({
        where: { id },
        data,
    })
}

export async function deleteReview(id: string, userId: string) {
    const review = await prisma.pullRequestReview.findFirst({ where: { id, userId } })
    if (!review) return null
    return prisma.pullRequestReview.delete({ where: { id } })
}

export async function findPreferencesByUserId(userId: string) {
    return prisma.reviewPreference.findUnique({
        where: { userId },
    })
}

export async function upsertPreferences(
    userId: string,
    data: {
        autoReviewAgentPrs?: boolean
        defaultStrictness?: 'LENIENT' | 'STANDARD' | 'STRICT'
        focusAreas?: string[]
    }
) {
    return prisma.reviewPreference.upsert({
        where: { userId },
        create: {
            userId,
            autoReviewAgentPrs: data.autoReviewAgentPrs ?? true,
            defaultStrictness: data.defaultStrictness || 'STANDARD',
            focusAreas: data.focusAreas || ['SECURITY', 'PERFORMANCE', 'CLEAN_CODE'],
        },
        update: {
            ...(typeof data.autoReviewAgentPrs === 'boolean'
                ? { autoReviewAgentPrs: data.autoReviewAgentPrs }
                : {}),
            ...(data.defaultStrictness ? { defaultStrictness: data.defaultStrictness } : {}),
            ...(data.focusAreas ? { focusAreas: data.focusAreas } : {}),
        },
    })
}
