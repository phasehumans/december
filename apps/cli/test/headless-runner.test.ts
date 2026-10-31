import { PassThrough } from 'stream'

import { describe, it, expect, beforeEach, mock } from 'bun:test'

const mockRunAgentLoop = mock()

mock.module('@december/agent', () => {
    return {
        runAgentLoop: mockRunAgentLoop,
        Agent: class MockAgent {
            sessionId = 'default'
            modelOptions = {}
            workspaceDir = ''
            operations = { ui: {} }
            setOnToolActivated() {}
            steer = mock()
            abort = mock()
        },
    }
})

import { runHeadlessTask, restoreConsole, suppressConsole } from '../src/headless-runner'

describe('runHeadlessTask', () => {
    let mockAgent: any
    let mockStdin: PassThrough
    let mockStdout: PassThrough
    let mockStderr: PassThrough

    beforeEach(() => {
        mockRunAgentLoop.mockClear()
        mockAgent = {
            operations: { ui: {} },
            steer: mock(),
        }
        mockStdin = new PassThrough()
        mockStdout = new PassThrough()
        mockStderr = new PassThrough()
    })

    it('executes agent loop with prompt without initializing Ink TUI', async () => {
        async function* mockGenerator() {
            yield { type: 'StreamChunk', content: 'Hello world' }
            yield { type: 'AgentUsage', promptTokens: 10, completionTokens: 5 }
        }

        mockRunAgentLoop.mockReturnValue(mockGenerator())

        let stdoutData = ''
        mockStdout.on('data', (chunk) => {
            stdoutData += chunk.toString()
        })

        const result = await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(mockRunAgentLoop).toHaveBeenCalledWith(mockAgent, 'test prompt')
        expect(result.success).toBe(true)
        expect(stdoutData).toContain('Hello world')
        expect(stdoutData).toContain('[Usage: 10 prompt, 5 completion]')
        expect(stdoutData).toContain('Headless task complete.')
    })

    it('routes thinking deltas, agent status, and context compaction to stdout', async () => {
        async function* mockGenerator() {
            yield { type: 'ThinkingChunk', content: 'Analyzing problem space...' }
            yield { type: 'AgentStatus', message: 'Retrying connection...' }
            yield { type: 'ContextCompacted', summary: 'Compacted 10 messages' }
        }

        mockRunAgentLoop.mockReturnValue(mockGenerator())

        let stdoutData = ''
        mockStdout.on('data', (chunk) => {
            stdoutData += chunk.toString()
        })

        const result = await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(result.success).toBe(true)
        expect(stdoutData).not.toContain('Analyzing problem space...')
        expect(stdoutData).toContain('[Status: Retrying connection...]')
        expect(stdoutData).toContain('[Context Compacted: Compacted 10 messages]')
    })

    it('attaches askQuestion and requestPermission to agent.operations.ui', async () => {
        async function* mockGenerator() {
            yield { type: 'StreamChunk', content: 'Done' }
        }
        mockRunAgentLoop.mockReturnValue(mockGenerator())

        await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(mockAgent.operations.ui.askQuestion).toBeDefined()
        expect(mockAgent.operations.ui.requestPermission).toBeDefined()
    })

    it('routes tool execution headers and results to stdout', async () => {
        async function* mockGenerator() {
            yield {
                type: 'ToolCallStart',
                toolCall: { name: 'read_file', input: { filepath: 'a.txt' } },
            }
            yield {
                type: 'ToolCallResult',
                result: { output: 'file contents' },
            }
        }
        mockRunAgentLoop.mockReturnValue(mockGenerator())

        let stdoutData = ''
        mockStdout.on('data', (chunk) => {
            stdoutData += chunk.toString()
        })

        await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(stdoutData).toContain('[Tool Executing: read_file]')
        expect(stdoutData).toContain('{"filepath":"a.txt"}')
        expect(stdoutData).toContain('[Tool Result Received]')
    })

    it('routes tool errors and agent errors to stderr', async () => {
        async function* mockGenerator() {
            yield {
                type: 'ToolCallResult',
                result: { error: 'File not found' },
            }
            yield { type: 'AgentError', error: 'LLM Rate limit reached' }
        }
        mockRunAgentLoop.mockReturnValue(mockGenerator())

        let stderrData = ''
        mockStderr.on('data', (chunk) => {
            stderrData += chunk.toString()
        })

        const result = await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('LLM Rate limit reached')
        expect(stderrData).toContain('[Tool Error] File not found')
        expect(stderrData).toContain('[Error: LLM Rate limit reached]')
    })

    it('isolates askQuestion input from triggering agent.steer', async () => {
        mockRunAgentLoop.mockImplementation(async function* () {
            const ansPromise = mockAgent.operations.ui.askQuestion([
                { question: 'Which framework?', options: ['Next.js', 'Vite'] },
            ])
            mockStdin.write('1\n')
            const ans = await ansPromise
            expect(ans).toBe('Next.js')
            yield { type: 'StreamChunk', content: 'Selected framework' }
        })

        await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(mockAgent.steer).not.toHaveBeenCalled()
    })

    it('isolates requestPermission input from triggering agent.steer', async () => {
        mockRunAgentLoop.mockImplementation(async function* () {
            const permPromise = mockAgent.operations.ui.requestPermission({
                name: 'run_command',
                input: { CommandLine: 'ls' },
            })
            mockStdin.write('y\n')
            const perm = await permPromise
            expect(perm).toEqual({ block: false })
            yield { type: 'StreamChunk', content: 'Approved' }
        })

        await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(mockAgent.steer).not.toHaveBeenCalled()
    })

    it('expands @file mentions automatically into the agent prompt', async () => {
        // Mocking the internal file resolver logic would be ideal,
        // but for integration testing headless runner expansion:
        mockRunAgentLoop.mockImplementation(async function* (agent: any, prompt: string) {
            expect(prompt).toContain('<context_file path="package.json"')
            yield { type: 'StreamChunk', content: 'expanded' }
        })

        await runHeadlessTask('analyze @package.json', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            print: true,
        })
    })

    it('sends user steering input to agent when no prompt is pending', async () => {
        mockRunAgentLoop.mockImplementation(async function* () {
            mockStdin.write('change approach\n')
            yield { type: 'StreamChunk', content: 'Steered' }
        })

        await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            rpc: false,
        })

        expect(mockAgent.steer).toHaveBeenCalledWith({
            role: 'user',
            content: 'change approach',
            isUI: true,
        })
    })

    it('auto-approves tool permissions when nonInteractive option is true', async () => {
        mockRunAgentLoop.mockImplementation(async function* () {
            const perm = await mockAgent.operations.ui.requestPermission({
                name: 'run_command',
                input: { CommandLine: 'rm -rf /tmp/test' },
            })
            expect(perm).toEqual({ block: false })
            yield { type: 'StreamChunk', content: 'Executed non-interactively' }
        })

        const result = await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            nonInteractive: true,
        })

        expect(result.success).toBe(true)
    })

    it('auto-selects first question option when nonInteractive is true', async () => {
        mockRunAgentLoop.mockImplementation(async function* () {
            const ans = await mockAgent.operations.ui.askQuestion([
                { question: 'Choice?', options: ['Option A', 'Option B'] },
            ])
            expect(ans).toBe('Option A')
            yield { type: 'StreamChunk', content: 'Chosen Option A' }
        })

        const result = await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            nonInteractive: true,
        })

        expect(result.success).toBe(true)
    })

    it('fails pre-flight check and exits with error if isAuthenticated is false', async () => {
        let stderrData = ''
        mockStderr.on('data', (chunk) => {
            stderrData += chunk.toString()
        })

        const result = await runHeadlessTask('test prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            isAuthenticated: false,
            print: true,
        })

        expect(result.success).toBe(false)
        expect(result.error).toBe('Not authenticated')
        expect(stderrData).toContain('Not authenticated')
        expect(mockRunAgentLoop).not.toHaveBeenCalled()
    })

    it('restores console functions when restoreConsole is invoked', () => {
        const originalLog = console.log
        suppressConsole()
        expect(console.log).not.toBe(originalLog)

        restoreConsole()
        expect(console.log).toBe(originalLog)
    })

    it('defaults to Stdio NDJSON RPC mode when options.print is omitted', async () => {
        async function* mockGenerator() {
            yield { type: 'StreamChunk', content: 'rpc default stream' }
        }
        mockRunAgentLoop.mockReturnValue(mockGenerator())

        let stdoutData = ''
        mockStdout.on('data', (chunk) => {
            stdoutData += chunk.toString()
        })

        const result = await runHeadlessTask('test default rpc', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
        })

        expect(result.success).toBe(true)
        expect(stdoutData).toContain('"type":"session_init"')
        expect(stdoutData).toContain('"type":"turn_start"')
        expect(stdoutData).toContain('"type":"token_delta"')
    })

    it('blocks mutating tools in requestPermission and forwards readOnly option when readOnly is true', async () => {
        mockRunAgentLoop.mockImplementation(async function* (_agent: any, input: any) {
            expect(input).toEqual({
                content: 'test ask prompt',
                readOnly: true,
            })
            const blockedBash = await mockAgent.operations.ui.requestPermission({
                name: 'bash',
                input: { command: 'ls' },
            })
            expect(blockedBash.block).toBe(true)
            expect(blockedBash.reason).toContain('read-only / ask mode')

            const allowedRead = await mockAgent.operations.ui.requestPermission({
                name: 'read_file',
                input: { path: 'file.txt' },
            })
            expect(allowedRead.block).toBe(false)

            yield { type: 'StreamChunk', content: 'Answer' }
        })

        const result = await runHeadlessTask('test ask prompt', {
            agent: mockAgent,
            stdin: mockStdin as any,
            stdout: mockStdout as any,
            stderr: mockStderr as any,
            readOnly: true,
        })

        expect(result.success).toBe(true)
    })

    describe('RPC mode', () => {
        it('streams structured line-delimited JSON events over stdout', async () => {
            mockAgent.sessionId = 'test-session-123'
            mockAgent.modelOptions = { model: 'gpt-4o' }
            mockAgent.workspaceDir = '/test/workspace'

            async function* mockGenerator() {
                yield { type: 'ThinkingChunk', content: 'thinking step' }
                yield { type: 'StreamChunk', content: 'hello rpc' }
                yield {
                    type: 'ToolCallStart',
                    toolCall: { id: 'call_1', name: 'read_file', input: { path: 'a.txt' } },
                }
                yield {
                    type: 'ToolCallResult',
                    result: { toolCallId: 'call_1', name: 'read_file', result: 'file contents' },
                }
                yield { type: 'AgentUsage', promptTokens: 50, completionTokens: 20 }
            }

            mockRunAgentLoop.mockReturnValue(mockGenerator())

            const emittedEvents: any[] = []
            mockStdout.on('data', (chunk) => {
                const lines = chunk.toString().trim().split('\n')
                for (const line of lines) {
                    if (line.trim()) {
                        emittedEvents.push(JSON.parse(line))
                    }
                }
            })

            const result = await runHeadlessTask('test rpc prompt', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                rpc: true,
            })

            expect(result.success).toBe(true)
            expect(emittedEvents.map((e) => e.type)).toEqual([
                'session_init',
                'turn_start',
                'thought_delta',
                'token_delta',
                'tool_call',
                'tool_result',
                'turn_complete',
            ])
            expect(emittedEvents[0].sessionId).toBe('test-session-123')
            expect(emittedEvents[0].model).toBe('gpt-4o')
            expect(emittedEvents[1].prompt).toBe('test rpc prompt')
            expect(emittedEvents[2].content).toBe('thinking step')
            expect(emittedEvents[3].content).toBe('hello rpc')
            expect(emittedEvents[4].id).toBe('call_1')
            expect(emittedEvents[4].name).toBe('read_file')
            expect(emittedEvents[5].result).toBe('file contents')
            expect(emittedEvents[6].promptTokens).toBe(50)
            expect(emittedEvents[6].completionTokens).toBe(20)
        })

        it('receives inbound abort signal from stdin and triggers agent.abort()', async () => {
            mockAgent.abort = mock()

            mockRunAgentLoop.mockImplementation(async function* () {
                mockStdin.write(JSON.stringify({ type: 'abort' }) + '\n')
                // Wait small microtask for stdin listener
                await new Promise((r) => setTimeout(r, 10))
                yield { type: 'StreamChunk', content: 'aborted' }
            })

            await runHeadlessTask('test prompt', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                rpc: true,
            })

            expect(mockAgent.abort).toHaveBeenCalled()
        })

        it('receives inbound prompt from stdin and steers agent', async () => {
            mockRunAgentLoop.mockImplementation(async function* () {
                mockStdin.write(
                    JSON.stringify({ type: 'prompt', content: 'new instruction' }) + '\n'
                )
                await new Promise((r) => setTimeout(r, 10))
                yield { type: 'StreamChunk', content: 'acknowledged' }
            })

            await runHeadlessTask('test prompt', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                rpc: true,
            })

            expect(mockAgent.steer).toHaveBeenCalledWith({
                role: 'user',
                content: 'new instruction',
                isUI: true,
            })
        })
    })

    describe('Quiet print mode (--print)', () => {
        it('outputs strictly assistant response text to stdout with no banners, usage, or trailers', async () => {
            async function* mockGenerator() {
                yield { type: 'ThinkingChunk', content: 'internal reasoning' }
                yield { type: 'StreamChunk', content: 'clean response text' }
                yield { type: 'AgentUsage', promptTokens: 42, completionTokens: 12 }
            }
            mockRunAgentLoop.mockReturnValue(mockGenerator())

            let stdoutData = ''
            let stderrData = ''
            mockStdout.on('data', (chunk) => {
                stdoutData += chunk.toString()
            })
            mockStderr.on('data', (chunk) => {
                stderrData += chunk.toString()
            })

            const result = await runHeadlessTask('test print prompt', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                print: true,
            })

            expect(result.success).toBe(true)
            expect(stdoutData).toBe('clean response text')
            expect(stdoutData).not.toContain('internal reasoning')
            expect(stdoutData).not.toContain('[Usage:')
            expect(stdoutData).not.toContain('Headless task complete.')
            expect(stderrData).toBe('')
        })

        it('routes diagnostic messages, tool execution headers, status, and compaction to stderr', async () => {
            async function* mockGenerator() {
                yield { type: 'AgentStatus', message: 'scanning repository' }
                yield {
                    type: 'ToolCallStart',
                    toolCall: { name: 'read_file', input: { path: 'file.ts' } },
                }
                yield {
                    type: 'ToolCallResult',
                    result: { output: 'content of file.ts' },
                }
                yield { type: 'ContextCompacted', summary: 'compacted 5 messages' }
                yield { type: 'StreamChunk', content: 'final analysis' }
            }
            mockRunAgentLoop.mockReturnValue(mockGenerator())

            let stdoutData = ''
            let stderrData = ''
            mockStdout.on('data', (chunk) => {
                stdoutData += chunk.toString()
            })
            mockStderr.on('data', (chunk) => {
                stderrData += chunk.toString()
            })

            const result = await runHeadlessTask('diagnose', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                print: true,
            })

            expect(result.success).toBe(true)
            // stdout must strictly be the assistant text
            expect(stdoutData).toBe('final analysis')
            // stderr receives the diagnostic timeline
            expect(stderrData).toContain('[Status: scanning repository]')
            expect(stderrData).toContain('[Tool Executing: read_file]')
            expect(stderrData).toContain('[Tool Result Received]')
            expect(stderrData).toContain('[Context Compacted: compacted 5 messages]')
        })

        it('auto-approves tool execution and answers questions without prompting in print mode', async () => {
            mockRunAgentLoop.mockImplementation(async function* () {
                const perm = await mockAgent.operations.ui.requestPermission({
                    name: 'edit_file',
                    input: { path: 'demo.ts' },
                })
                expect(perm).toEqual({ block: false })

                const ans = await mockAgent.operations.ui.askQuestion([
                    { question: 'Choose format?', options: ['json', 'yaml'] },
                ])
                expect(ans).toBe('json')

                yield { type: 'StreamChunk', content: 'edited and configured' }
            })

            let stdoutData = ''
            mockStdout.on('data', (chunk) => {
                stdoutData += chunk.toString()
            })

            const result = await runHeadlessTask('execute without prompts', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                print: true,
            })

            expect(result.success).toBe(true)
            expect(stdoutData).toBe('edited and configured')
        })

        it('redirects console.log, console.warn, and console.info to stderr preserving stdout', async () => {
            mockRunAgentLoop.mockImplementation(async function* () {
                console.log('diagnostic log message')
                console.warn('warning notice')
                console.info('info telemetry')
                yield { type: 'StreamChunk', content: 'pipeline text' }
            })

            let stdoutData = ''
            let stderrData = ''
            mockStdout.on('data', (chunk) => {
                stdoutData += chunk.toString()
            })
            mockStderr.on('data', (chunk) => {
                stderrData += chunk.toString()
            })

            const result = await runHeadlessTask('test console redirection', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                print: true,
            })

            expect(result.success).toBe(true)
            expect(stdoutData).toBe('pipeline text')
            expect(stderrData).toContain('diagnostic log message')
            expect(stderrData).toContain('warning notice')
            expect(stderrData).toContain('info telemetry')
        })

        it('returns success: false and routes errors to stderr on agent failure in print mode', async () => {
            async function* mockGenerator() {
                yield { type: 'AgentError', error: 'api request failed' }
            }
            mockRunAgentLoop.mockReturnValue(mockGenerator())

            let stdoutData = ''
            let stderrData = ''
            mockStdout.on('data', (chunk) => {
                stdoutData += chunk.toString()
            })
            mockStderr.on('data', (chunk) => {
                stderrData += chunk.toString()
            })

            const result = await runHeadlessTask('failing task', {
                agent: mockAgent,
                stdin: mockStdin as any,
                stdout: mockStdout as any,
                stderr: mockStderr as any,
                print: true,
            })

            expect(result.success).toBe(false)
            expect(result.error).toBe('api request failed')
            expect(stdoutData).toBe('')
            expect(stderrData).toContain('[Error: api request failed]')
        })
    })
})
