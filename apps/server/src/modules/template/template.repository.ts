import { prisma } from '@december/database'

const TEMPLATE_SELECT = {
    id: true,
    name: true,
    description: true,
    prompt: true,
    isFeatured: true,
    isSharedAsTemplate: true,
    projectCategory: true,
    createdAt: true,
    updatedAt: true,
    userId: true,
    previewImageKey: true,
    user: {
        select: {
            name: true,
            username: true,
        },
    },
    likes: {
        select: {
            userId: true,
            isLiked: true,
        },
    },
}

export const templateRepository = {
    async findManyTemplates() {
        return prisma.project.findMany({
            where: {
                isSharedAsTemplate: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
            select: TEMPLATE_SELECT,
        })
    },

    async findTemplateById(data: { templateId: string }) {
        const { templateId } = data
        return prisma.project.findFirst({
            where: {
                id: templateId,
                isSharedAsTemplate: true,
            },
            select: TEMPLATE_SELECT,
        })
    },

    async findFeaturedTemplates() {
        return prisma.project.findMany({
            where: {
                isSharedAsTemplate: true,
                isFeatured: true,
            },
            orderBy: {
                updatedAt: 'desc',
            },
            select: TEMPLATE_SELECT,
        })
    },

    async findProjectForRemix(data: { templateId: string }) {
        const { templateId } = data
        return prisma.project.findUnique({
            where: {
                id: templateId,
            },
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                isSharedAsTemplate: true,
                projectStatus: true,
                currentVersionId: true,
            },
        })
    },

    async findLatestProjectVersion(data: { projectId: string }) {
        const { projectId } = data
        return prisma.projectVersion.findFirst({
            where: {
                projectId,
            },
            orderBy: {
                versionNumber: 'desc',
            },
            select: {
                id: true,
                sourcePrompt: true,
            },
        })
    },

    async createRemixedProject(data: {
        name: string
        description: string | null
        prompt: string
        projectStatus: any
        userId: string
    }) {
        const { name, description, prompt, projectStatus, userId } = data
        return prisma.project.create({
            data: {
                name,
                description,
                prompt,
                projectStatus,
                userId,
            },
            select: {
                id: true,
                name: true,
                description: true,
                prompt: true,
                isStarred: true,
                isSharedAsTemplate: true,
                projectStatus: true,
                versionCount: true,
                currentVersionId: true,
                createdAt: true,
                updatedAt: true,
                userId: true,
            },
        })
    },

    async deleteProject(data: { id: string }) {
        const { id } = data
        return prisma.project.delete({
            where: { id },
        })
    },

    async findUserForLike(data: { userId: string }) {
        const { userId } = data
        return prisma.user.findUnique({
            where: { id: userId },
            select: {
                name: true,
            },
        })
    },

    async findProjectForLike(data: { templateId: string }) {
        const { templateId } = data
        return prisma.project.findFirst({
            where: {
                id: templateId,
                isSharedAsTemplate: true,
            },
        })
    },

    async findProjectLike(data: { userId: string; templateId: string }) {
        const { userId, templateId } = data
        return prisma.projectLike.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId: templateId,
                },
            },
        })
    },

    async updateProjectLike(data: { userId: string; templateId: string; isLiked: boolean }) {
        const { userId, templateId, isLiked } = data
        return prisma.projectLike.update({
            where: {
                userId_projectId: {
                    userId,
                    projectId: templateId,
                },
            },
            data: {
                isLiked,
            },
        })
    },

    async createProjectLike(data: { userId: string; templateId: string; isLiked: boolean }) {
        const { userId, templateId, isLiked } = data
        return prisma.projectLike.create({
            data: {
                projectId: templateId,
                userId,
                isLiked,
            },
        })
    },

    async findTemplatePreviewImage(data: { templateId: string }) {
        const { templateId } = data
        return prisma.project.findFirst({
            where: {
                id: templateId,
                isSharedAsTemplate: true,
            },
            select: {
                id: true,
                previewImageKey: true,
            },
        })
    },
}
