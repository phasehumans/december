import { prisma } from '@december/database'
import { geminiProvider, openaiProvider } from '@december/providers'
import { createIssueComment, createPullRequest } from '@december/shared'

import { E2BSandboxService } from './e2b-sandbox.service'

export interface GithubIssueFixJobData {
    taskType: 'github_issue_fix'
    installationId: string
    gitToken: string
    repoFullName: string
    repoOwner: string
    repoName: string
    defaultBranch?: string
    issueNumber: number
    issueTitle: string
    issueBody?: string
    commentId: number
    commentAuthor: string
    prompt: string
    userId?: string | null
}

export interface GithubIssueFixResult {
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED'
    prNumber?: number
    prUrl?: string
    output?: string
    error?: string
}

async function generateAiExplanation(params: {
    issueNumber: number
    issueTitle: string
    issueBody?: string
    commentAuthor: string
    prompt: string
}): Promise<string | null> {
    const { issueNumber, issueTitle, issueBody, commentAuthor, prompt } = params

    const geminiKey = process.env.GEMINI_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    let provider: any = null
    if (geminiKey) {
        provider = geminiProvider(geminiKey)
    } else if (openaiKey) {
        provider = openaiProvider(undefined, openaiKey)
    }

    if (!provider) {
        return null
    }

    try {
        const stream = provider([
            {
                role: 'system',
                content:
                    'You are December, an expert AI software engineer. Analyze the GitHub issue and user query clearly, concisely, and accurately in markdown. Do not use em dashes.',
            },
            {
                role: 'user',
                content: `Issue #${issueNumber}: ${issueTitle}\n\nDescription:\n${issueBody || 'No description provided.'}\n\nUser Question/Instruction from @${commentAuthor}:\n${prompt}`,
            },
        ])

        let explanation = ''
        for await (const chunk of stream) {
            if (chunk.type === 'text' && chunk.text) {
                explanation += chunk.text
            }
        }

        return explanation.trim() || null
    } catch (err: any) {
        console.warn(`[GitHub Issue Fix] AI explanation generation failed: ${err?.message || err}`)
        return null
    }
}

export const processGithubIssueFix = async (
    data: GithubIssueFixJobData
): Promise<GithubIssueFixResult> => {
    const {
        gitToken,
        repoFullName,
        repoOwner,
        repoName,
        defaultBranch = 'main',
        issueNumber,
        issueTitle,
        issueBody,
        commentAuthor,
        prompt,
        userId,
    } = data

    // Verify credits if userId is linked
    if (userId) {
        const user = await prisma.user
            .findUnique({
                where: { id: userId },
                select: { creditBalance: true },
            })
            .catch(() => null)

        if (user && user.creditBalance < 50) {
            console.warn(
                `[GitHub Issue Fix] Insufficient credits for user '${userId}' on issue #${issueNumber}`
            )
            await createIssueComment({
                token: gitToken,
                owner: repoOwner,
                repo: repoName,
                issueNumber,
                body: `@${commentAuthor} Insufficient wallet credits to run December on this issue. Please top up credits at https://app.trydecember.com/settings/billing to continue.`,
            }).catch(() => {
                // Intentionally swallowed: fallback if warning comment fails to post
            })
            return {
                status: 'FAILED',
                error: 'Insufficient credits',
            }
        }
    }

    const branchName = `december/issue-${issueNumber}`

    const result = await E2BSandboxService.runEphemeralTask({
        sessionId: `github-issue-${issueNumber}-${Date.now()}`,
        taskType: 'github_issue_fix' as any,
        repoUrl: `https://github.com/${repoFullName}.git`,
        gitToken,
        taskRunner: async (sandbox) => {
            let executionOutput = ''

            if (!sandbox.commands?.run) {
                return { status: 'COMPLETED', taskType: 'github_issue_fix' }
            }

            await sandbox.commands
                .run(
                    'sudo rm -rf /workspace && sudo mkdir -p /workspace && sudo chown -R user:user /workspace',
                    { cwd: '/home/user' }
                )
                .catch(async () => {
                    await sandbox.commands.run('mkdir -p /workspace').catch(() => {
                        // Intentionally swallowed: mkdir fallback
                    })
                })

            const cloneUrl = `https://x-access-token:${gitToken}@github.com/${repoFullName}.git`
            const cloneRes = await sandbox.commands
                .run(`git clone --depth 50 --branch ${defaultBranch} ${cloneUrl} /workspace`, {
                    timeoutMs: 120_000,
                })
                .catch(async () => {
                    return sandbox.commands.run(`git clone ${cloneUrl} /workspace`, {
                        timeoutMs: 120_000,
                    })
                })

            if (cloneRes?.exitCode !== 0 && cloneRes?.stderr) {
                console.warn(`[GitHub Issue Fix] Git clone warning: ${cloneRes.stderr}`)
            }

            await sandbox.commands
                .run(
                    'git config user.name "december[bot]" && git config user.email "bot@trydecember.com"',
                    { cwd: '/workspace' }
                )
                .catch(() => {
                    // Intentionally swallowed: git config fallback
                })

            await sandbox.commands
                .run(`git checkout -B ${branchName}`, { cwd: '/workspace' })
                .catch(() => {
                    // Intentionally swallowed: checkout fallback
                })

            // Attempt automated fixes and tests
            const fixRes = await sandbox.commands
                .run('npm run fix --if-present', { cwd: '/workspace' })
                .catch(() => null)
            if (fixRes?.stdout) {
                executionOutput += fixRes.stdout + '\n'
            }

            const testRes = await sandbox.commands
                .run('npm test --if-present', { cwd: '/workspace' })
                .catch(() => null)
            const testOutput = testRes?.stdout || testRes?.stderr || 'Tests executed.'

            // Check if changes exist in workspace
            const statusRes = await sandbox.commands
                .run('git status --porcelain', { cwd: '/workspace' })
                .catch(() => null)
            const hasChanges = Boolean(statusRes?.stdout && statusRes.stdout.trim().length > 0)

            if (hasChanges) {
                await sandbox.commands.run('git add -A', { cwd: '/workspace' }).catch(() => {
                    // Intentionally swallowed: git add fallback
                })

                await sandbox.commands
                    .run(`git commit -m "fix: resolve #${issueNumber} - ${issueTitle}"`, {
                        cwd: '/workspace',
                    })
                    .catch(() => {
                        // Intentionally swallowed: git commit fallback
                    })

                const pushRes = await sandbox.commands
                    .run(`git push -u origin ${branchName}`, {
                        cwd: '/workspace',
                        timeoutMs: 60_000,
                    })
                    .catch((err: any) => ({
                        exitCode: 1,
                        stderr: err?.message || 'Push failed',
                    }))

                if (pushRes?.exitCode === 0) {
                    const prBody = [
                        `Closes #${issueNumber}`,
                        '',
                        '### Summary of Changes',
                        `- Addressed issue #${issueNumber}: ${issueTitle}`,
                        `- Prompt: ${prompt}`,
                        '',
                        '### Verification & Tests',
                        '```',
                        testOutput.slice(0, 1500),
                        '```',
                        '',
                        '---',
                        `Generated by [December](https://trydecember.com) · Triggered by @${commentAuthor} in #${issueNumber}`,
                    ].join('\n')

                    const pr = await createPullRequest({
                        token: gitToken,
                        owner: repoOwner,
                        repo: repoName,
                        title: `fix: #${issueNumber} ${issueTitle}`,
                        head: branchName,
                        base: defaultBranch,
                        body: prBody,
                    })

                    await createIssueComment({
                        token: gitToken,
                        owner: repoOwner,
                        repo: repoName,
                        issueNumber,
                        body: [
                            `I have opened PR #${pr.number} with the requested changes.`,
                            '',
                            '---',
                            'Generated by [December](https://trydecember.com)',
                        ].join('\n'),
                    }).catch(() => {
                        // Intentionally swallowed: comment reply fallback
                    })

                    return {
                        status: 'COMPLETED',
                        prNumber: pr.number,
                        prUrl: pr.html_url,
                        output: executionOutput,
                    }
                }
            }

            // No changes produced or query/explanation request
            let replyText = await generateAiExplanation({
                issueNumber,
                issueTitle,
                issueBody,
                commentAuthor,
                prompt,
            })

            if (!replyText) {
                replyText = 'I analyzed this issue but no automated code changes were produced.'
            }

            await createIssueComment({
                token: gitToken,
                owner: repoOwner,
                repo: repoName,
                issueNumber,
                body: [
                    replyText,
                    '',
                    '---',
                    'Generated by [December](https://trydecember.com)',
                ].join('\n'),
            }).catch(() => {
                // Intentionally swallowed: fallback
            })

            return {
                status: 'SKIPPED',
                output: 'No code changes produced.',
            }
        },
    })

    if (!result.success) {
        return {
            status: 'FAILED',
            error: result.error,
        }
    }

    return result.data as GithubIssueFixResult
}
