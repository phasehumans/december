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

export const waitlistRepository = {
    findEntry,
    findUserOnboarding,
    ensureEntry,
    setJoinedAtIfEmpty,
    setPopupSeenAtIfEmpty,
}
