import { describe, expect, it } from 'bun:test'

import {
    ATTACHMENT_MAX_BYTES,
    ATTACHMENT_MAX_FILES,
    checkAttachment,
    getAttachmentKind,
    safeAttachmentName,
} from '../../src/attachments'

// #634: files sent with a prompt
describe('prompt attachments', () => {
    it('allows 5 files of 5 MB for each prompt', () => {
        expect(ATTACHMENT_MAX_FILES).toBe(5)
        expect(ATTACHMENT_MAX_BYTES).toBe(5 * 1024 * 1024)
    })

    it('keeps a plain file name as it is', () => {
        expect(safeAttachmentName('notes.txt')).toBe('notes.txt')
        expect(safeAttachmentName('Screen-Shot_2.PNG')).toBe('Screen-Shot_2.PNG')
        expect(safeAttachmentName('résumé.md')).toBe('résumé.md')
    })

    it('drops path parts from a file name', () => {
        expect(safeAttachmentName('../../etc/passwd')).toBe('passwd')
        expect(safeAttachmentName('/workspace/.git/config.json')).toBe('config.json')
        expect(safeAttachmentName('C:\\Users\\me\\shot.png')).toBe('shot.png')
        expect(safeAttachmentName('..')).toBe('file')
        expect(safeAttachmentName('a/..')).toBe('file')
    })

    it('drops control characters and shell characters', () => {
        expect(safeAttachmentName('no\u0000tes\n.txt')).toBe('notes.txt')
        expect(safeAttachmentName('my notes (1).txt')).toBe('my_notes_1.txt')
        expect(safeAttachmentName('a;rm -rf $HOME`x`.sh')).toBe('a_rm_-rf_HOME_x.sh')
        expect(safeAttachmentName('\u202Egnp.txt')).toBe('gnp.txt')
    })

    it('never gives a hidden file or an empty name', () => {
        expect(safeAttachmentName('.env')).toBe('env')
        expect(safeAttachmentName('...hidden.txt')).toBe('hidden.txt')
        expect(safeAttachmentName('')).toBe('file')
        expect(safeAttachmentName('///')).toBe('file')
    })

    it('cuts a long name and keeps its extension', () => {
        const name = safeAttachmentName(`${'a'.repeat(300)}.json`)
        expect(name.length).toBe(100)
        expect(name.endsWith('.json')).toBe(true)
    })

    it('reads the kind from the extension', () => {
        expect(getAttachmentKind('shot.png')).toBe('image')
        expect(getAttachmentKind('photo.JPEG')).toBe('image')
        expect(getAttachmentKind('a.webp')).toBe('image')
        expect(getAttachmentKind('a.gif')).toBe('image')
        expect(getAttachmentKind('notes.txt')).toBe('text')
        expect(getAttachmentKind('README.md')).toBe('text')
        expect(getAttachmentKind('data.json')).toBe('text')
        expect(getAttachmentKind('rows.csv')).toBe('text')
        expect(getAttachmentKind('server.log')).toBe('text')
        expect(getAttachmentKind('main.ts')).toBe('text')
        expect(getAttachmentKind('app.py')).toBe('text')
        expect(getAttachmentKind('report.pdf')).toBeNull()
        expect(getAttachmentKind('archive.zip')).toBeNull()
        expect(getAttachmentKind('run.exe')).toBeNull()
        expect(getAttachmentKind('noextension')).toBeNull()
    })

    it('refuses a wrong type, a large file, an empty file and a sixth file', () => {
        expect(checkAttachment({ name: 'notes.txt', size: 10, count: 0 })).toBeNull()
        expect(checkAttachment({ name: 'notes.txt', size: 5 * 1024 * 1024, count: 4 })).toBeNull()
        expect(checkAttachment({ name: 'report.pdf', size: 10, count: 0 })).toBe('type')
        expect(checkAttachment({ name: 'notes.txt', size: 5 * 1024 * 1024 + 1, count: 0 })).toBe(
            'size'
        )
        expect(checkAttachment({ name: 'notes.txt', size: 0, count: 0 })).toBe('empty')
        expect(checkAttachment({ name: 'notes.txt', size: 10, count: 5 })).toBe('count')
    })
})
