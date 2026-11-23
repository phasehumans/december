import type {
    ConnectionsHook,
    ConnectionsMcp,
    ConnectionsMemory,
    ConnectionsPlugin,
    ConnectionsRule,
    ConnectionsSkill,
} from '../types'

// sample data for demo mode only (see connectionsDemo.ts). nothing here is saved.

export const demoPlugins: ConnectionsPlugin[] = [
    {
        name: 'playwright',
        version: '1.2.0',
        source: 'december marketplace',
        commit: '4f1c9e2',
        installed: true,
        enabled: true,
        contents: [{ type: 'mcp', name: 'playwright' }],
    },
    {
        name: 'release-kit',
        version: '0.3.1',
        source: 'phasehumans/release-kit',
        commit: 'a1b2c3d',
        installed: true,
        enabled: true,
        updateTo: '0.4.0',
        contents: [
            { type: 'skill', name: 'release-notes' },
            { type: 'skill', name: 'bump-version' },
            { type: 'rule', name: 'changelog-style' },
            { type: 'hook', name: 'bun install' },
        ],
    },
    ...[
        'context7',
        'postgres',
        'brave-search',
        'fetch',
        'sqlite',
        'filesystem',
        'memory',
        'sequential-thinking',
        'puppeteer',
    ].map(
        (name): ConnectionsPlugin => ({
            name,
            version: '1.0.0',
            source: 'december marketplace',
            commit: '0000000',
            installed: false,
            enabled: true,
            contents: [{ type: 'mcp', name }],
        })
    ),
    {
        name: 'slack',
        version: '1.0.0',
        source: 'december marketplace',
        commit: '0000000',
        brand: 'slack',
        installed: false,
        enabled: true,
        contents: [{ type: 'mcp', name: 'slack' }],
    },
]

export const demoSkills: ConnectionsSkill[] = [
    {
        name: 'write-tests',
        description: 'Write unit tests for changed files',
        runs: 'agent',
        body: '# Steps\n1. Find files changed on this branch.\n2. Add tests next to each file.\n3. Run bun test and fix failures.',
        enabled: true,
    },
    {
        name: 'pr-summary',
        description: 'Summarize the current branch as a pull request body',
        runs: 'user',
        body: 'Read the diff against main and write a short pull request body in lowercase.',
        enabled: true,
    },
    {
        name: 'release-notes',
        description: 'Write release notes from merged pull requests',
        runs: 'agent',
        body: 'Write release notes from merged pull requests since the last tag.',
        enabled: true,
        plugin: 'release-kit',
    },
    {
        name: 'bump-version',
        description: 'Bump the package version',
        runs: 'user',
        body: 'Bump the version in package.json and update CHANGELOG.md.',
        enabled: true,
        plugin: 'release-kit',
    },
]

export const demoMcps: ConnectionsMcp[] = [
    {
        name: 'sentry',
        url: 'https://mcp.sentry.dev/mcp',
        transport: 'http',
        auth: 'oauth',
        headers: [],
        status: 'connected',
        enabled: true,
        account: 'phasehumans',
        brand: 'sentry',
        tools: [
            { name: 'search_issues', enabled: true },
            { name: 'get_issue_details', enabled: true },
            { name: 'list_projects', enabled: true },
            { name: 'resolve_issue', enabled: false },
        ],
    },
    {
        name: 'linear',
        url: 'https://mcp.linear.app/mcp',
        transport: 'http',
        auth: 'oauth',
        headers: [],
        status: 'needs-signin',
        enabled: true,
        brand: 'linear',
        tools: [],
    },
    {
        name: 'neon',
        url: 'https://mcp.neon.tech/mcp',
        transport: 'http',
        auth: 'header',
        headers: [{ key: 'Authorization', value: 'Bearer napi_demo' }],
        status: 'error',
        enabled: true,
        lastError: 'Timed out after 10s',
        brand: 'neon',
        tools: [
            { name: 'run_sql', enabled: true },
            { name: 'create_branch', enabled: true },
        ],
    },
    {
        name: 'posthog',
        url: 'https://mcp.posthog.com/mcp',
        transport: 'sse',
        auth: 'header',
        headers: [{ key: 'Authorization', value: 'Bearer phx_demo' }],
        status: 'connected',
        enabled: false,
        brand: 'posthog',
        tools: [
            { name: 'list_feature_flags', enabled: true },
            { name: 'query_insights', enabled: true },
        ],
    },
    {
        name: 'playwright',
        url: 'stdio: npx @playwright/mcp',
        transport: 'http',
        auth: 'none',
        headers: [],
        status: 'connected',
        enabled: true,
        plugin: 'playwright',
        tools: [
            { name: 'browser_navigate', enabled: true },
            { name: 'browser_click', enabled: true },
            { name: 'browser_snapshot', enabled: true },
        ],
    },
]

export const demoHooks: ConnectionsHook[] = [
    {
        id: 'hook-1',
        event: 'PreToolUse',
        matcher: 'bash|edit_file',
        command: './scripts/check.sh',
        timeout: 60,
        enabled: true,
    },
    {
        id: 'hook-2',
        event: 'PostToolUse',
        matcher: 'edit_file',
        command: 'bunx prettier --write',
        timeout: 30,
        enabled: true,
    },
    {
        id: 'hook-3',
        event: 'SessionStart',
        matcher: '',
        command: 'bun install',
        timeout: 120,
        enabled: true,
        plugin: 'release-kit',
    },
]

export const demoRules: ConnectionsRule[] = [
    {
        name: 'code-style',
        when: 'always',
        body: '- Use arrow functions in services.\n- No em dashes anywhere.\n- Lowercase commit messages.',
        enabled: true,
    },
    {
        name: 'commit-messages',
        when: 'manual',
        body: 'Write commit messages in lowercase, conventional commit style.',
        enabled: true,
    },
    {
        name: 'changelog-style',
        when: 'always',
        body: 'Group changelog entries by feat, fix and chore.',
        enabled: true,
        plugin: 'release-kit',
    },
]

export const demoMemories: ConnectionsMemory[] = [
    {
        id: 'mem-1',
        title: 'Prefers bun over npm',
        body: 'Use bun for install, test and scripts in every repo.',
        session: 'fix auth redirect',
        savedAt: '2026-11-22T10:00:00.000Z',
    },
    {
        id: 'mem-2',
        title: 'december: run db:migrate:test before tests',
        body: 'Server tests need the test database migrated first: bun --cwd packages/database db:migrate:test.',
        session: 'server tests',
        savedAt: '2026-11-20T10:00:00.000Z',
    },
    {
        id: 'mem-3',
        title: 'Lowercase commit messages',
        body: 'Commit messages, pr titles and pr bodies are lowercase only.',
        session: 'release v0.9',
        savedAt: '2026-11-18T10:00:00.000Z',
    },
]
