import { Book, Zap, Layers, Terminal, Shield, FileText } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export type DocTab =
    | 'Introduction'
    | 'Quick Start'
    | 'Architecture'
    | 'CLI Reference'
    | 'Privacy Policy'
    | 'Terms of Service'

export interface DocNavItem {
    tab: DocTab
    slug: string
    label: string
    icon: LucideIcon
}

export interface DocNavGroup {
    title: string
    items: DocNavItem[]
}

export const DOCS_NAV_GROUPS: DocNavGroup[] = [
    {
        title: 'Getting Started',
        items: [
            {
                tab: 'Introduction',
                slug: 'intro',
                label: 'Introduction',
                icon: Book,
            },
            {
                tab: 'Quick Start',
                slug: 'quickstart',
                label: 'Quick Start',
                icon: Zap,
            },
        ],
    },
    {
        title: 'Deep Dive',
        items: [
            {
                tab: 'Architecture',
                slug: 'architecture',
                label: 'Architecture',
                icon: Layers,
            },
            {
                tab: 'CLI Reference',
                slug: 'cli',
                label: 'CLI Reference',
                icon: Terminal,
            },
        ],
    },
    {
        title: 'Legal & Policies',
        items: [
            {
                tab: 'Privacy Policy',
                slug: 'privacy',
                label: 'Privacy Policy',
                icon: Shield,
            },
            {
                tab: 'Terms of Service',
                slug: 'terms',
                label: 'Terms of Service',
                icon: FileText,
            },
        ],
    },
]

export const pathToDocTab: Record<string, DocTab> = {
    '/docs': 'Introduction',
    '/docs/': 'Introduction',
    '/docs/intro': 'Introduction',
    '/docs/introduction': 'Introduction',
    '/docs/quickstart': 'Quick Start',
    '/docs/quick-start': 'Quick Start',
    '/docs/architecture': 'Architecture',
    '/docs/cli': 'CLI Reference',
    '/docs/december-cli': 'CLI Reference',
    '/docs/privacy': 'Privacy Policy',
    '/docs/terms': 'Terms of Service',
}

export const docTabToPath: Record<DocTab, string> = {
    Introduction: '/docs',
    'Quick Start': '/docs/quickstart',
    Architecture: '/docs/architecture',
    'CLI Reference': '/docs/cli',
    'Privacy Policy': '/docs/privacy',
    'Terms of Service': '/docs/terms',
}

export const docTabToTitle: Record<DocTab, string> = {
    Introduction: 'Documentation | December',
    'Quick Start': 'Quick Start | December Docs',
    Architecture: 'Architecture & Sandboxing | December Docs',
    'CLI Reference': 'CLI Reference & Commands | December Docs',
    'Privacy Policy': 'Privacy Policy | December',
    'Terms of Service': 'Terms of Service | December',
}
