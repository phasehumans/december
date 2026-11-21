import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * /github: sets up the December GitHub Action (packages/action) for the current repo.
 * Every GitHub call goes through the `gh` CLI, so it uses the user's own gh login.
 */

/** providers the action supports, with their action input and default secret name */
export const ACTION_PROVIDERS = {
    gemini: { input: 'gemini_api_key', secret: 'GEMINI_API_KEY' },
    openai: { input: 'openai_api_key', secret: 'OPENAI_API_KEY' },
    anthropic: { input: 'anthropic_api_key', secret: 'ANTHROPIC_API_KEY' },
    openrouter: { input: 'openrouter_api_key', secret: 'OPENROUTER_API_KEY' },
} as const

export type ActionProvider = keyof typeof ACTION_PROVIDERS

export const SLACK_SECRET = 'DECEMBER_SLACK_WEBHOOK'
export const DISCORD_SECRET = 'DECEMBER_DISCORD_WEBHOOK'
export const WORKFLOW_RELATIVE_PATH = path.join('.github', 'workflows', 'december.yml')

/** maps a December provider to the provider the action runs with */
export function toActionProvider(provider?: string): ActionProvider | null {
    const p = (provider || '').toLowerCase()
    if (p === 'gemini' || p === 'google') return 'gemini'
    if (p === 'openai') return 'openai'
    if (p === 'anthropic') return 'anthropic'
    if (p === 'openrouter') return 'openrouter'
    return null
}

/** subscription logins (oauth) cannot run in CI; the action needs an API key */
export function isSubscriptionProvider(provider?: string): boolean {
    return ['claude', 'codex', 'copilot'].includes((provider || '').toLowerCase())
}

export interface GithubSetupStatus {
    ghInstalled: boolean
    ghAuthed: boolean
    ghAuthDetail?: string
    repo?: string
    defaultBranch: string
    gitRoot?: string
    workflowPath?: string
    workflowExists: boolean
    secrets: string[]
    secretsError?: string
}

function runGh(args: string[], cwd: string, input?: string) {
    return spawnSync('gh', args, {
        cwd,
        input,
        encoding: 'utf-8',
        timeout: 20_000,
        stdio: ['pipe', 'pipe', 'pipe'],
    })
}

function findGitRoot(cwd: string): string | undefined {
    const res = spawnSync('git', ['rev-parse', '--show-toplevel'], {
        cwd,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    })
    const root = res.status === 0 ? res.stdout.trim() : ''
    return root || undefined
}

export function getGithubSetupStatus(cwd: string): GithubSetupStatus {
    const gitRoot = findGitRoot(cwd)
    const workflowPath = gitRoot ? path.join(gitRoot, WORKFLOW_RELATIVE_PATH) : undefined
    const status: GithubSetupStatus = {
        ghInstalled: false,
        ghAuthed: false,
        defaultBranch: 'main',
        gitRoot,
        workflowPath,
        workflowExists: workflowPath ? fs.existsSync(workflowPath) : false,
        secrets: [],
    }

    const version = runGh(['--version'], cwd)
    if (version.error || version.status !== 0) return status
    status.ghInstalled = true

    const auth = runGh(['auth', 'status'], cwd)
    status.ghAuthed = auth.status === 0
    if (!status.ghAuthed) {
        status.ghAuthDetail = (auth.stderr || auth.stdout || '').trim().split('\n')[0]
        return status
    }

    if (!gitRoot) return status
    const repo = runGh(
        [
            'repo',
            'view',
            '--json',
            'nameWithOwner,defaultBranchRef',
            '-q',
            '.nameWithOwner + " " + .defaultBranchRef.name',
        ],
        gitRoot
    )
    if (repo.status === 0) {
        const [name, branch] = repo.stdout.trim().split(' ')
        status.repo = name || undefined
        if (branch) status.defaultBranch = branch
    }
    if (!status.repo) return status

    const secrets = runGh(['secret', 'list', '--json', 'name', '-q', '.[].name'], gitRoot)
    if (secrets.status === 0) {
        status.secrets = secrets.stdout
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
    } else {
        status.secretsError = (secrets.stderr || '').trim().split('\n')[0]
    }
    return status
}

export function buildWorkflowYaml(options: {
    provider: ActionProvider
    secretName: string
    baseBranch: string
}): string {
    const { input } = ACTION_PROVIDERS[options.provider]
    return `name: December
on:
    issue_comment:
        types: [created]
    pull_request:
        types: [opened]

permissions:
    contents: write
    pull-requests: write
    issues: write

jobs:
    december:
        runs-on: ubuntu-latest
        if: |
            (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@trydecember')) ||
            (github.event_name == 'pull_request' && contains(github.event.pull_request.body, '@trydecember'))
        steps:
            - uses: actions/checkout@v4
            - uses: trydecember/action@v1
              with:
                  provider: ${options.provider}
                  ${input}: \${{ secrets.${options.secretName} }}
                  base_branch: ${options.baseBranch}
                  slack_webhook: \${{ secrets.${SLACK_SECRET} }}
                  discord_webhook: \${{ secrets.${DISCORD_SECRET} }}
`
}

/** writes .github/workflows/december.yml at the repo root. Refuses to overwrite unless asked. */
export function writeDecemberWorkflow(options: {
    gitRoot: string
    provider: ActionProvider
    secretName: string
    baseBranch: string
    overwrite?: boolean
}): string {
    const target = path.join(options.gitRoot, WORKFLOW_RELATIVE_PATH)
    if (fs.existsSync(target) && !options.overwrite) {
        throw new Error(`${WORKFLOW_RELATIVE_PATH} already exists.`)
    }
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, buildWorkflowYaml(options), 'utf-8')
    return target
}

/**
 * Sets a repository secret with `gh secret set`. The value goes through stdin,
 * so it is not visible in the process list or shell history.
 */
export function setGithubSecret(cwd: string, name: string, value: string): void {
    if (!/^[A-Z_][A-Z0-9_]*$/i.test(name)) throw new Error(`Invalid secret name: ${name}`)
    if (!value.trim()) throw new Error('The secret value is empty.')
    const res = runGh(['secret', 'set', name], cwd, value.trim())
    if (res.error) throw res.error
    if (res.status !== 0) {
        throw new Error((res.stderr || res.stdout || 'gh secret set failed').trim().split('\n')[0])
    }
}

export interface GithubProviderPlan {
    provider: ActionProvider
    secretName: string
    /** a saved BYOK key for `provider`, if there is one */
    savedKey?: string
    note?: string
}

/**
 * Picks the provider the action runs with: the active provider when the action supports
 * it and a key is saved, else the first supported provider with a saved key, else the
 * active (or default) provider without a key.
 */
export function resolveGithubProvider(config: {
    activeProvider?: string
    providers?: Record<string, string>
}): GithubProviderPlan {
    const providers = config.providers || {}
    const savedKeyFor = (p: ActionProvider): string | undefined => {
        const aliases = p === 'gemini' ? ['gemini', 'google'] : [p]
        for (const a of aliases) {
            const key = providers[a]
            if (typeof key === 'string' && key.trim()) return key
        }
        return undefined
    }

    const active = toActionProvider(config.activeProvider)
    if (active && savedKeyFor(active)) {
        return {
            provider: active,
            secretName: ACTION_PROVIDERS[active].secret,
            savedKey: savedKeyFor(active),
        }
    }
    for (const p of Object.keys(ACTION_PROVIDERS) as ActionProvider[]) {
        const key = savedKeyFor(p)
        if (key) {
            return {
                provider: p,
                secretName: ACTION_PROVIDERS[p].secret,
                savedKey: key,
                note: `The action uses ${p} because it supports gemini, openai, anthropic, and openrouter.`,
            }
        }
    }
    const provider = active || 'gemini'
    return {
        provider,
        secretName: ACTION_PROVIDERS[provider].secret,
        note: isSubscriptionProvider(config.activeProvider)
            ? `Subscription logins do not work in CI. Press k to add a ${provider} API key.`
            : `Press k to add a ${provider} API key.`,
    }
}
