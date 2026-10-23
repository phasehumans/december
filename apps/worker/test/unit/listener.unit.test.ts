import { prisma } from '@december/database'
import { describe, it, expect, mock } from 'bun:test'

import { MUTATING_TOOL_NAMES, processGrpcStream, updateSandboxGitDiff } from '../../src/listener'

describe('Worker Listener Unit Tests', () => {
    it('should process grpc stream, publish to Redis, and set session status to STOPPED on success', async () => {
        const updateMock = mock(async () => ({}) as any)
        prisma.session.update = updateMock as any

        const fakeEvents = [
            { data: JSON.stringify({ type: 'AgentStart' }) },
            { data: JSON.stringify({ type: 'TurnStart' }) },
            { data: JSON.stringify({ type: 'TurnEnd' }) },
            { data: JSON.stringify({ type: 'AgentEnd' }) },
        ]

        const streamGenerator = (async function* () {
            for (const ev of fakeEvents) {
                yield ev
            }
        })()

        await processGrpcStream('sess-listener-success', streamGenerator)

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 'sess-listener-success' },
            data: {
                vmStatus: 'STOPPED',
                status: 'PARKED',
                leaseOwner: null,
                leaseExpiresAt: null,
            },
        })
    })

    it('should set session status to FAILED when AgentError event is encountered in stream', async () => {
        const updateMock = mock(async () => ({}) as any)
        prisma.session.update = updateMock as any

        const fakeEvents = [
            { data: JSON.stringify({ type: 'AgentStart' }) },
            { data: JSON.stringify({ type: 'AgentError', error: 'Container Out of Memory' }) },
            { data: JSON.stringify({ type: 'AgentEnd' }) },
        ]

        const streamGenerator = (async function* () {
            for (const ev of fakeEvents) {
                yield ev
            }
        })()

        await processGrpcStream('sess-listener-fail', streamGenerator)

        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 'sess-listener-fail' },
            data: {
                vmStatus: 'FAILED',
                status: 'FAILED',
                leaseOwner: null,
                leaseExpiresAt: null,
            },
        })
    })

    it('should record UsageEvent in Prisma when AgentUsage event is processed', async () => {
        const createUsageMock = mock(async () => ({}) as any)
        const updateUserMock = mock(async () => ({}) as any)
        prisma.usageEvent.create = createUsageMock as any
        prisma.user.update = updateUserMock as any
        prisma.session.findUnique = mock(async () => ({ userId: 'usr-usage-1' }) as any) as any
        prisma.session.update = mock(async () => ({}) as any) as any
        prisma.$queryRaw = mock(async () => [{ creditBalance: 500 }] as any) as any
        prisma.$transaction = mock(async (cb: any) => cb(prisma)) as any

        const fakeEvents = [
            {
                data: JSON.stringify({
                    type: 'AgentUsage',
                    model: 'gemini-3.6-flash',
                    promptTokens: 500,
                    completionTokens: 100,
                }),
            },
        ]

        const streamGenerator = (async function* () {
            for (const ev of fakeEvents) {
                yield ev
            }
        })()

        await processGrpcStream('sess-usage-1', streamGenerator)

        expect(createUsageMock).toHaveBeenCalled()
        expect(updateUserMock).toHaveBeenCalled()
    })

    describe('Ticket #586: Native Git Diff & Mutating Tool Filtering', () => {
        it('MUTATING_TOOL_NAMES includes mutating tools and strictly excludes read-only tools', () => {
            expect(MUTATING_TOOL_NAMES.has('write_file')).toBe(true)
            expect(MUTATING_TOOL_NAMES.has('edit_file')).toBe(true)
            expect(MUTATING_TOOL_NAMES.has('create_file')).toBe(true)
            expect(MUTATING_TOOL_NAMES.has('replace_file_content')).toBe(true)

            // Read-only tools must never be flagged as mutating
            expect(MUTATING_TOOL_NAMES.has('read_file')).toBe(false)
            expect(MUTATING_TOOL_NAMES.has('grep')).toBe(false)
            expect(MUTATING_TOOL_NAMES.has('grep_search')).toBe(false)
            expect(MUTATING_TOOL_NAMES.has('find')).toBe(false)
            expect(MUTATING_TOOL_NAMES.has('find_files')).toBe(false)
            expect(MUTATING_TOOL_NAMES.has('ls')).toBe(false)
        })

        it('updateSandboxGitDiff queries git status and diff from sandbox commands', async () => {
            const executedCommands: string[] = []
            const mockSandbox = {
                commands: {
                    run: mock(async (cmd: string) => {
                        executedCommands.push(cmd)
                        if (cmd.includes('git status --porcelain')) {
                            return { stdout: ' M src/App.tsx\n?? new.ts\n' }
                        }
                        if (cmd.includes('git diff')) {
                            return { stdout: 'diff --git a/src/App.tsx b/src/App.tsx\n+new line\n' }
                        }
                        return { stdout: '' }
                    }),
                },
            }

            const result = await updateSandboxGitDiff('sess-git-diff-test', mockSandbox)
            expect(result).not.toBeNull()
            expect(result?.gitStatus).toContain('M src/App.tsx')
            expect(result?.gitDiff).toContain('diff --git a/src/App.tsx')
            expect(executedCommands.some((c) => c.includes('git status --porcelain'))).toBe(true)
            expect(executedCommands.some((c) => c.includes('git diff'))).toBe(true)
        })
    })
})
