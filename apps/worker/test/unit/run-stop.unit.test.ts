import { prisma } from '@december/database'
import { pausesAfterStop } from '@december/shared'
import { afterAll, describe, expect, it } from 'bun:test'

import { processGrpcStream } from '../../src/listener'
import {
    closeStoppedTurn,
    createInterruptHub,
    failedRunEvents,
    runKillableCommand,
    stoppableRun,
    stoppedRunEnd,
    stoppedToolResult,
    watchRunStop,
} from '../../src/run-stop'

import type { InterruptListener, RunEvent, RunInterrupt } from '../../src/run-stop'

/** the redis subscription of the worker, as a list of listeners the test can call */
const fakeInterrupts = () => {
    const listeners = new Set<InterruptListener>()
    return {
        subscribe: (listener: InterruptListener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        send: (interrupt: RunInterrupt) => {
            for (const listener of [...listeners]) listener(interrupt)
        },
        count: () => listeners.size,
    }
}

/** an agent loop: its events come out in order, then it waits (a tool that does not end) */
const fakeLoop = (events: RunEvent[], options: { ends?: boolean } = {}) => {
    let started = false
    const loop = (async function* () {
        started = true
        for (const event of events) yield event
        if (!options.ends) await new Promise(() => {})
    })()
    return { loop, started: () => started }
}

const readAll = async (run: AsyncIterable<RunEvent>) => {
    const events: RunEvent[] = []
    for await (const event of run) events.push(event)
    return events
}

describe('stop of a running agent (#637)', () => {
    describe('the watch of one run', () => {
        it('an interrupt for this session stops the agent, with the reason', () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            let aborts = 0
            expect(stop.attach(() => aborts++)).toBe(true)

            interrupts.send({ sessionId: 'sess-1', reason: 'limit' })

            expect(aborts).toBe(1)
            expect(stop.stoppedBy()).toBe('limit')
            expect(stop.signal.aborted).toBe(true)
        })

        it('an interrupt for another session is ignored', () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            let aborts = 0
            stop.attach(() => aborts++)

            interrupts.send({ sessionId: 'sess-2', reason: 'user' })

            expect(aborts).toBe(0)
            expect(stop.stoppedBy()).toBe(null)
            expect(stop.signal.aborted).toBe(false)
        })

        it('a second interrupt does nothing', () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            let aborts = 0
            stop.attach(() => aborts++)

            interrupts.send({ sessionId: 'sess-1', reason: 'user' })
            interrupts.send({ sessionId: 'sess-1', reason: 'limit' })

            expect(aborts).toBe(1)
            expect(stop.stoppedBy()).toBe('user')
        })

        it('an interrupt that arrives before the agent starts cancels the start', () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })

            // the sandbox is still starting
            interrupts.send({ sessionId: 'sess-1', reason: 'user' })

            let aborts = 0
            expect(stop.attach(() => aborts++)).toBe(false)
            expect(aborts).toBe(0)
            expect(stop.stoppedBy()).toBe('user')
        })

        it('the listener is removed when the run ends', () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            let aborts = 0
            stop.attach(() => aborts++)
            expect(interrupts.count()).toBe(1)

            stop.end()
            stop.end()

            expect(interrupts.count()).toBe(0)
            expect(stop.stoppedBy()).toBe(null)
            expect(aborts).toBe(0)
        })
    })

    describe('the events of a run that can be stopped', () => {
        it('a run that is not stopped sends the events of the agent, unchanged', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            const { loop } = fakeLoop(
                [
                    { type: 'AgentStart' },
                    { type: 'StreamChunk', content: 'done' },
                    { type: 'AgentEnd' },
                ],
                { ends: true }
            )

            const events = await readAll(stoppableRun({ events: loop, stop, abort: () => {} }))

            expect(events).toEqual([
                { type: 'AgentStart' },
                { type: 'StreamChunk', content: 'done' },
                { type: 'AgentEnd' },
            ])
        })

        it('a stop ends the run at once: the tool in flight is closed, then the run ends as stopped', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            // the second tool never returns
            const { loop } = fakeLoop([
                { type: 'AgentStart' },
                { type: 'ToolCallStart', toolCall: { id: 'tool-1', name: 'read_file' } },
                { type: 'ToolCallResult', result: { toolCallId: 'tool-1', result: 'ok' } },
                { type: 'ToolCallStart', toolCall: { id: 'tool-2', name: 'bash' } },
            ])
            let aborts = 0
            const run = stoppableRun({ events: loop, stop, abort: () => aborts++ })

            const before: RunEvent[] = []
            for (let i = 0; i < 4; i++) before.push((await run.next()).value as RunEvent)
            const rest = readAll(run)
            interrupts.send({ sessionId: 'sess-1', reason: 'limit' })

            expect(before.map((event) => event.type)).toEqual([
                'AgentStart',
                'ToolCallStart',
                'ToolCallResult',
                'ToolCallStart',
            ])
            expect(await rest).toEqual([
                {
                    type: 'ToolCallResult',
                    result: { toolCallId: 'tool-2', result: '', error: 'Stopped', stopped: true },
                },
                { type: 'AgentInterrupt' },
                { type: 'AgentEnd', stopped: true, reason: 'limit' },
            ])
            expect(aborts).toBe(1)
        })

        it('an interrupt before the agent starts: the agent loop is never started', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            const { loop, started } = fakeLoop([{ type: 'AgentStart' }])
            let aborts = 0

            interrupts.send({ sessionId: 'sess-1', reason: 'user' })
            const events = await readAll(
                stoppableRun({ events: loop, stop, abort: () => aborts++ })
            )

            expect(events).toEqual([
                { type: 'AgentInterrupt' },
                { type: 'AgentEnd', stopped: true, reason: 'user' },
            ])
            expect(started()).toBe(false)
            expect(aborts).toBe(0)
        })

        it('events the agent sends after the stop are dropped', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            const { loop } = fakeLoop(
                [
                    { type: 'AgentStart' },
                    { type: 'StreamChunk', content: 'late' },
                    { type: 'AgentEnd' },
                ],
                { ends: true }
            )
            const run = stoppableRun({ events: loop, stop, abort: () => {} })

            expect((await run.next()).value).toEqual({ type: 'AgentStart' })
            // the stop arrives while the reader still works on the first event
            interrupts.send({ sessionId: 'sess-1', reason: 'user' })

            expect(await readAll(run)).toEqual([
                { type: 'AgentInterrupt' },
                { type: 'AgentEnd', stopped: true, reason: 'user' },
            ])
        })

        it('aborts again when the read that was in flight at the stop settles', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: interrupts.subscribe })
            // the first read is slow: the agent is still starting, so the first abort finds nothing
            let finishStart = () => {}
            const starting = new Promise<void>((resolve) => {
                finishStart = resolve
            })
            const loop = (async function* (): AsyncGenerator<RunEvent> {
                await starting
                yield { type: 'AgentStart' }
            })()
            let aborts = 0
            const rest = readAll(stoppableRun({ events: loop, stop, abort: () => aborts++ }))

            interrupts.send({ sessionId: 'sess-1', reason: 'user' })
            expect(await rest).toEqual([
                { type: 'AgentInterrupt' },
                { type: 'AgentEnd', stopped: true, reason: 'user' },
            ])
            expect(aborts).toBe(1)

            finishStart()
            await new Promise((resolve) => setTimeout(resolve, 0))
            expect(aborts).toBe(2)
        })
    })

    describe('the interrupts this worker gets from redis', () => {
        /** the subscriber connection: the test plays the redis server */
        const fakeRedis = () => {
            const handlers = new Map<string, (...args: any[]) => void>()
            const patterns: string[] = []
            return {
                redis: {
                    // a connection that is not open yet
                    status: 'connecting',
                    on: (event: string, handler: (...args: any[]) => void) => {
                        handlers.set(event, handler)
                    },
                    psubscribe: async (pattern: string) => {
                        patterns.push(pattern)
                    },
                },
                patterns,
                ready: () => handlers.get('ready')?.(),
                message: (channel: string, message: string) =>
                    handlers.get('pmessage')?.('session_interrupts:*', channel, message),
            }
        }

        it('subscribes when the connection is ready, and again after a reconnect', async () => {
            const { redis, patterns, ready } = fakeRedis()
            createInterruptHub(redis)
            await new Promise((resolve) => setTimeout(resolve, 0))
            expect(patterns).toEqual([])

            ready()
            ready()
            await new Promise((resolve) => setTimeout(resolve, 0))

            expect(patterns).toEqual(['session_interrupts:*', 'session_interrupts:*'])
        })

        it('gives the interrupt to the run of that session, with the reason', () => {
            const { redis, message } = fakeRedis()
            const hub = createInterruptHub(redis)
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: hub.subscribe })
            const other = watchRunStop({ sessionId: 'sess-2', subscribe: hub.subscribe })

            message('session_interrupts:sess-1', '{"type":"INTERRUPT","reason":"limit"}')

            expect(stop.stoppedBy()).toBe('limit')
            expect(other.stoppedBy()).toBe(null)
        })

        it('an interrupt with no reason is a stop by the user', () => {
            const { redis, message } = fakeRedis()
            const hub = createInterruptHub(redis)
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: hub.subscribe })

            message('session_interrupts:sess-1', '{"type":"INTERRUPT"}')

            expect(stop.stoppedBy()).toBe('user')
        })

        it('ignores other channels and messages that are not an interrupt', () => {
            const { redis, message } = fakeRedis()
            const hub = createInterruptHub(redis)
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: hub.subscribe })

            message('session_events:sess-1', '{"type":"INTERRUPT","reason":"user"}')
            message('session_interrupts:sess-1', '{"type":"ClientDisconnect"}')
            message('session_interrupts:sess-1', 'not json')

            expect(stop.stoppedBy()).toBe(null)
        })

        it('a run that ended gets no more interrupts', () => {
            const { redis, message } = fakeRedis()
            const hub = createInterruptHub(redis)
            const stop = watchRunStop({ sessionId: 'sess-1', subscribe: hub.subscribe })

            stop.end()
            message('session_interrupts:sess-1', '{"type":"INTERRUPT","reason":"user"}')

            expect(stop.stoppedBy()).toBe(null)
            expect(hub.listenerCount()).toBe(0)
        })
    })

    describe('the saved message of a stopped turn', () => {
        it('closes a tool that still runs and ends with the interrupt', () => {
            const text = { type: 'text', content: 'I will run the tests.' }
            const done = {
                type: 'command',
                toolCallId: 'tool-1',
                toolName: 'read_file',
                status: 'success',
                output: 'ok',
            }
            const running = {
                type: 'command',
                toolCallId: 'tool-2',
                toolName: 'bash',
                status: 'running',
                output: '',
            }

            const closed = closeStoppedTurn({
                content: 'I will run the tests.',
                blocks: [text, done, running],
            })

            expect(closed).toEqual({
                content: 'I will run the tests.',
                blocks: [
                    text,
                    done,
                    { ...running, status: 'error', output: 'Stopped' },
                    { type: 'interrupt' },
                ],
            })
        })

        it('keeps the output a stopped tool already sent', () => {
            const closed = closeStoppedTurn({
                content: '',
                blocks: [
                    {
                        type: 'command',
                        toolCallId: 'tool-1',
                        toolName: 'bash',
                        status: 'running',
                        output: 'installing...\n',
                    },
                ],
            })

            expect(closed.blocks[0]).toMatchObject({ status: 'error', output: 'installing...\n' })
        })

        it('a turn with no text and no tool still has text for the next model call', () => {
            expect(closeStoppedTurn({ content: '', blocks: [] })).toEqual({
                content: 'Stopped.',
                blocks: [{ type: 'interrupt' }],
            })
        })
    })

    describe('a sandbox command of a run that can be stopped', () => {
        /** a command in the sandbox: it runs until it is killed or the test finishes it */
        const fakeCommand = () => {
            let kills = 0
            let finish = (_result: { exitCode: number }) => {}
            const result = new Promise<{ exitCode: number }>((resolve) => {
                finish = resolve
            })
            return {
                start: async () => ({
                    wait: () => result,
                    kill: async () => {
                        kills++
                        finish({ exitCode: 137 })
                        return true
                    },
                }),
                finish,
                kills: () => kills,
            }
        }

        it('a stop kills the command that runs', async () => {
            const controller = new AbortController()
            const command = fakeCommand()
            const running = runKillableCommand({
                start: command.start,
                signal: controller.signal,
            })
            await new Promise((resolve) => setTimeout(resolve, 0))
            expect(command.kills()).toBe(0)

            controller.abort()

            expect(await running).toEqual({ exitCode: 137 })
            expect(command.kills()).toBe(1)
        })

        it('a command that starts after the stop is killed at once', async () => {
            const controller = new AbortController()
            controller.abort()
            const command = fakeCommand()

            const result = await runKillableCommand({
                start: command.start,
                signal: controller.signal,
            })

            expect(result).toEqual({ exitCode: 137 })
            expect(command.kills()).toBe(1)
        })

        it('a command that ends by itself is not killed by a later stop', async () => {
            const controller = new AbortController()
            const command = fakeCommand()
            const running = runKillableCommand({
                start: command.start,
                signal: controller.signal,
            })
            command.finish({ exitCode: 0 })

            expect(await running).toEqual({ exitCode: 0 })
            controller.abort()
            expect(command.kills()).toBe(0)
        })

        it('the time limit kills the command, and the caller learns that it timed out', async () => {
            const command = fakeCommand()

            const running = runKillableCommand({
                start: command.start,
                signal: new AbortController().signal,
                timeoutMs: 20,
            })

            const error = await running.then(
                () => null,
                (caught: Error) => caught
            )
            expect(error?.name).toBe('TimeoutError')
            expect(error?.message).toBe('the command timed out')
            expect(command.kills()).toBe(1)
        })

        it('a time limit of the sandbox itself kills the command too', async () => {
            let kills = 0
            const timeout = Object.assign(new Error('context deadline exceeded: timed out'), {
                name: 'TimeoutError',
            })

            const running = runKillableCommand({
                start: async () => ({
                    wait: () => Promise.reject(timeout),
                    kill: async () => {
                        kills++
                        return true
                    },
                }),
                signal: new AbortController().signal,
                timeoutMs: 60_000,
            })

            expect(await running.catch((caught: Error) => caught)).toBe(timeout)
            expect(kills).toBe(1)
        })

        it('a command that ends in time is not killed', async () => {
            const command = fakeCommand()
            const running = runKillableCommand({
                start: command.start,
                signal: new AbortController().signal,
                timeoutMs: 20,
            })
            command.finish({ exitCode: 0 })

            expect(await running).toEqual({ exitCode: 0 })
            await new Promise((resolve) => setTimeout(resolve, 40))
            expect(command.kills()).toBe(0)
        })

        it('a sandbox with no command handles (dev mode) gives its result as it is', async () => {
            const result = await runKillableCommand({
                start: async () => ({ exitCode: 0, stdout: 'ok' }),
                signal: new AbortController().signal,
            })

            expect(result).toEqual({ exitCode: 0, stdout: 'ok' })
        })
    })

    describe('a stop that came before the worker listened', () => {
        it('the run reads the stop request when its watch starts, and never starts', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({
                sessionId: 'sess-1',
                subscribe: interrupts.subscribe,
                readStopRequest: async () => 'user',
            })
            await stop.ready

            expect(stop.stoppedBy()).toBe('user')
            expect(stop.signal.aborted).toBe(true)
            const agent = fakeLoop([{ type: 'AgentStart' }])
            expect(
                await readAll(stoppableRun({ events: agent.loop, stop, abort: () => {} }))
            ).toEqual([
                { type: 'AgentInterrupt' },
                { type: 'AgentEnd', stopped: true, reason: 'user' },
            ])
            expect(agent.started()).toBe(false)
        })

        it('keeps the reason of a spend limit', async () => {
            const stop = watchRunStop({
                sessionId: 'sess-1',
                subscribe: fakeInterrupts().subscribe,
                readStopRequest: async () => 'limit',
            })
            await stop.ready

            expect(stop.stoppedBy()).toBe('limit')
        })

        it('a run with no stop request works, and a later stop still reaches it', async () => {
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({
                sessionId: 'sess-1',
                subscribe: interrupts.subscribe,
                readStopRequest: async () => null,
            })
            await stop.ready
            expect(stop.stoppedBy()).toBe(null)

            interrupts.send({ sessionId: 'sess-1', reason: 'user' })
            expect(stop.stoppedBy()).toBe('user')
        })

        it('the watch listens before it reads, so a stop between the two is not lost', async () => {
            const interrupts = fakeInterrupts()
            let listenersAtRead = -1
            const stop = watchRunStop({
                sessionId: 'sess-1',
                subscribe: interrupts.subscribe,
                readStopRequest: async () => {
                    listenersAtRead = interrupts.count()
                    return null
                },
            })
            await stop.ready

            expect(listenersAtRead).toBe(1)
        })

        it('a request that cannot be read does not stop the run', async () => {
            const stop = watchRunStop({
                sessionId: 'sess-1',
                subscribe: fakeInterrupts().subscribe,
                readStopRequest: async () => {
                    throw new Error('redis is down')
                },
            })
            await stop.ready

            expect(stop.stoppedBy()).toBe(null)
        })

        it('a run that ended is not stopped by a late read', async () => {
            let answer = (_reason: 'user' | null) => {}
            const stop = watchRunStop({
                sessionId: 'sess-1',
                subscribe: fakeInterrupts().subscribe,
                readStopRequest: () => new Promise((resolve) => (answer = resolve)),
            })
            // the read is on its way when the run ends
            await new Promise((resolve) => setTimeout(resolve, 0))
            stop.end()
            answer('user')
            await stop.ready

            expect(stop.stoppedBy()).toBe(null)
        })
    })

    describe('the parts of a stopped run', () => {
        it('closes a tool that was running as stopped', () => {
            expect(stoppedToolResult('call-1')).toEqual({
                type: 'ToolCallResult',
                result: { toolCallId: 'call-1', result: '', error: 'Stopped', stopped: true },
            })
        })

        it('ends a run that a spend limit held before it started', () => {
            expect(stoppedRunEnd('limit')).toEqual({
                type: 'AgentEnd',
                stopped: true,
                reason: 'limit',
            })
        })
    })

    describe('the pause of the sandbox after a stop', () => {
        it('pauses when the session has no run, or only the run that was stopped', () => {
            expect(pausesAfterStop({ markOwner: null, stoppedRunId: 'run-1' })).toBe(true)
            expect(pausesAfterStop({ markOwner: 'run-1', stoppedRunId: 'run-1' })).toBe(true)
            expect(pausesAfterStop({ markOwner: null, stoppedRunId: null })).toBe(true)
        })

        it('leaves the sandbox under an agent that is still going to run', () => {
            expect(pausesAfterStop({ markOwner: 'run-2', stoppedRunId: 'run-1' })).toBe(false)
            expect(pausesAfterStop({ markOwner: 'run-2', stoppedRunId: null })).toBe(false)
        })
    })

    describe('a run that fails before the agent starts', () => {
        it('sends the error, then the end of the run, marked as failed', () => {
            const error = {
                type: 'AgentError',
                code: 'INSUFFICIENT_CREDITS',
                error: 'Insufficient wallet credits',
            }

            expect(failedRunEvents(error)).toEqual([
                {
                    type: 'AgentError',
                    code: 'INSUFFICIENT_CREDITS',
                    error: 'Insufficient wallet credits',
                },
                { type: 'AgentEnd', failed: true },
            ])
        })
    })

    describe('the end of a run in the listener', () => {
        // restored after the suite so later database tests in the same run get the real client
        const real = {
            sessionUpdate: prisma.session.update,
            sessionFindUnique: prisma.session.findUnique,
            messageFindFirst: prisma.message.findFirst,
            messageCreate: prisma.message.create,
        }
        afterAll(() => {
            prisma.session.update = real.sessionUpdate
            prisma.session.findUnique = real.sessionFindUnique
            prisma.message.findFirst = real.messageFindFirst
            prisma.message.create = real.messageCreate
        })

        /** runs the listener on these events, in a sandbox with a changed file */
        const runListener = async (sessionId: string, events: RunEvent[]) => {
            const sessionUpdates: any[] = []
            const savedMessages: any[] = []
            const commands: string[] = []
            prisma.session.update = (async (args: any) => {
                sessionUpdates.push(args.data)
                return {}
            }) as any
            prisma.session.findUnique = (async () => ({
                id: sessionId,
                userId: null,
                title: 'Add a health route',
                branch: 'main',
                githubRun: null,
                settings: null,
            })) as any
            prisma.message.findFirst = (async () => null) as any
            prisma.message.create = (async (args: any) => {
                savedMessages.push(args.data)
                return {}
            }) as any
            const sandbox = {
                commands: {
                    run: async (command: string) => {
                        commands.push(command)
                        return {
                            exitCode: 0,
                            stdout: command.startsWith('git status') ? ' M src/app.ts' : '',
                        }
                    },
                },
            }
            const interrupts = fakeInterrupts()
            const stop = watchRunStop({ sessionId, subscribe: interrupts.subscribe })
            const stream = (async function* () {
                for (const event of events) yield { data: JSON.stringify(event) }
            })()

            await processGrpcStream(sessionId, stream, sandbox, { stop })

            return { sessionUpdates, savedMessages, commands, interrupts }
        }

        const work: RunEvent[] = [
            { type: 'AgentStart' },
            { type: 'StreamChunk', content: 'I will add the route.' },
            { type: 'ToolCallStart', toolCall: { id: 'tool-1', name: 'bash', input: {} } },
        ]

        it('a run that ends by itself commits the work on the task branch', async () => {
            const { commands, interrupts } = await runListener('sess-run-ended', [
                ...work,
                { type: 'ToolCallResult', result: { toolCallId: 'tool-1', result: 'ok' } },
                { type: 'TurnEnd' },
                { type: 'AgentEnd' },
            ])

            expect(commands.some((command) => command.includes('git commit'))).toBe(true)
            expect(interrupts.count()).toBe(0)
        })

        it('a stopped run does not commit, push or open a pull request, and is idle after', async () => {
            const { commands, sessionUpdates, savedMessages, interrupts } = await runListener(
                'sess-run-stopped',
                [
                    ...work,
                    {
                        type: 'ToolCallResult',
                        result: {
                            toolCallId: 'tool-1',
                            result: '',
                            error: 'Stopped',
                            stopped: true,
                        },
                    },
                    { type: 'AgentInterrupt' },
                    { type: 'AgentEnd', stopped: true, reason: 'user' },
                ]
            )

            expect(
                commands.filter((command) => /git (commit|push|checkout)/.test(command))
            ).toEqual([])
            // the last write of the run: idle, with no lease
            expect(sessionUpdates[sessionUpdates.length - 1]).toEqual({
                vmStatus: 'STOPPED',
                status: 'PARKED',
                leaseOwner: null,
                leaseExpiresAt: null,
            })
            expect(savedMessages).toHaveLength(1)
            expect(savedMessages[0]).toMatchObject({
                role: 'ASSISTANT',
                status: 'done',
                content: 'I will add the route.',
            })
            expect(savedMessages[0].blocks).toEqual([
                { type: 'text', content: 'I will add the route.' },
                {
                    type: 'command',
                    toolCallId: 'tool-1',
                    toolName: 'bash',
                    toolInput: {},
                    status: 'error',
                    output: 'Stopped',
                },
                { type: 'interrupt' },
            ])
            expect(interrupts.count()).toBe(0)
        })
    })
})
