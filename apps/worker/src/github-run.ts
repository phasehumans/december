import { prisma } from '@december/database'
import {
    createInstallationToken,
    createIssueComment,
    createPullRequest,
    createPullRequestReview,
    isGithubRun,
    toBranchName,
    toPullRequestSettings,
} from '@december/shared'

import type { GithubRun, ReviewLineComment } from '@december/shared'

/**
 * The GitHub part of a session the December GitHub App started (Session.githubRun):
 * the workspace before the agent, and the push, pull request, review and reply after it.
 * The agent itself runs like any cloud session, so the wallet, model and session page are
 * the normal ones.
 */

type SandboxLike = {
    commands?: {
        run: (
            cmd: string,
            opts?: { cwd?: string; timeoutMs?: number }
        ) => Promise<{ exitCode?: number; stdout?: string; stderr?: string }>
    }
}

const WORKSPACE = '/workspace'
const REVIEW_FILE = '.december/review.json'
const MAX_REVIEW_COMMENTS = 10
const TEST_TIMEOUT_MS = 15 * 60 * 1000

// single quotes for a shell argument
const sh = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`

const run = async (sandbox: SandboxLike, cmd: string, timeoutMs = 120_000) => {
    try {
        const res = await sandbox.commands!.run(cmd, { cwd: WORKSPACE, timeoutMs })
        return {
            exitCode: res?.exitCode ?? 0,
            stdout: res?.stdout || '',
            stderr: res?.stderr || '',
        }
    } catch (err: any) {
        // e2b throws on a non-zero exit; the error carries the result
        return {
            exitCode: typeof err?.exitCode === 'number' ? err.exitCode : 1,
            stdout: err?.stdout || '',
            stderr: err?.stderr || err?.message || String(err),
        }
    }
}

const appUrl = () => (process.env.APP_URL || 'https://app.trydecember.com').replace(/\/+$/, '')

export const sessionLink = (sessionId: string) => `${appUrl()}/session/${sessionId}`

/** a token for the run's installation; the worker needs GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY */
export const getGithubRunToken = async (run: GithubRun): Promise<string | null> => {
    const appId = process.env.GITHUB_APP_ID?.trim()
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.trim()
    if (!appId || !privateKey) {
        console.error(
            '[GITHUB RUN] GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are not set on the worker'
        )
        return null
    }
    try {
        const { token } = await createInstallationToken({
            appId,
            privateKey,
            installationId: run.installationId,
        })
        return token
    } catch (err) {
        console.error('[GITHUB RUN] could not create an installation token:', err)
        return null
    }
}

export const loadGithubRun = async (sessionId: string) => {
    const session = await prisma.session
        .findUnique({
            where: { id: sessionId },
            select: {
                id: true,
                userId: true,
                title: true,
                githubRun: true,
                prNumber: true,
                prUrl: true,
            },
        })
        .catch(() => null)
    if (!session || !isGithubRun(session.githubRun)) return null
    return { ...session, run: session.githubRun as GithubRun & { workBranch?: string } }
}

const authedRemote = (token: string, repoFullName: string) =>
    `https://x-access-token:${token}@github.com/${repoFullName}.git`
const plainRemote = (repoFullName: string) => `https://github.com/${repoFullName}.git`

/**
 * Runs once after the clone, before the agent: the branch for the mode, and a remote without
 * the token, so the agent never sees it. Returns the branch the work happens on.
 */
export const prepareGithubWorkspace = async (data: {
    sandbox: SandboxLike
    sessionId: string
    run: GithubRun
}): Promise<string> => {
    const { sandbox, sessionId, run: githubRun } = data
    const settings = toPullRequestSettings(
        await prisma.pullRequestSettings
            .findFirst({
                where: { user: { sessions: { some: { id: sessionId } } } },
            })
            .catch(() => null)
    )

    // the review file and other run files never go into a commit
    await run(sandbox, `mkdir -p .december && echo '.december/' >> .git/info/exclude`)
    await run(
        sandbox,
        'git config user.name "December" && git config user.email "agent@trydecember.com"'
    )

    let workBranch: string
    if (githubRun.mode === 'review') {
        // works for forks too: the base repository has every pull request head
        workBranch = `december-review-${githubRun.number}`
        await run(
            sandbox,
            `git fetch origin ${sh(`pull/${githubRun.number}/head`)} && git checkout -B ${sh(workBranch)} FETCH_HEAD`,
            300_000
        )
    } else if (githubRun.mode === 'change') {
        workBranch = githubRun.headRef || ''
        await run(sandbox, `git checkout ${sh(workBranch)}`)
    } else {
        workBranch = toBranchName(settings.branchPrefix, `issue-${githubRun.number}`)
        const exists = await run(
            sandbox,
            `git ls-remote --exit-code --heads origin ${sh(workBranch)}`
        )
        if (exists.exitCode === 0) {
            // an earlier run left this branch: never overwrite it
            workBranch = `${workBranch}-${sessionId.slice(0, 6)}`
        }
        await run(sandbox, `git checkout -B ${sh(workBranch)}`)
    }

    await run(sandbox, `git remote set-url origin ${sh(plainRemote(githubRun.repoFullName))}`)

    await prisma.session
        .update({
            where: { id: sessionId },
            data: { githubRun: { ...githubRun, workBranch } as any, prBranch: workBranch },
        })
        .catch((err: unknown) => {
            console.error('[GITHUB RUN] could not save the work branch:', err)
        })

    return workBranch
}

export type TestPlan = { command: string; install?: string } | null

const NO_TEST_SCRIPT = /no test specified/i

/**
 * The repository's own test command from the files at its root. Package scripts win, then
 * go, cargo, pytest and a Makefile "test" target. null means the repository has no tests.
 */
export const pickTestCommand = (data: {
    files: string[]
    texts: Record<string, string>
}): TestPlan => {
    const { files, texts } = data
    const has = (name: string) => files.includes(name)

    if (has('package.json')) {
        let testScript: unknown
        try {
            testScript = JSON.parse(texts['package.json'] || '{}')?.scripts?.test
        } catch {
            // Intentionally swallowed: a broken package.json has no usable test script
            testScript = undefined
        }
        if (
            typeof testScript === 'string' &&
            testScript.trim() &&
            !NO_TEST_SCRIPT.test(testScript)
        ) {
            if (has('bun.lock') || has('bun.lockb')) {
                return { command: 'bun run test', install: 'bun install' }
            }
            if (has('pnpm-lock.yaml')) return { command: 'pnpm test', install: 'pnpm install' }
            if (has('yarn.lock')) return { command: 'yarn test', install: 'yarn install' }
            return { command: 'npm test', install: 'npm install' }
        }
    }
    if (has('go.mod')) return { command: 'go test ./...' }
    if (has('Cargo.toml')) return { command: 'cargo test' }
    if (
        has('pytest.ini') ||
        has('conftest.py') ||
        has('tox.ini') ||
        /pytest/.test(texts['pyproject.toml'] || '') ||
        /pytest/.test(texts['setup.cfg'] || '')
    ) {
        return { command: 'python -m pytest -q' }
    }
    if (/^test\s*:/m.test(texts['Makefile'] || '')) return { command: 'make test' }
    return null
}

export type TestResult =
    | { status: 'passed' | 'failed'; command: string; output: string }
    | { status: 'none' }
    | { status: 'unavailable'; command: string; output: string }

const tail = (text: string, max = 3000) => (text.length > max ? text.slice(-max) : text)

export const runRepositoryTests = async (sandbox: SandboxLike): Promise<TestResult> => {
    const listing = await run(sandbox, 'ls -a')
    const files = listing.stdout
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean)
    const texts: Record<string, string> = {}
    for (const name of ['package.json', 'pyproject.toml', 'setup.cfg', 'Makefile']) {
        if (files.includes(name)) texts[name] = (await run(sandbox, `cat ${sh(name)}`)).stdout
    }

    const plan = pickTestCommand({ files, texts })
    if (!plan) return { status: 'none' }

    if (plan.install && !files.includes('node_modules')) {
        await run(sandbox, plan.install, 10 * 60 * 1000)
    }
    const res = await run(sandbox, plan.command, TEST_TIMEOUT_MS)
    const output = tail(`${res.stdout}\n${res.stderr}`.trim())
    // 127: the tool itself is missing in the sandbox, which says nothing about the code
    if (res.exitCode === 127) return { status: 'unavailable', command: plan.command, output }
    return { status: res.exitCode === 0 ? 'passed' : 'failed', command: plan.command, output }
}

export const describeTests = (result: TestResult): string => {
    switch (result.status) {
        case 'passed':
            return `passed (\`${result.command}\`)`
        case 'failed':
            return `failed (\`${result.command}\`)`
        case 'unavailable':
            return `not run: \`${result.command}\` is not available in the sandbox`
        default:
            return 'no tests found'
    }
}

/** the review the agent wrote to .december/review.json, cleaned; null when there is none */
export const parseReviewFile = (
    text: string
): { summary: string; comments: ReviewLineComment[] } | null => {
    let json: any
    try {
        json = JSON.parse(text)
    } catch {
        // Intentionally swallowed: a broken file means the final message is the review
        return null
    }
    if (!json || typeof json !== 'object') return null
    const summary = typeof json.summary === 'string' ? json.summary.trim() : ''
    const comments: ReviewLineComment[] = (Array.isArray(json.comments) ? json.comments : [])
        .filter(
            (c: any) =>
                c &&
                typeof c.path === 'string' &&
                c.path.trim() &&
                Number.isInteger(c.line) &&
                c.line > 0 &&
                typeof c.body === 'string' &&
                c.body.trim()
        )
        .slice(0, MAX_REVIEW_COMMENTS)
        .map((c: any) => ({
            path: c.path.trim().replace(/^\.?\//, ''),
            line: c.line,
            body: c.body.trim(),
        }))
    if (!summary && comments.length === 0) return null
    return { summary, comments }
}

const footer = (data: { sessionId: string; run: GithubRun }) => {
    const { sessionId, run: githubRun } = data
    const asked =
        githubRun.requestedBy === 'december'
            ? githubRun.trigger === 'failed_checks'
                ? 'Started because checks failed.'
                : 'Started by your December pull request settings.'
            : `Asked by @${githubRun.requestedBy}.`
    return `---\n${asked} [Session](${sessionLink(sessionId)})`
}

const clip = (text: string, max = 6000) =>
    text.length > max ? `${text.slice(0, max)}\n\n[cut]` : text

const reply = async (data: { token: string; run: GithubRun; body: string }) => {
    const { token, run: githubRun, body } = data
    await createIssueComment({
        token,
        owner: githubRun.repoOwner,
        repo: githubRun.repoName,
        issueNumber: githubRun.number,
        body,
    }).catch((err: unknown) => {
        console.error('[GITHUB RUN] could not reply on GitHub:', err)
    })
}

const finishReview = async (data: {
    sandbox: SandboxLike
    token: string
    sessionId: string
    run: GithubRun
    summary: string
}) => {
    const { sandbox, token, sessionId, run: githubRun, summary } = data
    const file = await run(sandbox, `cat ${REVIEW_FILE}`)
    const review = file.exitCode === 0 ? parseReviewFile(file.stdout) : null
    const head = await run(sandbox, 'git rev-parse HEAD')
    const commitId = head.exitCode === 0 ? head.stdout.trim() : githubRun.headSha

    const body = [
        clip(review?.summary || summary.trim() || 'December found nothing to point at.'),
        '',
        footer({ sessionId, run: githubRun }),
    ].join('\n')

    try {
        await createPullRequestReview({
            token,
            owner: githubRun.repoOwner,
            repo: githubRun.repoName,
            pullNumber: githubRun.number,
            body,
            commitId,
            comments: review?.comments ?? [],
        })
    } catch (err) {
        console.error('[GITHUB RUN] could not post the review:', err)
        await reply({ token, run: githubRun, body })
    }
}

const finishWork = async (data: {
    sandbox: SandboxLike
    token: string
    sessionId: string
    run: GithubRun & { workBranch?: string }
    summary: string
    prNumber: number | null
}) => {
    const { sandbox, token, sessionId, run: githubRun, summary, prNumber } = data
    const branch =
        githubRun.workBranch ||
        (githubRun.mode === 'change' ? githubRun.headRef || '' : '') ||
        (await run(sandbox, 'git rev-parse --abbrev-ref HEAD')).stdout.trim()
    // new work is what is not on the remote yet: the pushed branch, or the base before the first push
    const startRef =
        githubRun.mode === 'change' || prNumber ? `origin/${branch}` : `origin/${githubRun.baseRef}`

    const status = await run(sandbox, 'git status --porcelain')
    const ahead = await run(sandbox, `git rev-list --count ${sh(startRef)}..HEAD`)
    const hasChanges = status.stdout.trim().length > 0 || Number(ahead.stdout.trim()) > 0

    // a question, or nothing to change: the answer is the reply
    if (!hasChanges) {
        await reply({
            token,
            run: githubRun,
            body: [
                clip(summary.trim() || 'December made no changes.'),
                '',
                footer({ sessionId, run: githubRun }),
            ].join('\n'),
        })
        return
    }

    const tests = await runRepositoryTests(sandbox)
    if (tests.status === 'failed') {
        await reply({
            token,
            run: githubRun,
            body: [
                `December made changes, but the tests failed, so nothing was pushed. Open the session to continue.`,
                '',
                `Tests: ${describeTests(tests)}`,
                '```',
                tests.output,
                '```',
                '',
                footer({ sessionId, run: githubRun }),
            ].join('\n'),
        })
        return
    }

    const subject =
        githubRun.mode === 'issue'
            ? `fix #${githubRun.number}: ${githubRun.title}`
            : `update #${githubRun.number}: ${githubRun.trigger === 'failed_checks' ? 'fix failed checks' : 'apply requested changes'}`
    await run(sandbox, 'git add -A')
    if (status.stdout.trim()) {
        await run(sandbox, `git commit -m ${sh(subject.slice(0, 120))}`)
    }

    await run(
        sandbox,
        `git remote set-url origin ${sh(authedRemote(token, githubRun.repoFullName))}`
    )
    const push = await run(sandbox, `git push origin ${sh(`HEAD:refs/heads/${branch}`)}`, 180_000)
    await run(sandbox, `git remote set-url origin ${sh(plainRemote(githubRun.repoFullName))}`)

    if (push.exitCode !== 0) {
        await reply({
            token,
            run: githubRun,
            body: [
                `December could not push to \`${branch}\`. Open the session to see the changes.`,
                '',
                footer({ sessionId, run: githubRun }),
            ].join('\n'),
        })
        return
    }

    const testsLine = `**Tests:** ${describeTests(tests)}`

    // a change on a pull request, or a later run on an issue that already has its pull request
    if (githubRun.mode === 'change' || prNumber) {
        await reply({
            token,
            run: githubRun,
            body: [
                clip(summary.trim() || `December pushed changes to \`${branch}\`.`),
                '',
                testsLine,
                '',
                footer({ sessionId, run: githubRun }),
            ].join('\n'),
        })
        return
    }

    const settings = toPullRequestSettings(
        await prisma.pullRequestSettings
            .findFirst({ where: { user: { sessions: { some: { id: sessionId } } } } })
            .catch(() => null)
    )

    try {
        const pr = await createPullRequest({
            token,
            owner: githubRun.repoOwner,
            repo: githubRun.repoName,
            title: githubRun.title,
            head: branch,
            base: githubRun.baseRef,
            draft: settings.prDraft,
            body: [
                clip(summary.trim() || `Changes for #${githubRun.number}.`),
                '',
                `Closes #${githubRun.number}`,
                '',
                testsLine,
                '',
                footer({ sessionId, run: githubRun }),
            ].join('\n'),
        })

        await prisma.session
            .update({
                where: { id: sessionId },
                data: {
                    prNumber: pr.number,
                    prUrl: pr.html_url ?? null,
                    prState: pr.draft ? 'draft' : 'open',
                    prTitle: pr.title ?? githubRun.title,
                    prBranch: branch,
                },
            })
            .catch((err: unknown) => {
                console.error('[GITHUB RUN] could not save the pull request on the session:', err)
            })

        await reply({
            token,
            run: githubRun,
            body: `December opened #${pr.number}. [Session](${sessionLink(sessionId)})`,
        })
    } catch (err) {
        console.error('[GITHUB RUN] could not open the pull request:', err)
        await reply({
            token,
            run: githubRun,
            body: [
                `December pushed \`${branch}\` but could not open a pull request.`,
                '',
                footer({ sessionId, run: githubRun }),
            ].join('\n'),
        })
    }
}

/**
 * The end of an agent run in a github session. Returns false when the session is not a
 * github run, so the caller does its normal end of run instead.
 */
export const finishGithubRun = async (data: {
    sessionId: string
    sandbox: SandboxLike | null | undefined
    hasError: boolean
    summary: string
}): Promise<boolean> => {
    const { sessionId, sandbox, hasError, summary } = data
    const session = await loadGithubRun(sessionId)
    if (!session) return false

    const githubRun = session.run
    const token = await getGithubRunToken(githubRun)
    if (!token) return true

    const askedByPerson = githubRun.requestedBy !== 'december'
    if (hasError || !sandbox?.commands?.run) {
        // automatic runs stay quiet on failure; the session shows what happened
        if (askedByPerson) {
            await reply({
                token,
                run: githubRun,
                body: `December could not finish this run. [Session](${sessionLink(sessionId)})`,
            })
        }
        return true
    }

    try {
        if (githubRun.mode === 'review') {
            await finishReview({ sandbox, token, sessionId, run: githubRun, summary })
        } else {
            await finishWork({
                sandbox,
                token,
                sessionId,
                run: githubRun,
                summary,
                prNumber: session.prNumber,
            })
        }
    } catch (err) {
        console.error(`[GITHUB RUN] the GitHub step failed for session ${sessionId}:`, err)
        if (askedByPerson) {
            await reply({
                token,
                run: githubRun,
                body: `December finished, but the GitHub step failed. [Session](${sessionLink(sessionId)})`,
            })
        }
    }
    return true
}
