import { exec } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'

import {
    createIssueComment,
    createPullRequest,
    extractBotMention,
    sendTaskNotification,
} from '@december/shared'

import { createActionOperations } from './action-operations'

const execAsync = promisify(exec)

export type ActionProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter'

const PROVIDER_ORDER: ActionProvider[] = ['gemini', 'openai', 'anthropic', 'openrouter']

/**
 * Use the `provider` input when it has a key. Otherwise use the first provider that has a key.
 */
export function resolveActionProvider(
    requested: string | undefined,
    keys: Record<ActionProvider, string | undefined>
): ActionProvider | undefined {
    const normalized = (requested || '').toLowerCase().trim()
    const wanted = (normalized === 'google' ? 'gemini' : normalized) as ActionProvider
    if (PROVIDER_ORDER.includes(wanted) && keys[wanted]) return wanted
    return PROVIDER_ORDER.find((name) => Boolean(keys[name]))
}

export interface DecemberActionOptions {
    prompt?: string
    githubToken?: string
    model?: string
    provider?: string
    branch?: string
    baseBranch?: string
    createPr?: boolean
    prTitle?: string
    slackWebhookUrl?: string
    discordWebhookUrl?: string
    eventJson?: string
    eventPath?: string
    repository?: string
    cwd?: string
    runCommand?: (
        cmd: string,
        cwd: string
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export interface DecemberActionResult {
    success: boolean
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
    branch?: string
    prNumber?: number
    prUrl?: string
    error?: string
}

const defaultRunCommand = async (
    cmd: string,
    cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    try {
        const { stdout, stderr } = await execAsync(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 })
        return { stdout, stderr, exitCode: 0 }
    } catch (err: any) {
        return {
            stdout: err?.stdout || '',
            stderr: err?.stderr || err?.message || '',
            exitCode: typeof err?.code === 'number' ? err.code : 1,
        }
    }
}

/**
 * Picks the action's model from what the provider serves for this key (#619, D1/D5).
 * The action's `gemini` is an ai studio key, so its models come from the `google` list.
 * A requested model the key cannot use is replaced, with a warning, instead of failing mid-run.
 */
export async function resolveActionModel(
    provider: ActionProvider,
    apiKey: string,
    requested?: string,
    fetchFn: typeof fetch = fetch
): Promise<string> {
    const providers = await import('@december/providers')
    const listProvider = provider === 'gemini' ? 'google' : provider
    const live = await providers.fetchProviderModelIds(listProvider, apiKey, undefined, fetchFn)
    if (live.ok === false) {
        if (live.reason === 'bad_key') {
            throw new Error(
                `${provider} rejected the API key${live.message ? `: ${live.message}` : '.'} Check the repository secret.`
            )
        }
        if (live.reason === 'forbidden') {
            console.warn(
                `[December Action] ${provider} refused the key${live.message ? `: ${live.message}` : '.'}`
            )
        }
        return requested || providers.pickCatalogModel(listProvider) || 'gemini-3.8-flash'
    }
    const served = (id: string) => live.ids.some((m) => m.toLowerCase() === id.toLowerCase())
    if (requested && served(requested)) return requested
    const picked = providers.pickPreferredModel(
        listProvider,
        live.ids,
        requested ? [requested] : []
    )
    if (requested) {
        console.warn(
            `[December Action] ${provider} does not serve '${requested}' for this key. Using '${picked}'.`
        )
    }
    return picked || requested || providers.pickCatalogModel(listProvider) || 'gemini-3.8-flash'
}

export async function runDecemberAction(
    options: DecemberActionOptions
): Promise<DecemberActionResult> {
    const cwd = options.cwd || process.cwd()
    const runCmd = options.runCommand || defaultRunCommand
    const githubToken =
        options.githubToken || process.env.INPUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN
    const repository = options.repository || process.env.GITHUB_REPOSITORY || ''
    const [repoOwner, repoName] = repository.split('/')
    const baseBranch = options.baseBranch || process.env.INPUT_BASE_BRANCH || 'main'
    const createPr = options.createPr ?? process.env.INPUT_CREATE_PR !== 'false'
    const slackWebhookUrl =
        options.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL || process.env.INPUT_SLACK_WEBHOOK
    const discordWebhookUrl =
        options.discordWebhookUrl ||
        process.env.DISCORD_WEBHOOK_URL ||
        process.env.INPUT_DISCORD_WEBHOOK

    // Parse event payload if available
    let eventData: any = null
    if (options.eventJson) {
        try {
            eventData = JSON.parse(options.eventJson)
        } catch {
            // Intentionally swallowed: fallback to null if JSON parsing fails
        }
    } else if (options.eventPath || process.env.GITHUB_EVENT_PATH) {
        const filePath = options.eventPath || process.env.GITHUB_EVENT_PATH!
        try {
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf8')
                eventData = JSON.parse(raw)
            }
        } catch {
            // Intentionally swallowed: event file read fallback
        }
    }

    const issueNumber: number | undefined =
        eventData?.issue?.number || eventData?.pull_request?.number
    const issueTitle: string =
        eventData?.issue?.title || eventData?.pull_request?.title || 'GitHub Task'
    const commentAuthor: string =
        eventData?.comment?.user?.login || eventData?.pull_request?.user?.login || 'github-actions'
    const commentBody: string | undefined =
        eventData?.comment?.body || eventData?.pull_request?.body

    // Resolve instruction / prompt
    let prompt = options.prompt || process.env.INPUT_PROMPT
    if (!prompt && commentBody) {
        const mention = extractBotMention(commentBody)
        if (!mention.isMentioned) {
            return {
                success: true,
                status: 'SKIPPED',
                error: 'No @trydecember mention found in event comment or body',
            }
        }
        prompt = mention.instruction
    }

    if (!prompt || prompt.trim().length === 0) {
        return {
            success: false,
            status: 'FAILED',
            error: 'No prompt provided for December action',
        }
    }

    const branchName =
        options.branch ||
        process.env.INPUT_BRANCH ||
        (issueNumber ? `december/issue-${issueNumber}` : `december/task-${Date.now()}`)

    // Configure git user
    await runCmd('git config user.name "december[bot]"', cwd)
    await runCmd('git config user.email "bot@trydecember.com"', cwd)

    // Checkout dedicated task branch
    await runCmd(`git checkout -B ${branchName}`, cwd)

    // Execute agent loop if BYOK provider credentials exist
    const providerKeys: Record<ActionProvider, string | undefined> = {
        gemini: process.env.GEMINI_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        anthropic: process.env.ANTHROPIC_API_KEY,
        openrouter: process.env.OPENROUTER_API_KEY,
    }
    const provider = resolveActionProvider(
        options.provider || process.env.INPUT_PROVIDER,
        providerKeys
    )

    if (provider) {
        try {
            const providers = await import('@december/providers')
            const apiKey = providerKeys[provider]!
            const providerInstance =
                provider === 'gemini'
                    ? providers.geminiProvider(apiKey)
                    : provider === 'openai'
                      ? providers.openaiProvider(undefined, apiKey)
                      : provider === 'anthropic'
                        ? providers.anthropicProvider(apiKey)
                        : providers.openrouterProvider(apiKey)
            const model = await resolveActionModel(
                provider,
                apiKey,
                options.model || process.env.INPUT_MODEL
            )

            const { AgentHarness, runAgentLoop } = await import('@december/agent')
            const { CORE_TOOLS } = await import('@december/tools')

            const harness = new AgentHarness({
                llm: providerInstance,
                tools: CORE_TOOLS,
                operations: createActionOperations(cwd),
                workspaceDir: cwd,
                sessionId: `action-${Date.now()}`,
                runtime: 'cli',
                modelOptions: { model },
            })
            const agent = harness.getAgent()
            for await (const _ of runAgentLoop(agent, prompt)) {
                // Intentionally streaming progress
            }
        } catch (agentErr: any) {
            // Intentionally swallowed: action agent runner fallback
            console.warn(`[December Action] Agent loop warning: ${agentErr?.message || agentErr}`)
        }
    }

    // Run tests / linter to verify workspace state
    const testRes = await runCmd('npm test --if-present', cwd)
    const testOutput = testRes.stdout || testRes.stderr || 'Tests executed.'
    const isCleanTestExit = testRes.exitCode === 0

    // Check git status for modified files
    const statusRes = await runCmd('git status --porcelain', cwd)
    const statusStdout = statusRes.stdout || ''
    const hasChanges = Boolean(statusStdout.trim().length > 0)
    const modifiedFiles = statusStdout
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 2)
        .map((line: string) => line.slice(2).trim())

    if (hasChanges && !isCleanTestExit) {
        return {
            success: false,
            status: 'FAILED',
            error: 'Test suite failed to exit cleanly',
        }
    }

    let createdPrNumber: number | undefined
    let createdPrUrl: string | undefined

    if (hasChanges) {
        const cleanTitle = issueTitle.toLowerCase()
        await runCmd('git add -A', cwd)
        await runCmd(
            `git commit -m "fix: resolve ${issueNumber ? `#${issueNumber} - ` : ''}${cleanTitle}"`,
            cwd
        )

        if (githubToken && repoOwner && repoName) {
            const pushRes = await runCmd(`git push -u origin ${branchName}`, cwd)

            if (createPr && pushRes.exitCode === 0) {
                const prBodyLines = [
                    issueNumber ? `Closes #${issueNumber}` : 'Automated fix from December action',
                    '',
                    '### Summary of Changes',
                    `- Addressed: ${prompt}`,
                    '',
                ]

                if (modifiedFiles.length > 0) {
                    prBodyLines.push('### Modified Files')
                    for (const file of modifiedFiles) {
                        prBodyLines.push(`- \`${file}\``)
                    }
                    prBodyLines.push('')
                }

                if (testOutput && testOutput.trim() !== 'Tests executed.') {
                    prBodyLines.push(
                        '### Verification & Tests',
                        '```',
                        testOutput.slice(0, 1500),
                        '```',
                        ''
                    )
                }

                prBodyLines.push(
                    '---',
                    `Triggered by @${commentAuthor}${issueNumber ? ` in #${issueNumber}` : ''}`
                )

                try {
                    const pr = await createPullRequest({
                        token: githubToken,
                        owner: repoOwner,
                        repo: repoName,
                        title:
                            options.prTitle?.toLowerCase() ||
                            `fix: ${issueNumber ? `#${issueNumber} ` : ''}${cleanTitle}`,
                        head: branchName,
                        base: baseBranch,
                        body: prBodyLines.join('\n'),
                    })

                    createdPrNumber = pr.number
                    createdPrUrl = pr.html_url

                    if (issueNumber) {
                        await createIssueComment({
                            token: githubToken,
                            owner: repoOwner,
                            repo: repoName,
                            issueNumber,
                            body: `I have opened PR #${pr.number} with the requested changes.`,
                        }).catch(() => {
                            // Intentionally swallowed: comment reply fallback
                        })
                    }
                } catch (prErr: any) {
                    console.warn(
                        `[December Action] Pull request creation warning: ${prErr?.message || prErr}`
                    )
                }
            }
        }
    }

    // Webhook notifications dispatch
    await sendTaskNotification({
        taskType: 'github_action_run',
        status: 'COMPLETED',
        repoFullName: repository,
        issueNumber: issueNumber || 0,
        issueTitle,
        prNumber: createdPrNumber,
        prUrl: createdPrUrl,
        summary: hasChanges
            ? `Changes committed and pushed on branch ${branchName}`
            : 'Action completed with no code changes',
        slackWebhookUrl,
        discordWebhookUrl,
    }).catch(() => {
        // Intentionally swallowed: webhook notification fallback
    })

    return {
        success: true,
        status: 'COMPLETED',
        branch: branchName,
        prNumber: createdPrNumber,
        prUrl: createdPrUrl,
    }
}
