import { describe, expect, it, mock } from 'bun:test'

import {
    buildAttachmentPaths,
    readJobAttachments,
    withAttachments,
    writeTurnAttachments,
} from '../../src/attachments'
import { buildTurnPrompt } from '../../src/session-commands'

const file = (id: string, name: string, sessionId = 's1') => ({
    id,
    name,
    key: `sessions/${sessionId}/attachments/${id}/${name}`,
    contentType: name.endsWith('.png') ? 'image/png' : 'text/plain',
    sizeBytes: 5,
})

// #634: files sent with a prompt
describe('prompt attachments in the worker', () => {
    it('puts each file outside the repository, in a folder for its message', () => {
        expect(buildAttachmentPaths({ folder: 3, names: ['notes.txt', 'shot.png'] })).toEqual([
            '/home/user/.december/attachments/3/notes.txt',
            '/home/user/.december/attachments/3/shot.png',
        ])
    })

    it('never builds a path outside the attachments folder', () => {
        expect(
            buildAttachmentPaths({
                folder: '../../workspace',
                names: ['../../../workspace/.git/config', '/etc/passwd.txt', '..', 'a\u0000b\n.sh'],
            })
        ).toEqual([
            '/home/user/.december/attachments/workspace/config',
            '/home/user/.december/attachments/workspace/passwd.txt',
            '/home/user/.december/attachments/workspace/file',
            '/home/user/.december/attachments/workspace/ab.sh',
        ])
        expect(buildAttachmentPaths({ folder: '..', names: ['a.txt'] })).toEqual([
            '/home/user/.december/attachments/prompt/a.txt',
        ])
    })

    it('gives two files with one name two paths', () => {
        expect(buildAttachmentPaths({ folder: 7, names: ['a.png', 'a.png', 'a.png'] })).toEqual([
            '/home/user/.december/attachments/7/a.png',
            '/home/user/.december/attachments/7/a-2.png',
            '/home/user/.december/attachments/7/a-3.png',
        ])
    })

    it('reads the files of a job, and only the stored files of that session', () => {
        const good = file('a1', 'notes.txt')
        expect(readJobAttachments({ sessionId: 's1', value: [good] })).toEqual([good])
        expect(readJobAttachments({ sessionId: 's1', value: undefined })).toEqual([])
        expect(readJobAttachments({ sessionId: 's1', value: 'x' })).toEqual([])
        expect(
            readJobAttachments({
                sessionId: 's1',
                value: [
                    file('b1', 'other.txt', 's2'),
                    { ...good, key: 'sessions/s1/attachments/../../s2/workspace/secret' },
                    { ...good, key: 'exports/u1/data.zip' },
                    { id: 'c1' },
                    null,
                ],
            })
        ).toEqual([])
        const six = ['1', '2', '3', '4', '5', '6'].map((id) => file(id, `f${id}.txt`))
        expect(readJobAttachments({ sessionId: 's1', value: six })).toHaveLength(5)
    })

    it('names each file and its path in the turn prompt', () => {
        expect(withAttachments('fix it', [])).toBe('fix it')
        expect(
            withAttachments('fix it', [
                { name: 'notes.txt', path: '/home/user/.december/attachments/3/notes.txt' },
                {
                    name: 'shot.png',
                    path: '/home/user/.december/attachments/3/shot.png',
                    isImage: true,
                },
                { name: 'lost.csv' },
            ])
        ).toBe(`fix it

<attached-files>
The user attached these files to this message. They are outside the repository. Read a file when the task needs it. Do not copy a file into the repository unless the user asks.
- notes.txt: /home/user/.december/attachments/3/notes.txt
- shot.png (image): /home/user/.december/attachments/3/shot.png
- lost.csv: could not be loaded
</attached-files>`)
    })

    it('the turn prompt has the files before plan first', async () => {
        const prompt = await buildTurnPrompt({
            prompt: 'fix it',
            planFirst: true,
            attachments: [
                { name: 'notes.txt', path: '/home/user/.december/attachments/3/notes.txt' },
            ],
        })
        expect(prompt).toContain('- notes.txt: /home/user/.december/attachments/3/notes.txt')
        expect(prompt.indexOf('<attached-files>')).toBeLessThan(prompt.indexOf('<plan-first>'))
        expect(await buildTurnPrompt({ prompt: 'fix it', planFirst: false })).toBe('fix it')
    })

    it('writes the files into the sandbox and tells what it wrote', async () => {
        const written: Array<{ path: string; text: string }> = []
        const sandbox = {
            files: {
                write: mock(async (path: string, data: ArrayBuffer) => {
                    written.push({ path, text: Buffer.from(data).toString('utf8') })
                }),
            },
        }
        const load = mock(async (key: string) =>
            key.includes('lost') ? null : new TextEncoder().encode(`bytes of ${key}`)
        )

        const result = await writeTurnAttachments({
            sandbox,
            folder: 3,
            attachments: [file('a1', 'notes.txt'), file('a2', 'shot.png'), file('a3', 'lost.csv')],
            load,
        })

        expect(written).toEqual([
            {
                path: '/home/user/.december/attachments/3/notes.txt',
                text: 'bytes of sessions/s1/attachments/a1/notes.txt',
            },
            {
                path: '/home/user/.december/attachments/3/shot.png',
                text: 'bytes of sessions/s1/attachments/a2/shot.png',
            },
        ])
        expect(result).toEqual([
            {
                name: 'notes.txt',
                path: '/home/user/.december/attachments/3/notes.txt',
                isImage: false,
            },
            {
                name: 'shot.png',
                path: '/home/user/.december/attachments/3/shot.png',
                isImage: true,
            },
            { name: 'lost.csv', isImage: false },
        ])
    })

    it('a sandbox that cannot take files never fails the turn', async () => {
        const load = async () => new TextEncoder().encode('x')
        expect(
            await writeTurnAttachments({
                sandbox: undefined,
                folder: 3,
                attachments: [file('a1', 'notes.txt')],
                load,
            })
        ).toEqual([{ name: 'notes.txt', isImage: false }])
        const broken = { files: { write: async () => Promise.reject(new Error('gone')) } }
        expect(
            await writeTurnAttachments({
                sandbox: broken,
                folder: 3,
                attachments: [file('a1', 'notes.txt')],
                load,
            })
        ).toEqual([{ name: 'notes.txt', isImage: false }])
    })
})
