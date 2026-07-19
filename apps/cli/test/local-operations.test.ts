import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import {
    expect,
    test,
    describe,
    spyOn,
    afterEach,
    beforeEach,
    beforeAll,
    afterAll,
    mock,
} from 'bun:test'
import { localOperations } from '../src/local-operations'
import { taskManager } from '../src/task-manager'

describe('local-operations', () => {
    describe('bash task management', () => {
        test('exec delegates to localBashOps', async () => {
            expect(typeof localOperations.bash.exec).toBe('function')
        })

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
        let fsReaddirSpy: any
        let fsMkdirSpy: any

        beforeEach(() => {
            fsReadFileSpy = spyOn(fs, 'readFile').mockResolvedValue('file content' as any)
            fsWriteFileSpy = spyOn(fs, 'writeFile').mockResolvedValue(undefined as any)
            fsMkdirSpy = spyOn(fs, 'mkdir').mockResolvedValue(undefined as any)
            fsAccessSpy = spyOn(fs, 'access').mockResolvedValue(undefined as any)
            fsReaddirSpy = spyOn(fs, 'readdir').mockResolvedValue([
                { name: 'dir1', isDirectory: () => true },
                { name: 'file1.txt', isDirectory: () => false },
            ] as any)
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
            expect(fsMkdirSpy).toHaveBeenCalled()
        })

        test('readdir calls fs.readdir and formats output', async () => {
            const entries = await localOperations.fs.readdir('dir')
            expect(fsReaddirSpy).toHaveBeenCalled()
            expect(entries).toEqual(['[DIR ] dir1', '[FILE] file1.txt'])
        })

        test('mkdir calls fs.mkdir', async () => {
            await localOperations.fs.mkdir('newdir', { recursive: true })
            expect(fsMkdirSpy).toHaveBeenCalled()
            const call = fsMkdirSpy.mock.calls[0]
            expect(call[1]).toEqual({ recursive: true })
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

    describe('search operations (real fs)', () => {
        const testDir = path.join(process.cwd(), '.test-search-dir')

        beforeAll(async () => {
            await fs.mkdir(testDir, { recursive: true })
            await fs.writeFile(path.join(testDir, 'file1.ts'), 'console.log("hello world")\n')
            await fs.writeFile(path.join(testDir, 'file2.ts'), 'console.log("something else")\n')
        })

        afterAll(async () => {
            await fs.rm(testDir, { recursive: true, force: true })
        })

        test('find returns joined file paths', async () => {
            const res = await localOperations.search.find(testDir, '*.ts')
            expect(res).toContain('file1.ts')
            expect(res).toContain('file2.ts')
        })

        test('grep returns stdout from exec', async () => {
            const res = await localOperations.search.grep(testDir, 'hello')
            expect(res).toContain('file1.ts')
            expect(res).toContain('hello')
        })

        test('grep handles empty matches gracefully (exit code 1)', async () => {
            const res = await localOperations.search.grep(testDir, 'missing_string_XYZ')
            expect(res).toBe('')
        })

        test('grep throws on other errors', async () => {
            // searching in a non-existent dir should throw error (exit code 2)
            await expect(
                localOperations.search.grep(testDir + '-nonexistent', 'fatal')
            ).rejects.toThrow()
        })
    })

    describe('ui operations', () => {
        test('askQuestion throws not implemented', async () => {
            await expect(localOperations.ui.askQuestion({} as any)).rejects.toThrow(
                'Not implemented here'
            )
        })

        test('requestPermission returns { block: false }', async () => {
            const res = await localOperations.ui.requestPermission({} as any)
            expect(res).toEqual({ block: false })
        })
    })

    describe('browser operations', () => {
        let globalFetchSpy: any

        beforeEach(() => {
            globalFetchSpy = spyOn(globalThis, 'fetch')
        })

        afterEach(() => {
            mock.restore()
        })

        test('navigate returns cleaned text on success', async () => {
            globalFetchSpy.mockResolvedValue({
                ok: true,
                text: async () =>
                    '<html><body><script>alert("hi")</script>Hello   World<style>.css{}</style></body></html>',
            } as any)

            const res = await localOperations.browser.navigate('http://example.com')
            expect(res).toEqual({ text: 'Hello World' })
        })

        test('navigate returns error on non-ok status', async () => {
            globalFetchSpy.mockResolvedValue({
                ok: false,
                status: 404,
                text: async () => 'Not Found',
            } as any)

            const res = await localOperations.browser.navigate('http://example.com')
            expect(res).toEqual({ text: '', error: 'HTTP Error (404): Not Found' })
        })

        test('navigate returns error if fetch throws', async () => {
            globalFetchSpy.mockRejectedValue(new Error('Network error'))

            const res = await localOperations.browser.navigate('http://example.com')
            expect(res).toEqual({ text: '', error: 'Network error' })
        })
    })
})
