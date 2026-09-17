import { render } from 'ink-testing-library'
import React from 'react'
import { describe, expect, it } from 'vitest'

import { TaskTree, type TaskItem } from '../../src/components/task-tree'

describe('TaskTree Component', () => {
    it('renders null when tasks array is empty', () => {
        const { lastFrame } = render(<TaskTree tasks={[]} />)
        expect(lastFrame()).toBe('')
    })

    it('renders running background tasks with tree lines, command, and tail output', () => {
        const tasks: TaskItem[] = [
            {
                id: 'task-1',
                command: 'bun test packages/tui',
                status: 'running',
                createdAt: Date.now() - 5000,
                output: 'PASS test/unit/input-bar.unit.test.tsx\nPASS test/unit/diff-gutter.unit.test.tsx',
            },
            {
                id: 'task-2',
                command: 'Subagent: research',
                status: 'running',
                createdAt: Date.now() - 2000,
            },
        ]

        const { lastFrame } = render(<TaskTree tasks={tasks} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('Background Tasks (2 running)')
        expect(frame).toContain('bun test packages/tui')
        expect(frame).toContain('PASS test/unit/diff-gutter.unit.test.tsx')
        expect(frame).toContain('Subagent: research')
        expect(frame).toContain('├─')
        expect(frame).toContain('└─')
    })

    it('renders completed tasks with success indicator and duration', () => {
        const tasks: TaskItem[] = [
            {
                id: 'task-1',
                command: 'bun run build',
                status: 'completed',
                exitCode: 0,
                createdAt: Date.now() - 4000,
                completedAt: Date.now(),
            },
        ]

        const { lastFrame } = render(<TaskTree tasks={tasks} />)
        const frame = lastFrame() || ''
        expect(frame).toContain('Background Tasks')
        expect(frame).toContain('bun run build')
        expect(frame).toContain('passed')
    })
})
