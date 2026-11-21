import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { TaskManager } from '../src/task-manager'
import {
    attachTaskNotifications,
    formatTaskNotification,
    shouldNotify,
} from '../src/task-notifications'

import type { ChildProcess } from 'node:child_process'

describe('task notifications', () => {
    let manager: TaskManager
    let steered: string[]
    let notices: Array<{ text: string; tone: string }>
    let detach: () => void
    let killSpy: any

    beforeEach(() => {
        manager = new TaskManager()
        steered = []
        notices = []
        detach = attachTaskNotifications(manager, {
            steer: (text) => steered.push(text),
            notice: (text, tone) => notices.push({ text, tone }),
        })
        killSpy = spyOn(process, 'kill').mockImplementation(() => true as any)
    })

    afterEach(() => {
        detach()
        killSpy.mockRestore()
    })

    test('tells the agent and the user when a background shell exits', () => {
        const task = manager.addTask('bun test', { pid: 1 } as ChildProcess)
        manager.appendOutput(task.id, '3 pass\n1 fail\n')
        manager.markCompleted(task.id, 1)

        expect(steered).toHaveLength(1)
        expect(steered[0]).toContain('<task-notification>')
        expect(steered[0]).toContain(`Background shell ${task.id} (bun test) exited with code 1`)
        expect(steered[0]).toContain('1 fail')
        expect(notices).toEqual([
            { text: `Task ${task.id} failed: bun test · exit 1 · /tasks`, tone: 'error' },
        ])
        expect(task.notified).toBe(true)
    })

    test('reports a timeout kill but not a user or agent kill', () => {
        const a = manager.addTask('sleep 100', { kill: () => true } as unknown as ChildProcess)
        const b = manager.addTask('sleep 200', { kill: () => true } as unknown as ChildProcess)
        const c = manager.addTask('sleep 300', { kill: () => true } as unknown as ChildProcess)
        manager.killTask(a.id, 'user')
        manager.killTask(b.id, 'agent')
        manager.killTask(c.id, 'timeout')

        expect(steered).toHaveLength(1)
        expect(steered[0]).toContain('was stopped by its timeout')
    })

    test('skips subagents the parent agent is waiting on', () => {
        const waited = manager.addSubagentTask({ role: 'review', task: 'diff', background: false })
        const bg = manager.addSubagentTask({ role: 'explore', task: 'find auth', depth: 1 })
        manager.markCompleted(waited.id, 0)
        manager.markCompleted(bg.id, 0)

        expect(steered).toHaveLength(1)
        expect(steered[0]).toContain(`Background subagent ${bg.id} (explore: find auth) completed`)
        expect(steered[0]).toContain('manage_subagent')
        expect(notices[0]?.tone).toBe('success')
    })

    test('notifies only once and stops after detach', () => {
        const task = manager.addTask('ls', {} as ChildProcess)
        manager.markCompleted(task.id, 0)
        expect(shouldNotify(task)).toBe(false)

        detach()
        const other = manager.addTask('pwd', {} as ChildProcess)
        manager.markCompleted(other.id, 0)
        expect(steered).toHaveLength(1)
    })

    test('keeps the note short for long output', () => {
        const task = manager.addTask('build', {} as ChildProcess)
        manager.appendOutput(
            task.id,
            Array.from({ length: 50 }, (_, i) => `line ${i} ${'z'.repeat(500)}`).join('\n')
        )
        manager.markCompleted(task.id, 0)
        const { modelText } = formatTaskNotification(task)
        expect(modelText).not.toContain('line 39 ')
        expect(modelText).toContain('line 49 ')
        expect(modelText.length).toBeLessThan(2_600)
    })
})
