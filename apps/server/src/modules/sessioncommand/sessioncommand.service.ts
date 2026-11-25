import { getModelDetails } from '@december/providers'
import { buildRestoreCommand, buildReviewPrompt, parsePullRequestUrl } from '@december/shared'

import { AppError } from '../../shared/appError'
import { appCache } from '../../shared/cache'
import { cliDispatcher } from '../cli/cli.dispatcher'
import { executeSandboxCommand } from '../platform/platform.utils'
import { sessionService } from '../session/session.service'
import { usageService } from '../usage/usage.service'

import { sessionCommandRepository } from './sessioncommand.repository'
import {
    AGENT_OVERHEAD_TOKENS,
    COMMAND_MODEL,
    COMPACT_SYSTEM_PROMPT,
    SIDE_QUESTION_SYSTEM_PROMPT,
    TASKS_COMMAND,
    TITLE_SYSTEM_PROMPT,
    buildCodeSearchCommand,
    buildTranscript,
    cleanTitle,
    estimateTokens,
    messageText,
    parseCodeSearchOutput,
    parseTasksOutput,
} from './sessioncommand.utils'

import type {
    AskSideQuestion,
    CompactSession,
    ContextUsage,
    GetCheck,
    RewindSession,
    RunCommandPrompt,
    SearchSessionCode,
    SessionRef,
    StartReview,
} from './sessioncommand.types'

type CommandSession = NonNullable<Awaited<ReturnType<typeof sessionCommandRepository.findSession>>>

const WORKING_STATUSES = ['PROVISIONING', 'RUNNING']

const loadSession = async (data: SessionRef): Promise<CommandSession> => {
    const { userId, sessionId } = data
    const session = await sessionCommandRepository.findSession(sessionId, userId)
    if (!session) throw new AppError('Session not found', 404)
    return session
}

/** commands that change the conversation wait until the agent stops */
const assertIdle = (session: CommandSession) => {
    if (WORKING_STATUSES.includes(session.vmStatus)) {
        throw new AppError(
            'December is working in this session. Stop it or wait until it ends.',
            409
        )
    }
}

const clearListCache = async (userId: string) => {
    await appCache.delPattern(appCache.key('sessions', 'recent', userId, '*'))
}

/** runs a command in the session machine; the machine must exist (running or paused) */
const runInSandbox = async (session: CommandSession, command: string, timeoutMs = 30_000) => {
    const hasMachine =
        session.vmId && (session.sandboxStatus === 'RUNNING' || session.sandboxStatus === 'PAUSED')
    if (!hasMachine) {
        throw new AppError('This session has no machine. Send a message to start one.', 409)
    }
    return executeSandboxCommand({
        sandboxId: session.vmId,
        sessionId: session.id,
        command,
        timeoutMs,
    })
}

/** one call to the command model, paid from december credits */
const runCommandPrompt = async (data: RunCommandPrompt): Promise<string> => {
    const { userId, system, prompt, kind, maxOutputChars = 8000 } = data

    const hasBalance = await usageService.hasMinimumBalance({ userId, minBalanceInCents: 1 })
    if (!hasBalance) {
        throw new AppError('Add December credits to use this command.', 402)
    }

    const { provider, model } = cliDispatcher.resolveServerProvider(COMMAND_MODEL)
    let text = ''
    let inputTokens = 0
    let outputTokens = 0
    const stream = provider.stream([{ role: 'user', content: prompt }], undefined, system, {
        model,
        temperature: 0.2,
    })
    for await (const chunk of stream) {
        if (chunk.type === 'text') {
            text += chunk.text
            if (text.length > maxOutputChars) break
        } else if (chunk.type === 'usage') {
            inputTokens = chunk.promptTokens
            outputTokens = chunk.completionTokens
        }
    }
    if (!inputTokens && !outputTokens) {
        inputTokens = estimateTokens(system + prompt)
        outputTokens = estimateTokens(text)
    }

    await usageService
        .recordDailyUsage({ userId, model: COMMAND_MODEL, inputTokens, outputTokens, kind })
        .catch((error: unknown) => console.error('[SessionCommand] usage record failed', error))

    return text.trim()
}

/** /context: how much of the model's context the session uses now */
const getContext = async (data: SessionRef): Promise<ContextUsage> => {
    const session = await loadSession(data)
    const messages = await sessionCommandRepository.findContextMessages(
        session.id,
        session.contextStartSequence
    )
    const config = (session.settings?.config ?? {}) as Record<string, unknown>
    const model = typeof config.model === 'string' ? config.model : null
    const provider = typeof config.provider === 'string' ? config.provider : null
    const limitTokens =
        model && provider ? (getModelDetails(provider, model)?.contextWindow ?? null) : null

    const conversationTokens = messages.reduce(
        (sum, message) => sum + estimateTokens(messageText(message)),
        0
    )
    const usedTokens = messages.length > 0 ? conversationTokens + AGENT_OVERHEAD_TOKENS : 0

    return {
        usedTokens,
        limitTokens,
        percent: limitTokens ? Math.min(100, Math.round((usedTokens / limitTokens) * 100)) : null,
        messages: messages.length,
        model,
    }
}

/** /compact: a summary replaces the conversation in the agent's context */
const compactSession = async (data: CompactSession) => {
    const { userId, sessionId, focus } = data
    const session = await loadSession({ userId, sessionId })
    assertIdle(session)

    const messages = await sessionCommandRepository.findContextMessages(
        session.id,
        session.contextStartSequence
    )
    if (messages.length === 0) {
        throw new AppError('There is nothing to compact yet.', 400)
    }

    const summary = await runCommandPrompt({
        userId,
        system: COMPACT_SYSTEM_PROMPT,
        prompt: `${focus ? `Keep this in focus: ${focus}\n\n` : ''}Session transcript:\n${buildTranscript(messages)}`,
        kind: 'session-compact',
    })
    if (!summary) throw new AppError('The summary came back empty. Try again.', 502)

    const message = await sessionCommandRepository.saveCompactSummary(
        session.id,
        `Summary of the conversation so far:\n\n${summary}`
    )
    await clearListCache(userId)
    return { summary, sequence: message.sequence, context: await getContext({ userId, sessionId }) }
}

/** /clear: the agent starts the next message with an empty conversation */
const clearSession = async (data: SessionRef) => {
    const session = await loadSession(data)
    assertIdle(session)
    const last = await sessionCommandRepository.findLastSequence(session.id)
    const updated = await sessionCommandRepository.setContextStart(session.id, last + 1)
    return { contextStartSequence: updated.contextStartSequence }
}

/** /fork: a new session with this conversation, on the branch this session pushed */
const forkSession = async (data: SessionRef) => {
    const { userId } = data
    const source = await loadSession(data)

    const hasRepo = Boolean(source.githubRepoOwner && source.githubRepoName)
    // the worker pushes the task branch at the end of each run; a branch that was never
    // pushed makes the clone fall back to the default branch
    const branch = source.prBranch ?? (hasRepo ? `december/${source.id}` : source.branch)

    const session = await sessionCommandRepository.forkSession(
        {
            userId,
            title: `${source.title || 'Session'} (fork)`.slice(0, 100),
            type: source.type,
            vmStatus: 'STOPPED',
            projectId: source.projectId,
            repoUrl: source.repoUrl,
            githubRepoUrl: source.githubRepoUrl,
            githubRepoOwner: source.githubRepoOwner,
            githubRepoName: source.githubRepoName,
            gitProvider: source.gitProvider,
            branch,
            tags: source.tags,
            contextStartSequence: source.contextStartSequence,
        },
        source.id,
        (source.settings?.config ?? null) as any
    )
    await clearListCache(userId)
    return { session }
}

/** /rewind: the prompts that can be rewound to, newest first */
const listTurns = async (data: SessionRef) => {
    const session = await loadSession(data)
    const turns = await sessionCommandRepository.findUserTurns(
        session.id,
        session.contextStartSequence
    )
    return {
        turns: turns.map((turn) => ({
            sequence: turn.sequence,
            prompt: turn.content.slice(0, 300),
            createdAt: turn.createdAt,
        })),
    }
}

/**
 * /rewind: removes the prompt and everything after it, and puts the files back to how
 * they were before that prompt. Returns the prompt, so the client can put it back in
 * the box.
 */
const rewindSession = async (data: RewindSession) => {
    const { userId, sessionId, sequence } = data
    const session = await loadSession({ userId, sessionId })
    assertIdle(session)

    const message = await sessionCommandRepository.findMessage(session.id, sequence)
    if (!message || message.role !== 'USER' || sequence < session.contextStartSequence) {
        throw new AppError('That message cannot be rewound to.', 400)
    }

    let filesRestored = false
    let filesNote: string | null = null
    try {
        const result = await runInSandbox(session, buildRestoreCommand(sequence), 120_000)
        filesRestored = result.stdout.includes('RESTORED')
        if (!filesRestored)
            filesNote = 'No file snapshot for that message. Only the chat went back.'
    } catch (error) {
        filesNote =
            error instanceof AppError
                ? 'The session machine is gone. Only the chat went back.'
                : 'The files could not be restored. Only the chat went back.'
        if (!(error instanceof AppError)) {
            console.error('[SessionCommand] file restore failed', error)
        }
    }

    await sessionCommandRepository.deleteMessagesFrom(session.id, sequence)
    await clearListCache(userId)
    return { prompt: message.content, filesRestored, filesNote }
}

/** /btw: an answer from the conversation, not saved in it */
const askSideQuestion = async (data: AskSideQuestion) => {
    const { userId, sessionId, question } = data
    const session = await loadSession({ userId, sessionId })
    const messages = await sessionCommandRepository.findContextMessages(
        session.id,
        session.contextStartSequence
    )
    const answer = await runCommandPrompt({
        userId,
        system: SIDE_QUESTION_SYSTEM_PROMPT,
        prompt: `Question: ${question}\n\nSession transcript:\n${buildTranscript(messages) || '(empty)'}`,
        kind: 'session-btw',
        maxOutputChars: 4000,
    })
    return { answer }
}

/** /rename with no title: a title written from the conversation */
const generateTitle = async (data: SessionRef) => {
    const { userId, sessionId } = data
    const session = await loadSession(data)
    const messages = await sessionCommandRepository.findContextMessages(session.id, 0)
    const transcript = buildTranscript(messages.slice(0, 12), 6000)
    if (!transcript) throw new AppError('There is nothing to name yet.', 400)

    const title = cleanTitle(
        await runCommandPrompt({
            userId,
            system: TITLE_SYSTEM_PROMPT,
            prompt: `Conversation:\n${transcript}\n\nTitle:`,
            kind: 'session-title',
            maxOutputChars: 400,
        })
    )
    if (!title) throw new AppError('No title came back. Try again.', 502)

    const updated = await sessionService.renameSession({ userId, sessionId, title })
    return { title: updated.title }
}

/** /codesearch: fixed text in the files of the session machine */
const searchCode = async (data: SearchSessionCode) => {
    const { query } = data
    const session = await loadSession(data)
    const result = await runInSandbox(session, buildCodeSearchCommand(query))
    return { matches: parseCodeSearchOutput(result.stdout) }
}

/** /tasks: what runs on the session machine */
const listTasks = async (data: SessionRef) => {
    const session = await loadSession(data)
    const result = await runInSandbox(session, TASKS_COMMAND)
    return { tasks: parseTasksOutput(result.stdout) }
}

/** /usage in a session: tokens and cost of this session */
const getUsage = async (data: SessionRef) => {
    const session = await loadSession(data)
    const rows = await sessionCommandRepository.sumSessionUsage(session.id)
    const byModel = rows.map((row) => ({
        model: row.model,
        billingSource: row.billingSource,
        requests: row._count._all,
        inputTokens: row._sum.inputTokens ?? 0,
        outputTokens: row._sum.outputTokens ?? 0,
        totalTokens: row._sum.totalTokens ?? 0,
        // a key the user pays for directly costs nothing in credits
        costInCents: row.billingSource === 'OWN_KEY' ? 0 : (row._sum.costInCents ?? 0),
    }))
    return {
        inputTokens: byModel.reduce((sum, row) => sum + row.inputTokens, 0),
        outputTokens: byModel.reduce((sum, row) => sum + row.outputTokens, 0),
        totalTokens: byModel.reduce((sum, row) => sum + row.totalTokens, 0),
        costInCents: Math.round(byModel.reduce((sum, row) => sum + row.costInCents, 0) * 100) / 100,
        byModel,
    }
}

// a new session needs this much (MIN_SESSION_START_BALANCE_IN_CENTS)
const START_BALANCE_IN_CENTS = parseInt(process.env.MIN_SESSION_START_BALANCE_IN_CENTS || '50', 10)

/** /check: one answer for what a cloud session needs */
const getCheck = async (data: GetCheck) => {
    const { userId, sessionId } = data
    const user = await sessionCommandRepository.findCheckUser(userId)
    if (!user) throw new AppError('user not found', 404)

    const session = sessionId ? await loadSession({ userId, sessionId }) : null
    const gitlab = user.gitConnections.find((connection) => connection.provider === 'GITLAB')

    return {
        github: {
            connected: user.githubConnected || user.githubInstallations.length > 0,
            appInstalled: user.githubAppInstall || user.githubInstallations.length > 0,
            accounts: user.githubInstallations
                .map((installation) => installation.accountLogin)
                .filter((login): login is string => Boolean(login)),
        },
        gitlab: { connected: Boolean(gitlab), username: gitlab?.username ?? null },
        credits: {
            balanceInCents: Math.round(user.creditBalance * 100) / 100,
            enoughToStart: user.creditBalance >= START_BALANCE_IN_CENTS,
        },
        keys: user.providerCredentials.map((key) => ({
            provider: key.provider,
            keyHint: key.keyHint,
        })),
        machine: session
            ? { vmStatus: session.vmStatus, sandboxStatus: session.sandboxStatus ?? null }
            : null,
    }
}

/** /review <link>: a new session that checks out the pull request and reviews it */
const startReview = async (data: StartReview) => {
    const { userId, url } = data
    const parsed = parsePullRequestUrl(url)
    if (!parsed) {
        throw new AppError('Paste a GitHub pull request or GitLab merge request link.', 400)
    }
    const prompt = buildReviewPrompt(parsed)
    const session = await sessionService.createSession({
        userId,
        title: `Review ${parsed.repoPath}#${parsed.number}`.slice(0, 100),
        type: 'WEB',
        prompt,
        repoUrl: parsed.repoUrl,
        // a review changes nothing, so it never opens a pull request
        openPullRequest: false,
        planFirst: false,
    })
    return { session, prompt }
}

export const sessionCommandService = {
    getContext,
    compactSession,
    clearSession,
    forkSession,
    listTurns,
    rewindSession,
    askSideQuestion,
    generateTitle,
    searchCode,
    listTasks,
    getUsage,
    getCheck,
    startReview,
}
