import { describe, it, expect } from 'bun:test'
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
        expect(output).toContain('RUNNING')
        expect(output).toContain('COMPLETED')
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

    it('renders column headers, task counts, and duration metrics', () => {
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

        // Column headers & header count
        expect(output).toContain('Tasks')
        expect(output).toContain('(2 tasks)')
        expect(output).toContain('ID')
        expect(output).toContain('STATUS')
        expect(output).toContain('PID')
        expect(output).toContain('DURATION')
        expect(output).toContain('COMMAND')

        // PID & Exit code
        expect(output).toContain('41234')
        expect(output).toContain('EXIT 1')
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

    it('renders clean fallback when task list is empty', () => {
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
    })
})
