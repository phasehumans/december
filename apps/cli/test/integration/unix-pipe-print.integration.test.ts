import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'bun:test'

describe('UNIX Pipe and Quiet Print Mode (Integration)', () => {
    let mockServer: any
    let mockServerPort: number
    let tempDir: string
    let tempConfigDir: string
    let serverHandler: (req: Request) => Promise<Response>

    beforeAll(async () => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-pipe-workspace-'))
        tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-pipe-config-'))

        mockServer = Bun.serve({
            port: 0,
            fetch(req) {
                if (serverHandler) {
                    return serverHandler(req)
                }
                return new Response('Not Found', { status: 404 })
            },
        })
        mockServerPort = mockServer.port

        const config = {
            activeProvider: 'openai',
            activeModel: 'gpt-4o',
            authPriority: 'subscription',
            subscriptions: {
                openai: {
                    accessToken: 'test-token',
                    endpoint: `http://127.0.0.1:${mockServerPort}/v1`,
                    expiresAt: Date.now() + 86400000,
                },
            },
            trustedWorkspaces: [tempDir],
        }

        fs.writeFileSync(
            path.join(tempConfigDir, 'config.json'),
            JSON.stringify(config, null, 2),
            'utf8'
        )
    })

    afterAll(() => {
        try {
            mockServer?.stop(true)
        } catch {
            // Intentionally swallowed: server shutdown cleanup
        }
        try {
            fs.rmSync(tempDir, { recursive: true, force: true })
            fs.rmSync(tempConfigDir, { recursive: true, force: true })
        } catch {
            // Intentionally swallowed: directory cleanup error
        }
    })

    it('executes piped input through the CLI binary and asserts on clean stdout output and exit code', async () => {
        let receivedBody = ''
        serverHandler = async (req: Request) => {
            const url = new URL(req.url)
            if (url.pathname === '/v1/chat/completions') {
                receivedBody = await req.text()
                const sseStream = [
                    'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"const transformed = true\\n"},"finish_reason":null}]}\n\n',
                    'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
                    'data: [DONE]\n\n',
                ].join('')

                return new Response(sseStream, {
                    headers: {
                        'content-type': 'text/event-stream',
                        'cache-control': 'no-cache',
                        connection: 'keep-alive',
                    },
                })
            }
            return new Response('Not Found', { status: 404 })
        }

        const cliPath = path.resolve(__dirname, '../../src/index.ts')
        const proc = Bun.spawn([process.execPath, cliPath, 'refactor this function', '--print'], {
            cwd: tempDir,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DECEMBER_CONFIG_DIR: tempConfigDir,
            },
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
        })

        // Write piped stdin and close stream
        proc.stdin.write('function oldImplementation() { return false; }\n')
        proc.stdin.end()

        const stdoutText = await new Response(proc.stdout).text()
        const stderrText = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        expect(exitCode).toBe(0)
        expect(stdoutText).toBe('const transformed = true\n')
        expect(stdoutText).not.toContain('december')
        expect(stdoutText).not.toContain('\x1b')
        expect(receivedBody).toContain('oldImplementation')
        expect(receivedBody).toContain('refactor this function')
        expect(stderrText).toContain('[Status: Working...]')
    })

    it('cleanly ingests non-TTY standard input as prompt when positional prompt is omitted', async () => {
        serverHandler = async (req: Request) => {
            const url = new URL(req.url)
            if (url.pathname === '/v1/chat/completions') {
                const sseStream = [
                    'data: {"id":"chatcmpl-2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"piped summary result\\n"},"finish_reason":null}]}\n\n',
                    'data: {"id":"chatcmpl-2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
                    'data: [DONE]\n\n',
                ].join('')

                return new Response(sseStream, {
                    headers: {
                        'content-type': 'text/event-stream',
                        'cache-control': 'no-cache',
                        connection: 'keep-alive',
                    },
                })
            }
            return new Response('Not Found', { status: 404 })
        }

        const cliPath = path.resolve(__dirname, '../../src/index.ts')
        const proc = Bun.spawn([process.execPath, cliPath, '--print'], {
            cwd: tempDir,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DECEMBER_CONFIG_DIR: tempConfigDir,
            },
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
        })

        proc.stdin.write('analyze this log entry\n')
        proc.stdin.end()

        const stdoutText = await new Response(proc.stdout).text()
        const exitCode = await proc.exited

        expect(exitCode).toBe(0)
        expect(stdoutText).toBe('piped summary result\n')
    })

    it('routes diagnostic messages to stderr and preserves clean assistant text on stdout during tool calls', async () => {
        let step = 0
        serverHandler = async (req: Request) => {
            const url = new URL(req.url)
            if (url.pathname === '/v1/chat/completions') {
                step++
                if (step === 1) {
                    // Turn 1: model executes read_file tool call
                    const sseToolCall = [
                        'data: {"id":"chatcmpl-3","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"tool_calls":[{"id":"call_read_1","type":"function","function":{"name":"read_file","arguments":"{\\"path\\":\\"sample.txt\\"}"}}]},"finish_reason":null}]}\n\n',
                        'data: {"id":"chatcmpl-3","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}\n\n',
                        'data: [DONE]\n\n',
                    ].join('')

                    return new Response(sseToolCall, {
                        headers: {
                            'content-type': 'text/event-stream',
                            'cache-control': 'no-cache',
                            connection: 'keep-alive',
                        },
                    })
                }

                // Turn 2: model provides final answer
                const sseFinal = [
                    'data: {"id":"chatcmpl-4","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"final file answer\\n"},"finish_reason":null}]}\n\n',
                    'data: {"id":"chatcmpl-4","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
                    'data: [DONE]\n\n',
                ].join('')

                return new Response(sseFinal, {
                    headers: {
                        'content-type': 'text/event-stream',
                        'cache-control': 'no-cache',
                        connection: 'keep-alive',
                    },
                })
            }
            return new Response('Not Found', { status: 404 })
        }

        // Create sample file in temp workspace for tool execution
        fs.writeFileSync(path.join(tempDir, 'sample.txt'), 'sample content', 'utf8')

        const cliPath = path.resolve(__dirname, '../../src/index.ts')
        const proc = Bun.spawn([process.execPath, cliPath, 'inspect sample file', '--print'], {
            cwd: tempDir,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DECEMBER_CONFIG_DIR: tempConfigDir,
            },
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
        })

        proc.stdin.end()

        const stdoutText = await new Response(proc.stdout).text()
        const stderrText = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        expect(exitCode).toBe(0)
        expect(stdoutText).toBe('final file answer\n')
        expect(stdoutText).not.toContain('[Tool Executing:')
        expect(stderrText).toContain('[Tool Executing: read_file]')
    })

    it('exits with non-zero exit code when --print is used without prompt or stdin input', async () => {
        const cliPath = path.resolve(__dirname, '../../src/index.ts')
        const proc = Bun.spawn([process.execPath, cliPath, '--print'], {
            cwd: tempDir,
            env: {
                ...process.env,
                NODE_ENV: 'test',
                DECEMBER_CONFIG_DIR: tempConfigDir,
            },
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
        })

        // Close stdin immediately with no input
        proc.stdin.end()

        const stderrText = await new Response(proc.stderr).text()
        const exitCode = await proc.exited

        expect(exitCode).not.toBe(0)
        expect(stderrText).toContain(
            'Error: Please provide a prompt or pipe input when using --print.'
        )
    })
})
