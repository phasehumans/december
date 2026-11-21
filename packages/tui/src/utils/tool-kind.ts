import { toRelativePath } from './terminal-link'

/** What a tool call does, as the chat and the activity line describe it */
export type ToolKind =
    | 'explore'
    | 'edit'
    | 'write'
    | 'command'
    | 'web'
    | 'fetch'
    | 'agent'
    | 'plan'
    | 'mcp'
    | 'other'

const EXPLORE = new Set([
    'read_file',
    'view_file',
    'read',
    'list_dir',
    'ls',
    'grep_search',
    'find_files',
    'file_search',
    'find_by_name',
    'search',
    'grep',
    'code_search',
    'search_code',
    'code_intelligence',
])
const EDIT = new Set([
    'edit_file',
    'replace_file_content',
    'edit_diff',
    'multi_replace_file_content',
    'edit',
])
const WRITE = new Set(['write_file', 'write_to_file', 'create_file', 'write'])
const COMMAND = new Set(['bash', 'run_command', 'execute_command', 'terminal', 'shell'])
const WEB = new Set(['search_web', 'web_search'])
const FETCH = new Set(['fetch', 'read_url_content'])
const AGENT = new Set(['invoke_subagent', 'spawn_subagent'])
/** MCP servers that December ships tools for under the server name */
const MCP_SERVERS = new Set([
    'github',
    'slack',
    'postgres',
    'sqlite',
    'filesystem',
    'puppeteer',
    'playwright',
])

export function parseToolInput(input: unknown): Record<string, any> {
    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input)
            return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
            // Intentionally swallowed: a partial or invalid JSON input reads as no input
            return {}
        }
    }
    return input && typeof input === 'object' ? (input as Record<string, any>) : {}
}

export function classifyTool(name?: string, command?: string): ToolKind {
    const lower = (name || '').toLowerCase()
    const cmd = command || ''
    if (lower === 'update_plan') return 'plan'
    if (AGENT.has(lower) || cmd.startsWith('SubAgent(')) return 'agent'
    if (EDIT.has(lower) || cmd.startsWith('Edit(')) return 'edit'
    if (WRITE.has(lower) || cmd.startsWith('Create(')) return 'write'
    if (COMMAND.has(lower) || cmd.startsWith('Bash(')) return 'command'
    if (WEB.has(lower) || /^WebSearch\((?!https?:)/.test(cmd)) return 'web'
    if (FETCH.has(lower) || /^WebSearch\(https?:/.test(cmd)) return 'fetch'
    if (EXPLORE.has(lower) || /^(Read|ListDir|Search|CodeIntel)\(/.test(cmd)) {
        return 'explore'
    }
    if (lower.includes('__') || lower.startsWith('mcp_') || MCP_SERVERS.has(lower)) return 'mcp'
    return 'other'
}

/** The text inside "Name(...)" of a tool command summary */
function commandArg(command?: string): string {
    return command?.match(/^[A-Za-z0-9_]+\(([\s\S]*)\)$/)?.[1] ?? ''
}

export function toolFilePath(input: Record<string, any>, command?: string): string {
    const raw =
        input.TargetFile ||
        input.AbsolutePath ||
        input.filePath ||
        input.filepath ||
        input.file_path ||
        input.path ||
        input.file ||
        commandArg(command) ||
        ''
    return toRelativePath(String(raw))
}

export function toolCommandText(input: Record<string, any>, command?: string): string {
    return String(input.command || input.CommandLine || input.cmd || commandArg(command) || '')
        .replace(/\s+/g, ' ')
        .trim()
}

export type ExploreKind = 'read' | 'list' | 'search'

export function exploreKind(name?: string, command?: string): ExploreKind {
    const lower = (name || '').toLowerCase()
    if (lower === 'list_dir' || lower === 'ls' || command?.startsWith('ListDir(')) return 'list'
    if (
        lower === 'read_file' ||
        lower === 'view_file' ||
        lower === 'read' ||
        command?.startsWith('Read(')
    ) {
        return 'read'
    }
    return 'search'
}

/** The main target of an explore call: a path for reads and lists, the query for searches */
export function exploreTarget(
    name: string | undefined,
    input: Record<string, any>,
    command?: string
): string {
    const kind = exploreKind(name, command)
    if (kind === 'search') {
        return String(
            input.query || input.Query || input.pattern || input.symbol || commandArg(command) || ''
        )
    }
    const path = toolFilePath(input, command)
    return kind === 'list' ? path || '.' : path
}

export function webQuery(input: Record<string, any>, command?: string): string {
    return String(input.query || input.Query || input.Url || input.url || commandArg(command) || '')
}

export function agentRole(input: Record<string, any>, command?: string): string {
    return String(input.role || input.Role || input.name || commandArg(command) || 'subagent')
}

/** Shortens a path in the middle so the file name stays visible (S24) */
export function middleEllipsis(text: string, max: number): string {
    if (text.length <= max || max < 8)
        return text.length <= max ? text : text.slice(0, Math.max(0, max))
    const parts = text.split('/')
    if (parts.length > 2) {
        const head = parts[0]!
        const tail: string[] = []
        let length = head.length + 2
        for (let i = parts.length - 1; i > 0; i--) {
            const next = parts[i]!.length + 1
            if (length + next > max) break
            tail.unshift(parts[i]!)
            length += next
        }
        if (tail.length > 0) return `${head}/…/${tail.join('/')}`
    }
    const keep = max - 1
    const front = Math.ceil(keep / 2)
    return `${text.slice(0, front)}…${text.slice(text.length - (keep - front))}`
}

/** "1.2s" for durations of a second or more; shorter durations are not shown (D4) */
export function formatStepDuration(ms?: number): string {
    if (ms === undefined || ms < 1000) return ''
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
    const s = Math.floor(ms / 1000)
    return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}
