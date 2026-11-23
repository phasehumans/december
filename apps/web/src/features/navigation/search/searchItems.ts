import { DOCS_INDEX } from './docsIndex.generated'

import type { BackendSession } from '@/features/sessions/api/session'

export type SearchGroup =
    | 'Sessions'
    | 'Actions'
    | 'Navigation'
    | 'Repositories'
    | 'Settings'
    | 'Docs'

export interface SearchItem {
    id: string
    group: SearchGroup
    label: string
    keywords?: string[]
    /** session rows: repo name and compact time on the right */
    repo?: string | null
    time?: string | null
    /** Cmd+Enter opens this in a new tab */
    href?: string
    /** always opens in a new tab (docs, legal) */
    external?: boolean
    /** label flashed on the row before the modal closes */
    flashLabel?: string
    run: () => void
}

export type SearchRow =
    | { kind: 'item'; item: SearchItem; indexes: number[] }
    | { kind: 'ask'; prompt: string }

export interface SearchSection {
    key: string
    title: string | null
    rows: SearchRow[]
    isAsk?: boolean
}

export const CLI_INSTALL_COMMAND = 'npm install -g @trydecember/cli'

/** most results each group shows while searching */
export const GROUP_LIMIT: Record<SearchGroup, number> = {
    Sessions: 6,
    Actions: 4,
    Navigation: 4,
    Repositories: 4,
    Settings: 4,
    Docs: 4,
}

export const SETTINGS_PAGES: { id: string; label: string; path: string; keywords: string[] }[] = [
    {
        id: 'account',
        label: 'Account',
        path: '/settings/account',
        keywords: [
            'profile',
            'email',
            'avatar',
            'user',
            'name',
            'security',
            'preferences',
            'send key',
            'sound',
            'shortcuts',
            'keyboard',
        ],
    },
    {
        id: 'repositories',
        label: 'Repositories',
        path: '/settings/repositories',
        keywords: ['repos', 'github', 'git', 'branch', 'code'],
    },
    {
        id: 'connections',
        label: 'Connections',
        path: '/settings/connections/apps',
        keywords: [
            'integrations',
            'connectors',
            'github',
            'gitlab',
            'vercel',
            'figma',
            'linear',
            'sentry',
            'neon',
            'cloudflare',
            'upstash',
            'railway',
            'posthog',
            'slack',
            'discord',
            'oauth',
        ],
    },
    {
        id: 'repositories',
        label: 'GitHub repositories',
        path: '/settings/connections/apps/github',
        keywords: ['repos', 'github', 'git', 'sync', 'branches', 'codebase'],
    },
    {
        id: 'plugins',
        label: 'Plugins',
        path: '/settings/connections/plugins',
        keywords: ['marketplace', 'extensions', 'install', 'connections'],
    },
    {
        id: 'skills',
        label: 'Skills',
        path: '/settings/connections/skills',
        keywords: ['skill.md', 'commands', 'instructions', 'connections'],
    },
    {
        id: 'mcps',
        label: 'MCPs',
        path: '/settings/connections/mcps',
        keywords: ['mcp', 'model context protocol', 'servers', 'tools', 'connections'],
    },
    {
        id: 'hooks',
        label: 'Hooks',
        path: '/settings/connections/hooks',
        keywords: ['hooks.json', 'events', 'scripts', 'connections'],
    },
    {
        id: 'rules',
        label: 'Rules',
        path: '/settings/connections/rules',
        keywords: ['agents.md', 'instructions', 'guidelines', 'connections'],
    },
    {
        id: 'memory',
        label: 'Memory',
        path: '/settings/connections/memory',
        keywords: ['memories', 'notes', 'remember', 'connections'],
    },
    {
        id: 'secrets',
        label: 'Secrets',
        path: '/settings/secrets',
        keywords: ['api key', 'tokens', 'credentials', 'env', 'variables'],
    },
    {
        id: 'models',
        label: 'Your keys',
        path: '/settings/models',
        keywords: ['model', 'byok', 'own key', 'api key', 'provider', 'openai', 'anthropic'],
    },
    {
        id: 'billing',
        label: 'Billing',
        path: '/settings/billing',
        keywords: ['credits', 'payment', 'invoices', 'receipts', 'wallet', 'pricing'],
    },
    {
        id: 'usage',
        label: 'Usage',
        path: '/settings/usage',
        keywords: ['quotas', 'tokens', 'metrics', 'stats', 'analytics'],
    },
]

export const docsPages = (webUrl: string) => [
    ...DOCS_INDEX.map((page) => ({
        id: `docs-${page.slug || 'index'}`,
        label: page.title,
        keywords: page.keywords,
        href: `${webUrl}/docs${page.slug ? `/${page.slug}` : ''}`,
    })),
    {
        id: 'docs-privacy',
        label: 'Privacy policy',
        keywords: ['legal', 'privacy', 'data', 'gdpr'],
        href: `${webUrl}/privacy`,
    },
    {
        id: 'docs-terms',
        label: 'Terms of service',
        keywords: ['legal', 'terms', 'tos', 'agreement'],
        href: `${webUrl}/terms`,
    },
]

export const sessionRepoLabel = (session: BackendSession): string | null => {
    if (session.githubRepoName) return session.githubRepoName
    if (!session.repoUrl) return null
    const last = session.repoUrl
        .replace(/\.git$/, '')
        .split('/')
        .filter(Boolean)
        .pop()
    return last || null
}

/** "now", "12m", "5h", "3d", then "Nov 4" */
export const compactTime = (iso?: string | null, now = Date.now()): string | null => {
    if (!iso) return null
    const date = new Date(iso)
    if (isNaN(date.getTime())) return null
    const mins = Math.floor(Math.max(0, now - date.getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
