import { prisma } from '@december/database'

async function findEntry(data: { userId: string; feature: string }) {
    const { userId, feature } = data
    return prisma.featureWaitlist.findUnique({
        where: { userId_feature: { userId, feature } },
        select: { joinedAt: true, popupSeenAt: true },
    })
}

async function findUserOnboarding(userId: string) {
    return prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingCompletedAt: true },
    })
}

async function ensureEntry(data: { userId: string; feature: string }) {
    const { userId, feature } = data
    return prisma.featureWaitlist.upsert({
        where: { userId_feature: { userId, feature } },
        create: { userId, feature },
        update: {},
        select: { id: true, joinedAt: true, popupSeenAt: true },
    })
}

async function setJoinedAtIfEmpty(data: { userId: string; feature: string; at: Date }) {
    const { userId, feature, at } = data
    return prisma.featureWaitlist.updateMany({
        where: { userId, feature, joinedAt: null },
        data: { joinedAt: at },
    })
}

async function setPopupSeenAtIfEmpty(data: { userId: string; feature: string; at: Date }) {
    const { userId, feature, at } = data
    return prisma.featureWaitlist.updateMany({
        where: { userId, feature, popupSeenAt: null },
        data: { popupSeenAt: at },
    })
}

// on the list = joined, and the account is not deleted (deleted accounts keep their email)
const joinedWhere = (feature: string) => ({
    feature,
    joinedAt: { not: null },
    user: { isDeleted: false },
})

async function findJoinedEntries(data: { feature: string; limit: number }) {
    const { feature, limit } = data
    return prisma.featureWaitlist.findMany({
        where: joinedWhere(feature),
        orderBy: { joinedAt: 'desc' },
        take: limit,
        select: {
            userId: true,
            joinedAt: true,
            notifiedAt: true,
            user: { select: { name: true, email: true } },
        },
    })
}

async function countEntries(data: { feature: string }) {
    const { feature } = data
    const [joinedCount, notifiedCount] = await Promise.all([
        prisma.featureWaitlist.count({ where: { ...joinedWhere(feature) } }),
        prisma.featureWaitlist.count({
            where: { ...joinedWhere(feature), notifiedAt: { not: null } },
        }),
    ])
    return { joinedCount, notifiedCount }
}

async function findUnnotifiedEntries(data: { feature: string }) {
    const { feature } = data
    return prisma.featureWaitlist.findMany({
        where: { ...joinedWhere(feature), notifiedAt: null },
        orderBy: { joinedAt: 'asc' },
        select: { id: true, userId: true, user: { select: { name: true, email: true } } },
    })
}

/** true when this call set notifiedAt, so a second launch running at once skips the row */
async function claimNotify(data: { id: string; at: Date }) {
    const { id, at } = data
    const result = await prisma.featureWaitlist.updateMany({
        where: { id, notifiedAt: null },
        data: { notifiedAt: at },
    })
    return result.count === 1
}

async function releaseNotify(data: { id: string }) {
    const { id } = data
    return prisma.featureWaitlist.update({ where: { id }, data: { notifiedAt: null } })
}

export const waitlistRepository = {
    findEntry,
    findUserOnboarding,
    ensureEntry,
    setJoinedAtIfEmpty,
    setPopupSeenAtIfEmpty,
    findJoinedEntries,
    countEntries,
    findUnnotifiedEntries,
    claimNotify,
    releaseNotify,
}
