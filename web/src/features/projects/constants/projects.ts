import type { Project } from '../types'

export const INITIAL_PROJECTS: Project[] = [
    {
        id: '1',
        title: 'E-commerce Dashboard',
        description: 'A modern dashboard for online store management with analytics.',
        updatedAt: '2 hours ago',
        isStarred: false,
    },
    {
        id: '2',
        title: 'Portfolio Site 2024',
        description: 'Minimalist personal portfolio showcasing design work and case studies.',
        updatedAt: 'Yesterday',
        isStarred: true,
    },
    {
        id: '3',
        title: 'SaaS Landing Page',
        description: 'High-converting landing page for a B2B software product.',
        updatedAt: '3 days ago',
        isStarred: false,
    },
    {
        id: '4',
        title: 'Personal Blog Design',
        description: 'Clean and readable blog layout with dark mode support.',
        updatedAt: 'Last week',
        isStarred: true,
    },
]
