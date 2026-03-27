import type { Project } from '../types'

export const INITIAL_PROJECTS: Project[] = [
    {
        id: '1',
        title: 'E-commerce Dashboard',
        description: 'A modern dashboard for online store management with analytics.',
        updatedAt: '2 hours ago',
        isStarred: false,
        versionCount: 1,
        currentVersionId: 'v1',
    },
    {
        id: '2',
        title: 'Portfolio Site 2024',
        description: 'Minimalist personal portfolio showcasing design work and case studies.',
        updatedAt: 'Yesterday',
        isStarred: true,
        versionCount: 3,
        currentVersionId: 'v3',
    },
    {
        id: '3',
        title: 'SaaS Landing Page',
        description: 'High-converting landing page for a B2B software product.',
        updatedAt: '3 days ago',
        isStarred: false,
        versionCount: 2,
        currentVersionId: 'v2',
    },
    {
        id: '4',
        title: 'Personal Blog Design',
        description: 'Clean and readable blog layout with dark mode support.',
        updatedAt: 'Last week',
        isStarred: true,
        versionCount: 1,
        currentVersionId: 'v1',
    },
]
