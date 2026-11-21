// Docs sidebar and Documentation Directory order. Also used to order llms.txt and llms-full.txt.
export interface DocsNavItem {
    slug: string
    label: string
    desc: string
}

export interface DocsNavCategory {
    category: string
    items: DocsNavItem[]
}

export const docCategories: DocsNavCategory[] = [
    {
        category: 'Getting Started',
        items: [
            {
                slug: 'quickstart',
                label: 'Quickstart (60s)',
                desc: 'Install the CLI or launch a cloud workspace in under a minute.',
            },
        ],
    },
    {
        category: 'Core Concepts',
        items: [
            {
                slug: 'architecture',
                label: 'System Architecture',
                desc: 'Terminal-first coding with isolated cloud sandboxes.',
            },
            {
                slug: 'agent-loop',
                label: 'Agent Reasoning Loop',
                desc: 'How December reads files, plans changes, and tests its work.',
            },
            {
                slug: 'checkpoints',
                label: 'Git Checkpoints',
                desc: 'Automatic restore points so you can undo any mistake with one command.',
            },
            {
                slug: 'worktrees',
                label: 'Git Worktrees',
                desc: 'Isolate complex refactors and risky experiments in parallel git trees.',
            },
            {
                slug: 'artifacts',
                label: 'Session Artifacts & Plans',
                desc: 'Structured implementation plans, review walkthroughs, and approval flows.',
            },
            {
                slug: 'previews',
                label: 'Live Sandboxed Previews',
                desc: 'Instant browser previews that show your changes as you build.',
            },
        ],
    },
    {
        category: 'CLI & Tools',
        items: [
            {
                slug: 'cli',
                label: 'CLI Reference',
                desc: 'Every command, shortcut, and flag you can run in your terminal.',
            },
            {
                slug: 'slash-commands',
                label: 'Slash Commands',
                desc: 'Built-in commands like /rewind, /model, /plan, and /login.',
            },
            {
                slug: 'memory',
                label: 'Project Rules & /learn',
                desc: 'AGENTS.md rules, saving lessons with /learn, and the /memory view.',
            },
            {
                slug: 'skills',
                label: 'Skills & Playbooks',
                desc: 'Teach December specialized workflows for your codebase.',
            },
            {
                slug: 'hooks',
                label: 'Hooks',
                desc: 'Run your own shell commands before tool calls, on prompts, and at the end of a turn.',
            },
            {
                slug: 'plugins',
                label: 'Plugins & Marketplaces',
                desc: 'Install and manage plugins, skills, and MCP servers with /plugin.',
            },
            {
                slug: 'prompting',
                label: 'Prompting Guide',
                desc: 'Simple tips for giving clear instructions and getting great results.',
            },
            {
                slug: 'configuration',
                label: 'Configuration & Rules',
                desc: 'Customize defaults and use AGENTS.md to enforce team coding rules.',
            },
        ],
    },
    {
        category: 'Ecosystem & Help',
        items: [
            {
                slug: 'mcp',
                label: 'Model Context Protocol (MCP)',
                desc: 'Connect external tools, databases, and custom services via MCP.',
            },
            {
                slug: 'integrations',
                label: 'Model Providers & BYOK',
                desc: 'Bring your own API keys with zero markup on token pricing.',
            },
            {
                slug: 'security',
                label: 'Security & Isolation',
                desc: 'How your API keys, local files, and secrets are protected.',
            },
            {
                slug: 'troubleshooting',
                label: 'Troubleshooting & FAQ',
                desc: 'Quick solutions for common errors, rate limits, and setup questions.',
            },
        ],
    },
]
