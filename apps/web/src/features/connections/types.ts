export const CONNECTIONS_TABS = [
    'apps',
    'plugins',
    'skills',
    'mcps',
    'hooks',
    'rules',
    'memory',
] as const

export type ConnectionsTab = (typeof CONNECTIONS_TABS)[number]

export const CONNECTIONS_TAB_LABELS: Record<ConnectionsTab, string> = {
    apps: 'Apps',
    plugins: 'Plugins',
    skills: 'Skills',
    mcps: 'MCPs',
    hooks: 'Hooks',
    rules: 'Rules',
    memory: 'Memory',
}

export type BrandKey =
    | 'github'
    | 'gitlab'
    | 'slack'
    | 'linear'
    | 'sentry'
    | 'neon'
    | 'posthog'
    | 'figma'
    | 'cloudflare'
    | 'upstash'
    | 'railway'
    | 'discord'

export type SkillRunner = 'agent' | 'user'

export interface ConnectionsSkill {
    name: string
    description: string
    runs: SkillRunner
    body: string
    enabled: boolean
}

export type McpTransport = 'http' | 'sse'
export type McpAuth = 'none' | 'header'
/** `unknown`: no session has used the server yet, so nothing is known about it */
export type McpStatus = 'connected' | 'error' | 'unknown'

export interface ConnectionsMcp {
    name: string
    url: string
    transport: McpTransport
    auth: McpAuth
    headers: { key: string; value: string }[]
    status: McpStatus
    enabled: boolean
    tools: { name: string; enabled: boolean }[]
    lastError?: string
    brand?: BrandKey
}

export const HOOK_EVENTS = [
    'PreToolUse',
    'PostToolUse',
    'UserPromptSubmit',
    'Stop',
    'SessionStart',
    'Notification',
] as const

export type HookEvent = (typeof HOOK_EVENTS)[number]

export const HOOK_EVENT_LABELS: Record<HookEvent, string> = {
    PreToolUse: 'Before a tool runs',
    PostToolUse: 'After a tool runs',
    UserPromptSubmit: 'Prompt sent',
    Stop: 'Agent stops',
    SessionStart: 'Session start',
    Notification: 'Notification',
}

export const TOOL_HOOK_EVENTS: HookEvent[] = ['PreToolUse', 'PostToolUse']
