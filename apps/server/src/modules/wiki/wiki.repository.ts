import { prisma, type WikiStatus } from '@december/database'

export async function findWikiByRepo(userId: string, repoFullName: string) {
    return prisma.repositoryWiki.findUnique({
        where: {
            userId_repoFullName: {
                userId,
                repoFullName,
            },
        },
        include: {
            pages: {
                orderBy: { order: 'asc' },
            },
        },
    })
}

export async function findWikiById(userId: string, wikiId: string) {
    const wiki = await prisma.repositoryWiki.findUnique({
        where: { id: wikiId },
        include: {
            pages: {
                orderBy: { order: 'asc' },
            },
        },
    })
    if (!wiki || wiki.userId !== userId) {
        return null
    }
    return wiki
}

export async function findWikisByUser(userId: string) {
    return prisma.repositoryWiki.findMany({
        where: { userId },
        include: {
            pages: {
                orderBy: { order: 'asc' },
            },
        },
    })
}

export async function upsertRepositoryWiki(
    userId: string,
    repoOwner: string,
    repoName: string,
    status: WikiStatus = 'IDLE'
) {
    const repoFullName = `${repoOwner}/${repoName}`
    return prisma.repositoryWiki.upsert({
        where: {
            userId_repoFullName: {
                userId,
                repoFullName,
            },
        },
        create: {
            userId,
            repoFullName,
            repoOwner,
            repoName,
            status,
        },
        update: {
            status,
        },
        include: {
            pages: {
                orderBy: { order: 'asc' },
            },
        },
    })
}

export async function updateWikiStatus(wikiId: string, status: WikiStatus) {
    return prisma.repositoryWiki.update({
        where: { id: wikiId },
        data: { status },
    })
}

export async function toggleWikiPin(
    userId: string,
    repoOwner: string,
    repoName: string,
    isPinned?: boolean
) {
    const repoFullName = `${repoOwner}/${repoName}`
    const existing = await prisma.repositoryWiki.findFirst({
        where: {
            userId,
            repoFullName: { equals: repoFullName, mode: 'insensitive' },
        },
    })

    const targetFullName = existing ? existing.repoFullName : repoFullName
    const newPinned = isPinned !== undefined ? isPinned : !existing?.isPinned

    return prisma.repositoryWiki.upsert({
        where: {
            userId_repoFullName: {
                userId,
                repoFullName: targetFullName,
            },
        },
        create: {
            userId,
            repoFullName: targetFullName,
            repoOwner,
            repoName,
            status: 'IDLE',
            isPinned: newPinned,
        },
        update: {
            isPinned: newPinned,
        },
    })
}

export async function findPageById(pageId: string) {
    return prisma.wikiPage.findUnique({
        where: { id: pageId },
        include: { wiki: true },
    })
}

export async function findPageBySlug(wikiId: string, slug: string) {
    return prisma.wikiPage.findUnique({
        where: {
            wikiId_slug: {
                wikiId,
                slug,
            },
        },
    })
}

export async function createWikiPage(data: {
    wikiId: string
    title: string
    slug: string
    content: string
    order?: number
}) {
    return prisma.wikiPage.create({
        data: {
            wikiId: data.wikiId,
            title: data.title,
            slug: data.slug,
            content: data.content,
            order: data.order ?? 0,
        },
    })
}

export async function updateWikiPage(
    pageId: string,
    data: {
        title?: string
        slug?: string
        content?: string
        order?: number
    }
) {
    return prisma.wikiPage.update({
        where: { id: pageId },
        data,
    })
}

export async function deleteWikiPage(pageId: string) {
    return prisma.wikiPage.delete({
        where: { id: pageId },
    })
}

export const wikiRepository = {
    findWikiByRepo,
    findWikiById,
    findWikisByUser,
    upsertRepositoryWiki,
    updateWikiStatus,
    toggleWikiPin,
    findPageById,
    findPageBySlug,
    createWikiPage,
    updateWikiPage,
    deleteWikiPage,
}
