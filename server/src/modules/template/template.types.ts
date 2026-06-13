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

export type GetTemplatePreviewHtml = {
    templateId: string
}

export type GetTemplatePreviewImage = {
    templateId: string
}
