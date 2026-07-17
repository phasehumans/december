import { expect, test, describe, mock, spyOn, afterEach, beforeEach } from 'bun:test'
import { localOperations } from '../src/local-operations'
import { taskManager } from '../src/task-manager'
import fs from 'node:fs/promises'
import fg from 'fast-glob'

// Note: localOperations.bash uses createLocalBashOperations, which we would mock ideally,
// but since we are testing the CLI glue code, we can just test task status overrides.

describe('local-operations', () => {
    describe('bash task management', () => {
        test('getTaskStatus retrieves status and output', async () => {
            const task = taskManager.addTask('echo hello', {} as any)
            task.output = 'hello'
            task.status = 'running'

            const res = await (localOperations.bash as any).getTaskStatus(task.id)
            expect(res).toEqual({ status: 'running', output: 'hello' })
        })

        test('getTaskStatus handles missing task', async () => {
            const res = await (localOperations.bash as any).getTaskStatus('task-999')
            expect(res).toEqual({ status: 'failed', output: 'Task not found' })
        })

        test('killTask kills task', async () => {
            let killed = false
            const mockCp = {
                kill: () => {
                    killed = true
                    return true
                },
            } as any
            const task = taskManager.addTask('echo hello', mockCp)

            const res = await (localOperations.bash as any).killTask(task.id)
            expect(res).toBe(true)
            expect(killed).toBe(true)
        })
    })

    describe('fs operations', () => {
        let fsReadFileSpy: any
        let fsWriteFileSpy: any
        let fsAccessSpy: any

        beforeEach(() => {
            fsReadFileSpy = spyOn(fs, 'readFile').mockResolvedValue('file content' as any)
            fsWriteFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined as any)
            spyOn(fs, 'mkdir').mockResolvedValue(undefined as any)
            fsAccessSpy = spyOn(fs, 'access').mockResolvedValue(undefined as any)
        })

        afterEach(() => {
            mock.restore()
        })

        test('readFile calls fs.readFile', async () => {
            const content = await localOperations.fs.readFile('test.txt')
            expect(content).toBe('file content')
            expect(fsReadFileSpy).toHaveBeenCalled()
        })

        test('writeFile calls fs.mkdir and fs.writeFile', async () => {
            await localOperations.fs.writeFile('dir/test.txt', 'content')
            expect(fsWriteFileSpy).toHaveBeenCalled()
        })

        test('exists returns true if fs.access passes', async () => {
            const exists = await localOperations.fs.exists('test.txt')
            expect(exists).toBe(true)
        })

        test('exists returns false if fs.access fails', async () => {
            fsAccessSpy.mockRejectedValue(new Error('ENOENT'))
            const exists = await localOperations.fs.exists('missing.txt')
            expect(exists).toBe(false)
        })
    })

    describe('env operations', () => {
        test('gets cwd', () => {
            expect(localOperations.env.cwd()).toBe(process.cwd())
        })

        test('gets env var', () => {
            process.env.TEST_CLI_VAR = '42'
            expect(localOperations.env.get('TEST_CLI_VAR')).toBe('42')
        })
    })
})
