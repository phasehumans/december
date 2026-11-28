/**
 * The plugin marketplace that is built in, shared by the cli (`december plugin`) and the
 * web (Connections > Plugins), so a name means the same plugin in both. Each entry
 * installs as a plugin folder with a plugin.json and an mcp.json. Entries list real,
 * published MCP servers only.
 */

export interface BuiltInMarketplaceEntry {
    name: string
    description: string
    category: string
    author: string
    version: string
    /** environment variables the plugin needs before it works */
    env?: string[]
    /** suggested install scope in the cli */
    defaultScope?: 'user' | 'project'
    mcpServers: Record<string, { command: string; args: string[] }>
}

export interface BuiltInMarketplace {
    name: string
    owner: string
    description: string
    plugins: BuiltInMarketplaceEntry[]
}

export const BUILT_IN_MARKETPLACE_NAME = 'december-official'

export const BUILT_IN_MARKETPLACE: BuiltInMarketplace = {
    name: BUILT_IN_MARKETPLACE_NAME,
    owner: 'December Team',
    description: 'MCP servers and plugins maintained with December',
    plugins: [
        {
            name: 'github',
            description: 'Repository search, issues, pull requests, and file contents on GitHub.',
            category: 'Development',
            author: 'Model Context Protocol',
            version: '1.0.0',
            env: ['GITHUB_PERSONAL_ACCESS_TOKEN'],
            mcpServers: {
                github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
            },
        },
        {
            name: 'playwright',
            description: 'Drive a real browser to test pages, fill forms, and take snapshots.',
            category: 'Testing & Automation',
            author: 'Microsoft',
            version: '1.0.0',
            mcpServers: {
                playwright: { command: 'npx', args: ['-y', '@playwright/mcp@latest'] },
            },
        },
        {
            name: 'puppeteer',
            description: 'Headless browser automation and full-page screenshots.',
            category: 'Testing & Automation',
            author: 'Model Context Protocol',
            version: '1.0.0',
            mcpServers: {
                puppeteer: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
                },
            },
        },
        {
            name: 'context7',
            description: 'Current library and framework documentation, fetched on demand.',
            category: 'Docs & Search',
            author: 'Upstash',
            version: '1.0.0',
            mcpServers: {
                context7: { command: 'npx', args: ['-y', '@upstash/context7-mcp'] },
            },
        },
        {
            name: 'brave-search',
            description: 'Web and local search through the Brave Search API.',
            category: 'Docs & Search',
            author: 'Model Context Protocol',
            version: '1.0.0',
            env: ['BRAVE_API_KEY'],
            mcpServers: {
                'brave-search': {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-brave-search'],
                },
            },
        },
        {
            name: 'fetch',
            description: 'Fetch web pages and convert them to markdown. Needs uv installed.',
            category: 'Docs & Search',
            author: 'Model Context Protocol',
            version: '1.0.0',
            mcpServers: {
                fetch: { command: 'uvx', args: ['mcp-server-fetch'] },
            },
        },
        {
            name: 'postgres',
            description: 'Read-only PostgreSQL queries and schema inspection.',
            category: 'Database',
            author: 'Model Context Protocol',
            version: '1.0.0',
            defaultScope: 'project',
            mcpServers: {
                postgres: {
                    command: 'npx',
                    args: [
                        '-y',
                        '@modelcontextprotocol/server-postgres',
                        'postgresql://localhost/postgres',
                    ],
                },
            },
        },
        {
            name: 'sqlite',
            description: 'Query and inspect a local SQLite file. Needs uv installed.',
            category: 'Database',
            author: 'Model Context Protocol',
            version: '1.0.0',
            defaultScope: 'project',
            mcpServers: {
                sqlite: { command: 'uvx', args: ['mcp-server-sqlite', '--db-path', './app.db'] },
            },
        },
        {
            name: 'filesystem',
            description: 'Read and write files inside the folders you allow.',
            category: 'Files',
            author: 'Model Context Protocol',
            version: '1.0.0',
            defaultScope: 'project',
            mcpServers: {
                filesystem: {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
                },
            },
        },
        {
            name: 'memory',
            description: 'A local knowledge graph the agent can read and add to across sessions.',
            category: 'Knowledge',
            author: 'Model Context Protocol',
            version: '1.0.0',
            mcpServers: {
                memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
            },
        },
        {
            name: 'sequential-thinking',
            description: 'Step-by-step problem solving with revisable thoughts.',
            category: 'Knowledge',
            author: 'Model Context Protocol',
            version: '1.0.0',
            mcpServers: {
                'sequential-thinking': {
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
                },
            },
        },
        {
            name: 'slack',
            description: 'Read channels, post messages, and reply to threads in Slack.',
            category: 'Communication',
            author: 'Model Context Protocol',
            version: '1.0.0',
            env: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
            mcpServers: {
                slack: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'] },
            },
        },
    ],
}
