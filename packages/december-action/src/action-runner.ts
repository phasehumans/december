import { exec } from 'node:child_process'
import fs from 'node:fs'
import { promisify } from 'node:util'

import {
    createIssueComment,
    createPullRequest,
    extractBotMention,
    sendTaskNotification,
} from '@december/shared'

const execAsync = promisify(exec)

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
                error: 'No @december mention found in event comment or body',
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
    const geminiKey = process.env.GEMINI_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const openrouterKey = process.env.OPENROUTER_API_KEY

    if (geminiKey || openaiKey || anthropicKey || openrouterKey) {
        try {
            let providerInstance: any = null
            if (geminiKey) {
                const { geminiProvider } = await import('@december/providers')
                providerInstance = geminiProvider(geminiKey)
            } else if (openaiKey) {
                const { openaiProvider } = await import('@december/providers')
                providerInstance = openaiProvider(undefined, openaiKey)
            } else if (anthropicKey) {
                const { anthropicProvider } = await import('@december/providers')
                providerInstance = anthropicProvider(anthropicKey)
            } else if (openrouterKey) {
                const { openrouterProvider } = await import('@december/providers')
                providerInstance = openrouterProvider(openrouterKey)
            }

            if (providerInstance) {
                const { AgentHarness, runAgentLoop } = await import('@december/agent')
                const { CORE_TOOLS } = await import('@december/tools')
                const localOps = {
                    executeBash: async (cmd: string) => {
                        const r = await runCmd(cmd, cwd)
                        return { output: r.stdout || r.stderr, exitCode: r.exitCode }
                    },
                    readFile: async (p: string) => fs.promises.readFile(p, 'utf8'),
                    writeFile: async (p: string, c: string) => fs.promises.writeFile(p, c, 'utf8'),
                }

                const harness = new AgentHarness({
                    llm: providerInstance,
                    tools: CORE_TOOLS,
                    operations: localOps as any,
                    workspaceDir: cwd,
                    sessionId: `action-${Date.now()}`,
                    runtime: 'cli',
                    modelOptions: {
                        model: options.model || process.env.INPUT_MODEL || 'gemini-2.5-flash',
                    },
                })
                const agent = harness.getAgent()
                for await (const _ of runAgentLoop(agent, prompt)) {
                    // Intentionally streaming progress
                }
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
