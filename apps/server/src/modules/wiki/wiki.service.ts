import { prisma } from '@december/database'

import type { CreateWikiDto, UpdateWikiDto } from './wiki.schema'

export async function createWikiPage(userId: string, data: CreateWikiDto) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId } })
    if (!project || project.userId !== userId) {
        throw new Error('Unauthorized or project not found')
    }

    const existing = await prisma.wikiPage.findUnique({
        where: {
            projectId_title: {
                projectId: data.projectId,
                title: data.title,
            },
        },
    })

    if (existing) {
        throw new Error('Title already exists in this project')
    }

    return prisma.wikiPage.create({
        data: {
            projectId: data.projectId,
            title: data.title,
            content: data.content,
        },
    })
}

export async function getWikiPages(userId: string, projectId: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project || project.userId !== userId) {
        throw new Error('Unauthorized or project not found')
    }

    return prisma.wikiPage.findMany({
        where: { projectId },
        orderBy: { title: 'asc' },
    })
}

export async function getWikiPage(userId: string, id: string) {
    const page = await prisma.wikiPage.findUnique({
        where: { id },
        include: { project: true },
    })

    if (!page || page.project.userId !== userId) {
        throw new Error('Unauthorized or page not found')
    }

    return page
}

export async function updateWikiPage(userId: string, id: string, data: UpdateWikiDto) {
    const page = await prisma.wikiPage.findUnique({
        where: { id },
        include: { project: true },
    })

    if (!page || page.project.userId !== userId) {
        throw new Error('Unauthorized or page not found')
    }

    if (data.title && data.title !== page.title) {
        const existing = await prisma.wikiPage.findUnique({
            where: {
                projectId_title: {
                    projectId: page.projectId,
                    title: data.title,
                },
            },
        })
        if (existing) throw new Error('Title already exists in this project')
    }

    return prisma.wikiPage.update({
        where: { id },
        data,
    })
}

export async function deleteWikiPage(userId: string, id: string) {
    const page = await prisma.wikiPage.findUnique({
        where: { id },
        include: { project: true },
    })

    if (!page || page.project.userId !== userId) {
        throw new Error('Unauthorized or page not found')
    }

    return prisma.wikiPage.delete({ where: { id } })
}
