import type { BackendTemplate } from './api/template'

export type TemplateCategory =
    | 'apps'
    | 'landing'
    | 'dashboards'
    | 'components'
    | 'login'
    | 'ecommerce'
    | 'none'

export type Template = {
    id: string
    title: string
    description: string
    author: string
    likeCount: number
    isLiked: boolean
    category: TemplateCategory
    createdAt: string
    updatedAt: string
    isFeatured: boolean
}

const mapProjectCategory = (projectCategory: string): TemplateCategory => {
    switch (projectCategory) {
        case 'LANDING_PAGE':
            return 'landing'
        case 'DASHBOARD':
            return 'dashboards'
        case 'PORTFOLIO_BLOG':
            return 'components'
        case 'SAAS_APP':
            return 'apps'
        case 'ECOMMERCE':
            return 'ecommerce'
        default:
            return 'none'
    }
}

export const mapBackendTemplateToTemplate = (template: BackendTemplate): Template => ({
    id: template.id,
    title: template.name,
    description: template.description ?? '',
    author: template.authorUsername || template.authorName || 'community',
    likeCount: template.likeCount,
    isLiked: template.isLiked,
    category: mapProjectCategory(template.projectCategory),
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    isFeatured: template.isFeatured,
})
