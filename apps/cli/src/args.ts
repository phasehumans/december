import { parseArgs } from 'node:util'

export interface ParsedCliArgs {
    command?: string
    prompt?: string
    isHelp: boolean
    isVersion: boolean
    yes: boolean
    json: boolean
    fix: boolean
    force: boolean
    isGlobal: boolean
    isLocal: boolean
    resume: boolean
    model?: string
    provider?: string
    sessionId?: string
    scope?: string
    cwd?: string
    positionals: string[]
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
    try {
        const { values, positionals } = parseArgs({
            args,
            options: {
                help: { type: 'boolean', short: 'h' },
                version: { type: 'boolean', short: 'v' },
                yes: { type: 'boolean', short: 'y' },
                json: { type: 'boolean' },
                fix: { type: 'boolean' },
                force: { type: 'boolean', short: 'f' },
                global: { type: 'boolean', short: 'g' },
                local: { type: 'boolean', short: 'l' },
                resume: { type: 'boolean', short: 'r' },
                model: { type: 'string', short: 'm' },
                provider: { type: 'string', short: 'p' },
                'session-id': { type: 'string' },
                scope: { type: 'string' },
                cwd: { type: 'string' },
            },
            allowPositionals: true,
            strict: false,
        })

        const isHelp = Boolean(values.help)
        const isVersion = Boolean(values.version)
        const yes = Boolean(values.yes)
        const json = Boolean(values.json)
        const fix = Boolean(values.fix)
        const force = Boolean(values.force)
        const isGlobal = Boolean(values.global)
        const isLocal = Boolean(values.local)
        const isResume = Boolean(values.resume)
        const model = values.model as string | undefined
        const provider = values.provider as string | undefined
        const sessionId = values['session-id'] as string | undefined
        const scope = values.scope as string | undefined
        const cwd = values.cwd as string | undefined

        const knownCommands = [
            'login',
            'logout',
            'switch',
            'init',
            'update',
            'doctor',
            'auth',
            'link',
            'key',
            'resume',
            'docs',
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
            fix,
            force,
            isGlobal,
            isLocal,
            resume: isResume || command === 'resume',
            model,
            provider,
            sessionId,
            scope,
            cwd,
            positionals,
        }
    } catch {
        // Intentionally swallowed: return default args on parse failure
        return {
            isHelp: false,
            isVersion: false,
            yes: false,
            json: false,
            fix: false,
            force: false,
            isGlobal: false,
            isLocal: false,
            resume: false,
            positionals: [],
        }
    }
}

export function getHelpText(version: string = '0.0.0'): string {
    return `December CLI v${version}
a coding agent that lives in your terminal.

Usage:
  december                          Launch interactive TUI session
  december "<prompt>"               Execute headless agent task
  december resume [session-id]      Resume the most recent session or specified session ID
  december auth [status|import]     Inspect active subscriptions and authentication status
  december link <provider>          Link AI subscription (copilot, claude, chatgpt, gemini)
  december key <provider> [key]     Save BYOK API key (openai, anthropic, openrouter, etc.)
  december login [provider]         Log in to December Cloud or subscription
  december logout [provider]        Remove saved authentication credentials
  december switch [provider]        Switch active provider and restore remembered model
  december init                     Initialize local .december configuration
  december update                   Update December CLI to the latest version
  december doctor [--fix]           Inspect installations, health, and resolve PATH collisions
  december docs [section]           Open documentation in your browser

Options:
  -h, --help                        Show CLI help and exit
  -v, --version                     Show CLI version and exit
  -r, --resume                      Resume the most recent session
  -y, --yes                         Auto-approve tool permissions (non-interactive mode)
  --json                            Output structured JSON events
  --fix                             Automatically fix detected PATH collisions and stale links
  -m, --model <model>               Override target LLM model
  -p, --provider <provider>         Override target LLM provider
  --session-id <id>                 Specify session ID
  --scope <dir>                     Confine agent searches and tools to a specific subpackage
  --cwd <dir>                       Set the working directory root
`
}
