import { parseArgs } from 'node:util'

export interface ParsedCliArgs {
    command?: string
    prompt?: string
    isHelp: boolean
    isVersion: boolean
    yes: boolean
    json: boolean
    rpc: boolean
    print: boolean
    fix: boolean
    force: boolean
    isGlobal: boolean
    isLocal: boolean
    resume: boolean
    isInline: boolean
    fullscreen?: boolean
    model?: string
    provider?: string
    sessionId?: string
    baseUrl?: string
    scope?: string
    cwd?: string
    turn?: number
    list?: boolean
    token?: string
    env?: string[]
    header?: string[]
    eager?: boolean
    positionals: string[]
}

const MCP_ADD_VALUE_FLAGS: Record<string, 'env' | 'header' | 'scope'> = {
    '-e': 'env',
    '--env': 'env',
    '-H': 'header',
    '--header': 'header',
    '--scope': 'scope',
}

/**
 * `december mcp add <name> <command-or-url> [server args...]` needs its own parsing:
 * the server's own flags (for example `npx -y`) must reach the server command instead of
 * being read as December flags. Only the `mcp add` flags below are taken out; every other
 * token after the target belongs to the server. `--` passes everything after it through verbatim.
 */
function parseMcpAddArgs(args: string[]): ParsedCliArgs {
    const positionals: string[] = ['mcp', 'add']
    const env: string[] = []
    const header: string[] = []
    let scope: string | undefined
    let isGlobal = false
    let eager = false

    for (let i = 2; i < args.length; i++) {
        const token = args[i]!
        if (token === '--') {
            positionals.push(...args.slice(i + 1))
            break
        }

        const [flag, inlineValue] = token.startsWith('--')
            ? token.split(/=(.*)/s, 2)
            : [token, undefined]
        const valueTarget = MCP_ADD_VALUE_FLAGS[flag!]
        if (valueTarget) {
            const value = inlineValue ?? args[++i]
            if (value === undefined) break
            if (valueTarget === 'env') env.push(value)
            else if (valueTarget === 'header') header.push(value)
            else scope = value
            continue
        }
        if (token === '-g' || token === '--global') {
            isGlobal = true
            continue
        }
        if (token === '--eager') {
            eager = true
            continue
        }
        positionals.push(token)
    }

    return {
        ...defaultParsedArgs(),
        command: 'mcp',
        scope,
        isGlobal,
        eager,
        env: env.length > 0 ? env : undefined,
        header: header.length > 0 ? header : undefined,
        positionals,
    }
}

function defaultParsedArgs(): ParsedCliArgs {
    return {
        isHelp: false,
        isVersion: false,
        yes: false,
        json: false,
        rpc: false,
        print: false,
        fix: false,
        force: false,
        isGlobal: false,
        isLocal: false,
        resume: false,
        isInline: false,
        turn: undefined,
        list: false,
        positionals: [],
    }
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
    if (args[0] === 'mcp' && args[1] === 'add') {
        return parseMcpAddArgs(args)
    }

    try {
        const { values, positionals } = parseArgs({
            args,
            options: {
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'v' },
                yes: { type: 'boolean', short: 'y' },
                json: { type: 'boolean' },
                rpc: { type: 'boolean' },
                print: { type: 'boolean' },
                fix: { type: 'boolean' },
                force: { type: 'boolean', short: 'f' },
                global: { type: 'boolean', short: 'g' },
                local: { type: 'boolean', short: 'l' },
                resume: { type: 'boolean', short: 'r' },
                model: { type: 'string', short: 'm' },
                provider: { type: 'string', short: 'p' },
                'base-url': { type: 'string' },
                'session-id': { type: 'string' },
                scope: { type: 'string' },
                cwd: { type: 'string' },
                turn: { type: 'string', short: 't' },
                list: { type: 'boolean' },
                token: { type: 'string' },
                env: { type: 'string', short: 'e', multiple: true },
                header: { type: 'string', short: 'H', multiple: true },
                eager: { type: 'boolean' },
            },
            allowPositionals: true,
            strict: false,
        })

        const isHelp = Boolean(values.help)
        const isVersion = Boolean(values.version)
        const yes = Boolean(values.yes)
        const json = Boolean(values.json)
        const rpc = Boolean(values.rpc)
        const print = Boolean(values.print)
        const fix = Boolean(values.fix)
        const force = Boolean(values.force)
        const isGlobal = Boolean(values.global)
        const isLocal = Boolean(values.local)
        const isResume = Boolean(values.resume)
        const isInline = false
        const model = values.model as string | undefined
        const provider = values.provider as string | undefined
        const baseUrl = values['base-url'] as string | undefined
        const sessionId = values['session-id'] as string | undefined
        const scope = values.scope as string | undefined
        const cwd = values.cwd as string | undefined
        const turn = values.turn ? parseInt(values.turn as string, 10) : undefined
        const list = Boolean(values.list)
        const token = values.token as string | undefined
        const env = values.env
            ? Array.isArray(values.env)
                ? (values.env as string[])
                : [values.env as string]
            : undefined
        const header = values.header
            ? Array.isArray(values.header)
                ? (values.header as string[])
                : [values.header as string]
            : undefined
        const eager = Boolean(values.eager)

        const knownCommands = [
            'login',
            'logout',
            'switch',
            'update',
            'doctor',
            'auth',
            'link',
            'key',
            'resume',
            'changelog',
            'docs',
            'ask',
            'skill',
            'skills',
            'mcp',
            'open',
            'codesearch',
            'rewind',
            'undo',
        ]
        let command: string | undefined
        let prompt: string | undefined

        if (positionals.length > 0) {
            const firstPositional = positionals[0]
            if (knownCommands.includes(firstPositional)) {
                command = firstPositional
            } else {
                prompt = positionals.join(' ')
            }
        }

        return {
            command,
            prompt,
            isHelp,
            isVersion,
            yes,
            json,
            rpc,
            print,
            fix,
            force,
            isGlobal,
            isLocal,
            resume: isResume || command === 'resume',
            isInline,
            model,
            provider,
            baseUrl,
            sessionId,
            scope,
            cwd,
            turn,
            list,
            token,
            env,
            header,
            eager,
            positionals,
        }
    } catch {
        // Intentionally swallowed: return default args on parse failure
        return defaultParsedArgs()
    }
}

export function getHelpText(
    version: string = '0.0.0',
    options?: { mcpServers?: Record<string, any> }
): string {
    let mcpSection = ''
    const mcpServers = options?.mcpServers
    if (mcpServers && Object.keys(mcpServers).length > 0) {
        const lines = Object.entries(mcpServers).map(([name, cfg]) => {
            const type = cfg.command ? 'stdio' : 'sse'
            const target = cfg.command
                ? `${cfg.command}${cfg.args ? ' ' + cfg.args.join(' ') : ''}`
                : cfg.url || cfg.endpoint || cfg.sse || ''
            const disabledStr = cfg.disabled ? ' (disabled)' : ''
            return `  • ${name} (${type})${disabledStr}: ${target}`
        })
        mcpSection = `\nConfigured MCP Servers:\n${lines.join('\n')}\n`
    }

    return `December CLI v${version}
a coding agent that lives in your terminal.

Usage:
  december                          Launch interactive TUI session
  december "<prompt>"               Execute headless agent task
  december ask "<question>"         Ask a question about the codebase (read-only Q&A mode)
  december resume [session-id]      Resume the most recent session or specified session ID
  december auth [status|import]     Inspect active subscriptions and authentication status
  december link <provider>          Link AI subscription (copilot, claude, chatgpt, gemini, etc.)
  december key <provider> [key]     Save BYOK API key (openai, anthropic, deepseek, etc.) [--base-url <url>]
  december login [provider]         Log in to December Cloud or subscription
  december logout [provider]        Remove saved authentication credentials
  december switch [provider]        Switch active provider and restore remembered model
  december mcp [status|list]        Inspect configured and connected MCP servers and tools
  december update                   Update December CLI to the latest version
  december doctor [--fix]           Inspect installations, health, and resolve PATH collisions
  december changelog                Open changelog in your browser
  december docs [section]           Open documentation in your browser
${mcpSection}
Options:
  -h, --help                        Show CLI help and exit
  -v, --version                     Show CLI version and exit
  -r, --resume                      Resume the most recent session
  -y, --yes                         Auto-approve tool permissions (non-interactive mode)
  --inline                          Run in classic inline mode (standard terminal scrollback)
  --json                            Output structured JSON events
  --rpc                             Run in headless RPC mode streaming NDJSON over stdio (default headless)
  --print                           Print raw output text to stdout instead of NDJSON RPC stream
  --fix                             Automatically fix detected PATH collisions and stale links
  -m, --model <model>               Override target LLM model
  -p, --provider <provider>         Override target LLM provider
  --session-id <id>                 Specify session ID
  --scope <dir>                     Confine agent searches and tools to a specific subpackage
  --cwd <dir>                       Set the working directory root
`
}
