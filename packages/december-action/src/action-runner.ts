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

    // Run tests / linter to verify workspace state
    const testRes = await runCmd('npm test --if-present', cwd)
    const testOutput = testRes.stdout || testRes.stderr || 'Tests executed.'

    // Check git status for modified files
    const statusRes = await runCmd('git status --porcelain', cwd)
    const statusStdout = statusRes.stdout || ''
    const hasChanges = Boolean(statusStdout.trim().length > 0)
    const modifiedFiles = statusStdout
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 2)
        .map((line: string) => line.slice(2).trim())

    let createdPrNumber: number | undefined
    let createdPrUrl: string | undefined

    if (hasChanges) {
        await runCmd('git add -A', cwd)
        await runCmd(
            `git commit -m "fix: resolve ${issueNumber ? `#${issueNumber} - ` : ''}${issueTitle}"`,
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
                            options.prTitle ||
                            `fix: ${issueNumber ? `#${issueNumber} ` : ''}${issueTitle}`,
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
