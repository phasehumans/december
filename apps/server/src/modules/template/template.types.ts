export type GetAllTemplates = {
    userId?: string
}

export type GetTemplateById = {
    templateId: string
    userId?: string
}

export type GetFeaturedTemplates = {
    userId?: string
}

export type RemixTemplate = {
    userId: string
    templateId: string
    name?: string
}

export type ToggleLike = {
    userId: string
    templateId: string
    isLiked: boolean
}

export type GetTemplatePreviewImage = {
    templateId: string
}

export type TemplateWithLikeMeta = {
    id: string
    name: string
    description: string | null
    prompt: string
    isFeatured: boolean
    isSharedAsTemplate: boolean
    projectCategory: string
    createdAt: Date
    updatedAt: Date
    userId: string
    authorName: string
    authorUsername: string
    likeCount: number
    isLiked: boolean
    previewImageKey?: string | null
}

export type DbTemplateWithLikes = {
    id: string
    name: string
    description: string | null
    prompt: string
    isFeatured: boolean
    isSharedAsTemplate: boolean
    projectCategory: any
    createdAt: Date
    updatedAt: Date
    userId: string
    previewImageKey: string | null
    user: {
        name: string
        username: string
    }
    likes: Array<{
        userId: string
        isLiked: boolean
    }>
}
