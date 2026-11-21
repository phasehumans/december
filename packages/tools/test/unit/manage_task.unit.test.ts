import { describe, expect, test, mock } from 'bun:test'

import { ManageTaskTool } from '../../src/manage_task'
import { createMockContext } from '../mock-context'

describe('ManageTaskTool (Unit)', () => {
    test('should get task status successfully', async () => {
        const context = createMockContext()
        context.operations.bash.getTaskStatus = mock(async (id: string) => ({
            status: 'running',
            output: `Output for ${id}`,
        }))

        const result = await ManageTaskTool.execute({ action: 'status', taskId: 't-1' }, context)
        expect(context.operations.bash.getTaskStatus).toHaveBeenCalledWith('t-1')
        expect(result).toContain('Task [t-1] is currently: running')
        expect(result).toContain('Output for t-1')
    })

    test('status shows only the last 20 lines', async () => {
        const context = createMockContext()
        const output = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
        context.operations.bash.getTaskStatus = mock(async () => ({
            status: 'failed',
            exitCode: 2,
            elapsedMs: 14_000,
            pid: 42,
            output,
        }))

        const result = await ManageTaskTool.execute({ action: 'status', taskId: 't-1' }, context)
        expect(result).toContain('failed, exit 2, 14s')
        expect(result).toContain('PID: 42')
        expect(result).toContain('[... 30 earlier lines ...]')
        expect(result).toContain('line 49')
        expect(result).not.toContain('line 29\n')
    })

    test('list shows every task without a task id', async () => {
        const context = createMockContext()
        context.operations.bash.listTasks = mock(async () => [
            {
                id: 'task-1',
                type: 'shell' as const,
                command: 'npm run dev',
                status: 'running' as const,
                elapsedMs: 70_000,
            },
            {
                id: 'sub-1',
                type: 'subagent' as const,
                role: 'explore',
                command: 'find\nauth',
                status: 'completed' as const,
                exitCode: 0,
                turns: 4,
                elapsedMs: 3_000,
            },
        ])

        const result = await ManageTaskTool.execute({ action: 'list' }, context)
        expect(result).toContain('Background tasks (2):')
        expect(result).toContain('- [task-1] shell | running, 1m 10s | npm run dev')
        expect(result).toContain(
            '- [sub-1] subagent explore | completed, exit 0, 3s, 4 turns | find auth'
        )
    })

    test('list reports when there are no tasks', async () => {
        const context = createMockContext()
        context.operations.bash.listTasks = mock(async () => [])
        expect(await ManageTaskTool.execute({ action: 'list' }, context)).toBe(
            'No background tasks.'
        )
    })

    test('output returns new output and passes the filter through', async () => {
        const context = createMockContext()
        context.operations.bash.readTaskOutput = mock(async () => ({
            status: 'running',
            output: 'GET /api 500',
        }))

        const result = await ManageTaskTool.execute(
            { action: 'output', taskId: 't-1', filter: '500' },
            context
        )
        expect(context.operations.bash.readTaskOutput).toHaveBeenCalledWith('t-1', '500')
        expect(result).toContain('New output:\nGET /api 500')
    })

    test('output says when nothing is new', async () => {
        const context = createMockContext()
        context.operations.bash.readTaskOutput = mock(async () => ({
            status: 'running',
            output: '',
        }))
        const result = await ManageTaskTool.execute({ action: 'output', taskId: 't-1' }, context)
        expect(result).toContain('(no new output)')
    })

    test('output reports errors such as a bad regex', async () => {
        const context = createMockContext()
        context.operations.bash.readTaskOutput = mock(async () => {
            throw new Error('invalid filter regex: bad')
        })
        const result = await ManageTaskTool.execute(
            { action: 'output', taskId: 't-1', filter: '(' },
            context
        )
        expect(result).toBe('Error: invalid filter regex: bad')
    })

    test('requires a task id for every action except list', async () => {
        const context = createMockContext()
        for (const action of ['status', 'output', 'kill'] as const) {
            const result = await ManageTaskTool.execute({ action }, context)
            expect(result).toContain('"taskId" is required')
        }
    })

    test('should handle status error gracefully', async () => {
        const context = createMockContext()
        context.operations.bash.getTaskStatus = mock(async () => {
            throw new Error('Task not found')
        })

        const result = await ManageTaskTool.execute({ action: 'status', taskId: 'bad-id' }, context)
        expect(result).toBe('Error: Task not found')
    })

    test('should kill task successfully', async () => {
        const context = createMockContext()
        context.operations.bash.killTask = mock(async () => true)

        const result = await ManageTaskTool.execute({ action: 'kill', taskId: 't-1' }, context)
        expect(context.operations.bash.killTask).toHaveBeenCalledWith('t-1')
        expect(result).toBe('Successfully killed task [t-1].')
    })

    test('should handle unkillable or finished task gracefully', async () => {
        const context = createMockContext()
        context.operations.bash.killTask = mock(async () => false)

        const result = await ManageTaskTool.execute({ action: 'kill', taskId: 't-dead' }, context)
        expect(result).toBe('Task [t-dead] is either not running or could not be killed.')
    })

    test('should return error if task operations are unsupported in environment', async () => {
        const context = createMockContext()
        delete context.operations.bash.getTaskStatus
        delete context.operations.bash.killTask

        const statusRes = await ManageTaskTool.execute({ action: 'status', taskId: 't-1' }, context)
        expect(statusRes).toContain('Error: Task management is not supported')

        const killRes = await ManageTaskTool.execute({ action: 'kill', taskId: 't-1' }, context)
        expect(killRes).toContain('Error: Task management is not supported')
    })
})
