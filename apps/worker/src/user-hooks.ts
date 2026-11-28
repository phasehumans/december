/**
 * The user hooks saved on the account in a cloud run (connections page, hooks). They run
 * like the cli's hooks.json (the rules are in @december/shared attachUserHooks), but each
 * command runs in the sandbox of the session, never on the worker.
 */
import { randomUUID } from 'node:crypto'

import {
    DEFAULT_HOOK_TIMEOUT_SECONDS,
    MAX_HOOK_TIMEOUT_SECONDS,
    USER_HOOK_EVENTS,
    isSafeHookMatcher,
    type HookCommandRunner,
    type HookRunResult,
    type UserHook,
    type UserHookEvent,
} from '@december/shared'

import { secretEnvsOf } from './sandbox-secrets'
import { shellQuote } from './shell-quote'

export type HookRow = {
    event: string
    matcher: string
    command: string
    timeoutSeconds: number
    enabled: boolean
}

/** the output of a hook that is kept, like the cli */
const OUTPUT_LIMIT = 64_000

/**
 * The saved hooks as the shared hook type, in their saved order. A hook that is off, with
 * an unknown event or an unsafe matcher is left out; the time limit stays in its range.
 */
export const toUserHooks = (rows: HookRow[]): UserHook[] =>
    rows
        .filter(
            (row) =>
                row.enabled &&
                (USER_HOOK_EVENTS as readonly string[]).includes(row.event) &&
                typeof row.command === 'string' &&
                row.command.trim().length > 0 &&
                isSafeHookMatcher(row.matcher)
        )
        .map((row) => ({
            event: row.event as UserHookEvent,
            matcher: row.matcher,
            command: row.command,
            timeoutSeconds:
                Number.isInteger(row.timeoutSeconds) && row.timeoutSeconds > 0
                    ? Math.min(row.timeoutSeconds, MAX_HOOK_TIMEOUT_SECONDS)
                    : DEFAULT_HOOK_TIMEOUT_SECONDS,
            source: 'global' as const,
            sourcePath: 'account',
        }))

const isTimeout = (error: unknown) => {
    const name = (error as { name?: string })?.name ?? ''
    const message = (error as { message?: string })?.message ?? ''
    return name === 'TimeoutError' || /timed? ?out|deadline/i.test(message)
}

/**
 * Runs one hook command in the sandbox, with the event as json on stdin (the payload is a
 * file in /tmp, read by the shell and then removed). Exit code 2 and stderr mean the same
 * as in the cli. The run's secrets are in its environment, like the agent's commands.
 */
export const createSandboxHookRunner =
    (getSandbox: () => any): HookCommandRunner =>
    async (hook, payload, cwd): Promise<HookRunResult> => {
        const result = (part: Partial<HookRunResult>): HookRunResult => ({
            hook,
            exitCode: null,
            stdout: '',
            stderr: '',
            timedOut: false,
            ...part,
        })
        const sandbox = getSandbox()
        if (
            typeof sandbox?.commands?.run !== 'function' ||
            typeof sandbox?.files?.write !== 'function'
        ) {
            return result({ error: 'the sandbox is not ready' })
        }
        const payloadFile = `/tmp/december-hook-${randomUUID()}.json`
        try {
            await sandbox.files.write(payloadFile, JSON.stringify(payload))
        } catch {
            // Intentionally swallowed: reported as the error of the hook
            return result({ error: 'the event could not be written to the sandbox' })
        }

        const line =
            `sh -c ${shellQuote(hook.command)} < ${payloadFile}; ` +
            `code=$?; rm -f ${payloadFile}; exit $code`
        const envs = {
            ...(secretEnvsOf(sandbox) ?? {}),
            DECEMBER_PROJECT_DIR: cwd,
            DECEMBER_HOOK_EVENT: hook.event,
        }
        const cut = (value: unknown) =>
            String(value ?? '')
                .slice(0, OUTPUT_LIMIT)
                .trim()
        try {
            const done = await sandbox.commands.run(line, {
                cwd,
                envs,
                timeoutMs: hook.timeoutSeconds * 1000,
            })
            return result({
                exitCode: typeof done?.exitCode === 'number' ? done.exitCode : 0,
                stdout: cut(done?.stdout),
                stderr: cut(done?.stderr),
            })
        } catch (error) {
            // a command that exits with a code that is not 0 throws, with its result
            const failed = error as { exitCode?: unknown; stdout?: unknown; stderr?: unknown }
            if (typeof failed?.exitCode === 'number') {
                return result({
                    exitCode: failed.exitCode,
                    stdout: cut(failed.stdout),
                    stderr: cut(failed.stderr),
                })
            }
            if (isTimeout(error)) {
                await Promise.resolve(sandbox.files.remove?.(payloadFile)).catch(() => {
                    // Intentionally swallowed: a file in /tmp of the sandbox can stay
                })
                return result({ timedOut: true })
            }
            return result({ error: 'the hook could not run in the sandbox' })
        }
    }

/** the question an ask_question call shows, for the Notification hook */
export const questionText = (input: unknown): string => {
    let value: unknown = input
    if (typeof input === 'string') {
        try {
            value = JSON.parse(input)
        } catch {
            // Intentionally swallowed: plain text is the question itself
            return input.slice(0, 500)
        }
    }
    const question = (value as { question?: unknown } | null)?.question
    return typeof question === 'string' ? question.slice(0, 500) : 'December asks a question.'
}
