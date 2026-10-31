import readline from 'readline'

import { runAgentLoop } from '@december/agent'

import { purgeProjectEnvApiKeys } from './utils/env-sanitizer'

import type { Agent } from '@december/agent'

const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
}

export function suppressConsole() {
    console.warn = () => {}
    console.error = () => {}
    console.log = () => {}
    console.info = () => {}
}

export function restoreConsole() {
    console.log = originalConsole.log
    console.warn = originalConsole.warn
    console.error = originalConsole.error
    console.info = originalConsole.info
}

export interface HeadlessTaskOptions {
    agent: Agent
    cwd?: string
    stdin?: NodeJS.ReadableStream
    stdout?: NodeJS.WritableStream
    stderr?: NodeJS.WritableStream
    nonInteractive?: boolean
    isAuthenticated?: boolean
    json?: boolean
    rpc?: boolean
    print?: boolean
    readOnly?: boolean
}

export interface HeadlessTaskResult {
    success: boolean
    error?: string
}

export async function runHeadlessTask(
    prompt: string,
    options: HeadlessTaskOptions
): Promise<HeadlessTaskResult> {
    restoreConsole()

    const {
        agent,
        stdin = process.stdin,
        stdout = process.stdout,
        stderr = process.stderr,
    } = options

    purgeProjectEnvApiKeys(options.cwd)

    const isPrint = Boolean(options.print)
    const isRpc = options.rpc !== undefined ? Boolean(options.rpc) : !isPrint
    const isJson = Boolean(options.json) || isRpc

    const writeOut = (msg: string) => {
        if (stdout && stdout.write) stdout.write(msg)
    }

    const writeErr = (msg: string) => {
        if (stderr && stderr.write) stderr.write(msg)
    }

    const writeJson = (data: any) => {
        writeOut(JSON.stringify(data) + '\n')
    }

    if (options.isAuthenticated === false) {
        if (isJson) {
            writeJson({ type: 'error', error: 'Not authenticated' })
        } else {
            writeErr(
                'Error: Not authenticated. Please run `december login` or configure an API key (e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY).\n'
            )
        }
        return { success: false, error: 'Not authenticated' }
    }

    const isNonInteractive =
        options.nonInteractive ??
        Boolean(process.env.NON_INTERACTIVE || (stdin === process.stdin && !process.stdin.isTTY))

    const rl = readline.createInterface({
        input: stdin as any,
        output: isRpc || options.json ? undefined : (stdout as any),
        terminal: false,
    })

    let isPromptActive = false

    const promptUser = (query: string): Promise<string> => {
        isPromptActive = true
        return new Promise((resolve) => {
            rl.question(query, (answer: string) => {
                queueMicrotask(() => {
                    isPromptActive = false
                })
                resolve(answer)
            })
        })
    }

    if (!agent.operations) agent.operations = {} as any
    if (!agent.operations.ui) agent.operations.ui = {} as any

    agent.operations.ui.askQuestion = (questions: any[]) => {
        const q = questions[0]
        writeOut(`\n\n[Question]: ${q.question}\n`)
        if (q.options) {
            q.options.forEach((opt: string, i: number) => writeOut(`${i + 1}. ${opt}\n`))
        }
        if (isNonInteractive) {
            const defaultAnswer = q.options && q.options.length > 0 ? q.options[0] : ''
            writeOut(`\n[Auto-selected in non-interactive mode]: ${defaultAnswer}\n`)
            return Promise.resolve(defaultAnswer)
        }
        return promptUser('\nSelect an option or type your answer: ').then((answer) => {
            const num = parseInt(answer)
            if (!isNaN(num) && num > 0 && q.options && num <= q.options.length) {
                return q.options[num - 1]
            }
            return answer
        })
    }

    agent.operations.ui.requestPermission = async (toolCall: any) => {
        if (
            options.readOnly &&
            ![
                'read_file',
                'ls',
                'find_files',
                'grep_search',
                'web_search',
                'browser',
                'ask_question',
            ].includes(toolCall.name)
        ) {
            return {
                block: true,
                reason: `Tool '${toolCall.name}' is not allowed in read-only / ask mode.`,
            }
        }

        if (isNonInteractive) {
            return { block: false }
        }

        if (
            [
                'edit_file',
                'edit_diff',
                'write_file',
                'bash',
                'replace_file_content',
                'multi_replace_file_content',
                'run_command',
            ].includes(toolCall.name)
        ) {
            const answer = await promptUser(`\nExecute ${toolCall.name}? (y/n): `)
            if (answer.toLowerCase().startsWith('y')) {
                return { block: false }
            } else {
                return { block: true, reason: 'User denied execution in UI.' }
            }
        }
        return { block: false }
    }

    rl.on('line', (input: string) => {
        const trimmed = input.trim()
        if (!trimmed) return

        if (isRpc) {
            let parsed: any = null
            try {
                parsed = JSON.parse(trimmed)
            } catch {
                // Intentionally swallowed: fallback to plain text command below
            }

            if (parsed && typeof parsed === 'object') {
                if (parsed.type === 'abort' || parsed.type === 'cancel') {
                    if (typeof agent.abort === 'function') {
                        agent.abort()
                    }
                    return
                }
                if (parsed.type === 'prompt') {
                    const content = parsed.content || parsed.text || ''
                    if (content) {
                        agent.steer({ role: 'user', content, isUI: true })
                    }
                    return
                }
            }

            if (trimmed === 'abort' || trimmed === 'cancel') {
                if (typeof agent.abort === 'function') {
                    agent.abort()
                }
                return
            }

            agent.steer({ role: 'user', content: trimmed, isUI: true })
            return
        }

        if (isPromptActive) return
        agent.steer({ role: 'user', content: trimmed, isUI: true })
        writeOut(`\n[Steering input sent to agent]\n`)
    })

    let hasError = false
    let errorMessage: string | undefined

    try {
        let effectivePrompt = prompt
        if (prompt && prompt.includes('@')) {
            try {
                const { resolveContextMentions } = await import('@december/shared')
                const resolved = await resolveContextMentions(
                    prompt,
                    agent.workspaceDir || process.cwd()
                )
                effectivePrompt = resolved.expandedPrompt
            } catch {
                // Intentionally swallowed: keep original prompt on mention resolution failure
            }
        }

        if (isRpc) {
            writeJson({
                type: 'session_init',
                sessionId: agent.sessionId || 'default',
                model: agent.modelOptions?.model,
                workspace: options.cwd || agent.workspaceDir || process.cwd(),
            })
            writeJson({
                type: 'turn_start',
                turn: 1,
                prompt: effectivePrompt,
            })
        }

        let totalPromptTokens = 0
        let totalCompletionTokens = 0

        const stream = runAgentLoop(
            agent,
            options.readOnly ? { content: effectivePrompt, readOnly: true } : effectivePrompt
        )

        for await (const event of stream) {
            switch (event.type) {
                case 'StreamChunk': {
                    if (isRpc) {
                        writeJson({ type: 'token_delta', content: event.content })
                    } else if (isJson) {
                        writeJson({ type: 'content', content: event.content })
                    } else {
                        writeOut(event.content)
                    }
                    break
                }
                case 'ThinkingChunk': {
                    if (isRpc) {
                        writeJson({ type: 'thought_delta', content: event.content })
                    } else if (isJson) {
                        writeJson({ type: 'thinking', content: event.content })
                    }
                    break
                }
                case 'AgentStatus': {
                    if (isRpc) {
                        // Suppressed in pure RPC lifecycle
                    } else if (isJson) {
                        writeJson({ type: 'status', message: event.message })
                    } else {
                        writeOut(`\n[Status: ${event.message}]\n`)
                    }
                    break
                }
                case 'ContextCompacted': {
                    if (isRpc) {
                        writeJson({ type: 'context_compacted', summary: event.summary })
                    } else if (isJson) {
                        writeJson({ type: 'compacted', summary: event.summary })
                    } else {
                        writeOut(`\n[Context Compacted: ${event.summary}]\n`)
                    }
                    break
                }
                case 'ToolCallStart': {
                    if (isRpc) {
                        writeJson({
                            type: 'tool_call',
                            id: event.toolCall.id,
                            name: event.toolCall.name,
                            input: event.toolCall.input,
                        })
                    } else if (isJson) {
                        writeJson({ type: 'tool_start', toolCall: event.toolCall })
                    } else {
                        writeOut(`\n\n[Tool Executing: ${event.toolCall.name}]\n`)
                        writeOut(
                            typeof event.toolCall.input === 'string'
                                ? event.toolCall.input
                                : JSON.stringify(event.toolCall.input)
                        )
                        writeOut('\n')
                    }
                    break
                }
                case 'ToolCallResult': {
                    if (isRpc) {
                        writeJson({
                            type: 'tool_result',
                            id: event.result.toolCallId,
                            name: (event.result as any).name || (event.result as any).toolName,
                            result: event.result.result,
                            ...(event.result.error ? { error: event.result.error } : {}),
                        })
                    } else if (isJson) {
                        writeJson({ type: 'tool_result', result: event.result })
                    } else {
                        if (event.result.error) {
                            writeErr(`\n[Tool Error] ${event.result.error}\n`)
                        } else {
                            writeOut(`\n[Tool Result Received]\n`)
                        }
                    }
                    break
                }
                case 'AgentUsage': {
                    totalPromptTokens = event.promptTokens
                    totalCompletionTokens = event.completionTokens
                    if (!isRpc && isJson) {
                        writeJson({
                            type: 'usage',
                            promptTokens: event.promptTokens,
                            completionTokens: event.completionTokens,
                        })
                    } else if (!isRpc && !isJson) {
                        writeOut(
                            `\n[Usage: ${event.promptTokens} prompt, ${event.completionTokens} completion]\n`
                        )
                    }
                    break
                }
                case 'AgentError': {
                    hasError = true
                    errorMessage = event.error
                    if (isRpc || isJson) {
                        writeJson({ type: 'error', error: event.error })
                    } else {
                        writeErr(`\n[Error: ${event.error}]\n`)
                    }
                    break
                }
            }
        }
        if (isRpc) {
            writeJson({
                type: 'turn_complete',
                success: !hasError,
                promptTokens: totalPromptTokens,
                completionTokens: totalCompletionTokens,
            })
        } else if (isJson) {
            writeJson({ type: 'done', success: !hasError })
        } else {
            writeOut('\n\nHeadless task complete.\n')
        }
    } finally {
        rl.close()
    }

    return {
        success: !hasError,
        ...(errorMessage ? { error: errorMessage } : {}),
    }
}
