import {
    Sparkles,
    Rocket,
    Lightbulb,
    Workflow,
    GitCommit,
    Server,
    Globe,
    Terminal,
    Command,
    Blocks,
    ShieldCheck,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export type DocTab =
    | 'Introduction'
    | 'Quick Start'
    | 'Prompting Guide'
    | 'Agent Loop'
    | 'Git Checkpoints'
    | 'Architecture'
    | 'Live Previews'
    | 'CLI Reference'
    | 'Slash Commands'
    | 'Integrations & MCP'
    | 'Security & Isolation'
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
        title: 'Overview',
        items: [
            {
                tab: 'Introduction',
                slug: 'intro',
                label: 'Introducing December',
                icon: Sparkles,
            },
            {
                tab: 'Quick Start',
                slug: 'quickstart',
                label: 'Quick Start',
                icon: Rocket,
            },
        ],
    },
    {
        title: 'Working with December',
        items: [
            {
                tab: 'Prompting Guide',
                slug: 'prompting',
                label: 'Prompting & Instructions',
                icon: Lightbulb,
            },
            {
                tab: 'Agent Loop',
                slug: 'agent-loop',
                label: 'Agent Decision Loop',
                icon: Workflow,
            },
            {
                tab: 'Git Checkpoints',
                slug: 'checkpoints',
                label: 'Git Checkpoints & Undo',
                icon: GitCommit,
            },
        ],
    },
    {
        title: 'Capabilities & Runtime',
        items: [
            {
                tab: 'Architecture',
                slug: 'architecture',
                label: 'Micro-VM Sandboxes',
                icon: Server,
            },
            {
                tab: 'Live Previews',
                slug: 'previews',
                label: 'Live Previews & Dev Servers',
                icon: Globe,
            },
        ],
    },
    {
        title: 'CLI & Terminal',
        items: [
            {
                tab: 'CLI Reference',
                slug: 'cli',
                label: 'CLI Reference & Setup',
                icon: Terminal,
            },
            {
                tab: 'Slash Commands',
                slug: 'slash-commands',
                label: 'Interactive Slash Commands',
                icon: Command,
            },
        ],
    },
    {
        title: 'Integrations & Security',
        items: [
            {
                tab: 'Integrations & MCP',
                slug: 'integrations',
                label: 'Integrations & MCP',
                icon: Blocks,
            },
            {
                tab: 'Security & Isolation',
                slug: 'security',
                label: 'Security & Sandboxing Isolation',
                icon: ShieldCheck,
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
    '/docs/prompting': 'Prompting Guide',
    '/docs/instructions': 'Prompting Guide',
    '/docs/agent-loop': 'Agent Loop',
    '/docs/decision-loop': 'Agent Loop',
    '/docs/checkpoints': 'Git Checkpoints',
    '/docs/undo': 'Git Checkpoints',
    '/docs/architecture': 'Architecture',
    '/docs/sandboxing': 'Architecture',
    '/docs/micro-vm': 'Architecture',
    '/docs/previews': 'Live Previews',
    '/docs/live-previews': 'Live Previews',
    '/docs/cli': 'CLI Reference',
    '/docs/december-cli': 'CLI Reference',
    '/docs/terminal': 'CLI Reference',
    '/docs/slash-commands': 'Slash Commands',
    '/docs/commands': 'Slash Commands',
    '/docs/integrations': 'Integrations & MCP',
    '/docs/mcp': 'Integrations & MCP',
    '/docs/security': 'Security & Isolation',
    '/docs/privacy': 'Privacy Policy',
    '/docs/terms': 'Terms of Service',
}

export const docTabToPath: Record<DocTab, string> = {
    Introduction: '/docs',
    'Quick Start': '/docs/quickstart',
    'Prompting Guide': '/docs/prompting',
    'Agent Loop': '/docs/agent-loop',
    'Git Checkpoints': '/docs/checkpoints',
    Architecture: '/docs/architecture',
    'Live Previews': '/docs/previews',
    'CLI Reference': '/docs/cli',
    'Slash Commands': '/docs/slash-commands',
    'Integrations & MCP': '/docs/integrations',
    'Security & Isolation': '/docs/security',
    'Privacy Policy': '/docs/privacy',
    'Terms of Service': '/docs/terms',
}

export const docTabToTitle: Record<DocTab, string> = {
    Introduction: 'Introducing December | Documentation',
    'Quick Start': 'Quick Start & First Run | December Docs',
    'Prompting Guide': 'Prompting & Instructions Guide | December Docs',
    'Agent Loop': 'Agent Decision Loop & Self-Healing | December Docs',
    'Git Checkpoints': 'Git Checkpointing & Undo | December Docs',
    Architecture: 'Micro-VM Sandboxes & System Architecture | December Docs',
    'Live Previews': 'Live Previews & Dev Servers | December Docs',
    'CLI Reference': 'CLI Reference & Commands | December Docs',
    'Slash Commands': 'Slash Commands & Shortcuts | December Docs',
    'Integrations & MCP': 'Integrations & MCP Protocol | December Docs',
    'Security & Isolation': 'Security & Sandboxing Isolation | December Docs',
    'Privacy Policy': 'Privacy Policy | December',
    'Terms of Service': 'Terms of Service | December',
}
