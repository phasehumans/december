import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { TasksModeMenu } from '../../src/components/menus/tasks-mode-menu'

describe('TasksModeMenu Component (Unit)', () => {
    it('renders task list with standardized selection indicator', () => {
        const tasksData = [
            { id: 'task-1', status: 'running', command: 'bun test --watch' },
            { id: 'task-2', status: 'completed', command: 'git status' },
        ]
        const { lastFrame } = render(
            <TasksModeMenu
                tasksData={tasksData}
                taskSelectedIndex={0}
                taskViewingId={null}
                taskScrollOffset={0}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Tasks')
        expect(output).toContain('task-1')
        expect(output).toContain('task-2')
        expect(output).toContain('[running]')
        expect(output).toContain('[completed]')
        expect(output).toContain('❭')
    })

    it('splits multiline task output using regex and renders lines properly without flattening', () => {
        const tasksData = [
            {
                id: 'task-1',
                status: 'completed',
                command: 'echo -e "Line 1\\nLine 2\\nLine 3"',
                output: 'Line 1\nLine 2\r\nLine 3\nLine 4',
            },
        ]
        const { lastFrame } = render(
            <TasksModeMenu
                tasksData={tasksData}
                taskSelectedIndex={0}
                taskViewingId="task-1"
                taskScrollOffset={0}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Line 1')
        expect(output).toContain('Line 2')
        expect(output).toContain('Line 3')
        expect(output).toContain('Line 4')
        expect(output).toContain('Showing lines 1-4 of 4')
    })

    it('renders task counts, timestamps, commands, and status badges in list view', () => {
        const now = new Date()
        const tenSecondsAgo = new Date(now.getTime() - 10_000)
        const tasksData = [
            {
                id: 'task-10',
                status: 'running',
                command: 'npm run dev',
                pid: 41234,
                createdAt: tenSecondsAgo,
            },
            {
                id: 'task-11',
                status: 'failed',
                command: 'cargo test',
                pid: 41235,
                createdAt: tenSecondsAgo,
                completedAt: now,
                exitCode: 1,
            },
            {
                id: 'task-12',
                status: 'cancelled',
                command: 'grep -rn "foo" .',
                createdAt: tenSecondsAgo,
            },
            {
                id: 'task-13',
                status: 'completed',
                command: 'git pull',
                createdAt: tenSecondsAgo,
                completedAt: new Date(tenSecondsAgo.getTime() + 4200),
            },
        ]

        const { lastFrame } = render(
            <TasksModeMenu
                tasksData={tasksData}
                taskSelectedIndex={0}
                taskViewingId={null}
                taskScrollOffset={0}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Tasks')
        expect(output).toContain('(4 tasks)')
        expect(output).toContain('Agent Backgrounded')
        expect(output).toContain('npm run dev')
        expect(output).toContain('cargo test')
        expect(output).toContain('[running]')
        expect(output).toContain('[failed · exit 1]')
        expect(output).toContain('[cancelled]')
        expect(output).toContain('[completed · 4.2s]')
    })

    it('renders exit code, duration, and line gutter in detail view', () => {
        const start = new Date(Date.now() - 5000)
        const finish = new Date(Date.now())
        const tasksData = [
            {
                id: 'task-99',
                status: 'completed',
                command: 'pytest tests/',
                pid: 56789,
                createdAt: start,
                completedAt: finish,
                exitCode: 0,
                output: 'test passed in 5s',
            },
        ]

        const { lastFrame } = render(
            <TasksModeMenu
                tasksData={tasksData}
                taskSelectedIndex={0}
                taskViewingId="task-99"
                taskScrollOffset={0}
            />
        )
        const output = lastFrame() || ''

        expect(output).toContain('Task: task-99')
        expect(output).toContain('PID: 56789')
        expect(output).toContain('(exit 0)')
        expect(output).toContain('pytest tests/')
        expect(output).toContain('1 | test passed in 5s')
    })

    it('renders clean fallback when task list is empty with full navigation footer', () => {
        const { lastFrame } = render(
            <TasksModeMenu
                tasksData={[]}
                taskSelectedIndex={0}
                taskViewingId={null}
                taskScrollOffset={0}
            />
        )
        const output = lastFrame() || ''
        expect(output).toContain('No background tasks.')
        expect(output).toContain('navigate')
        expect(output).toContain('view logs')
        expect(output).toContain('kill')
        expect(output).toContain('remove')
        expect(output).toContain('clear finished')
        expect(output).toContain('close')
    })

    it('closes menu on Escape or Ctrl+T in list mode', async () => {
        const onClose = mock()
        const { stdin } = render(
            <TasksModeMenu
                tasksData={[{ id: 'task-1', status: 'running', command: 'sleep 10' }]}
                onClose={onClose}
            />
        )

        stdin.write('\u001B') // Escape
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(onClose).toHaveBeenCalledTimes(1)

        stdin.write('\x14') // Ctrl+T
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(onClose).toHaveBeenCalledTimes(2)
    })

    it('exits detail view on Escape or Ctrl+T', async () => {
        const setTaskViewingId = mock()
        const { stdin } = render(
            <TasksModeMenu
                tasksData={[
                    {
                        id: 'task-1',
                        status: 'running',
                        command: 'sleep 10',
                        output: 'running...',
                    },
                ]}
                taskViewingId="task-1"
                setTaskViewingId={setTaskViewingId}
            />
        )

        stdin.write('\u001B') // Escape
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(setTaskViewingId).toHaveBeenCalledWith(null)

        stdin.write('\x14') // Ctrl+T
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(setTaskViewingId).toHaveBeenCalledWith(null)
    })

    it('triggers handleKillTask on k key in list mode', async () => {
        const handleKillTask = mock()
        const { stdin } = render(
            <TasksModeMenu
                tasksData={[{ id: 'task-1', status: 'running', command: 'sleep 10' }]}
                handleKillTask={handleKillTask}
            />
        )

        stdin.write('k')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleKillTask).toHaveBeenCalledWith('task-1')
    })

    it('triggers handleRemoveTask on x key in list mode', async () => {
        const handleRemoveTask = mock()
        const { stdin } = render(
            <TasksModeMenu
                tasksData={[{ id: 'task-1', status: 'completed', command: 'git status' }]}
                handleRemoveTask={handleRemoveTask}
            />
        )

        stdin.write('x')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleRemoveTask).toHaveBeenCalledWith('task-1')
    })

    it('triggers handleClearCompletedTasks on c key in list mode', async () => {
        const handleClearCompletedTasks = mock()
        const { stdin } = render(
            <TasksModeMenu
                tasksData={[{ id: 'task-1', status: 'completed', command: 'git status' }]}
                handleClearCompletedTasks={handleClearCompletedTasks}
            />
        )

        stdin.write('c')
        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(handleClearCompletedTasks).toHaveBeenCalledTimes(1)
    })
})
