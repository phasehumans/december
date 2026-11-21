import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, test } from 'bun:test'

import {
    Keymap,
    defaultKeybindingsFileContent,
    keyNameToSequences,
    loadKeybindings,
} from '../../src/keybindings'

function writeTemp(content: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'december-keys-'))
    const file = path.join(dir, 'keybindings.json')
    fs.writeFileSync(file, content)
    return file
}

describe('keybindings', () => {
    test('key names map to terminal sequences', () => {
        expect(keyNameToSequences('ctrl+a')).toEqual(['\x01'])
        expect(keyNameToSequences('Ctrl+G')).toEqual(['\x07'])
        expect(keyNameToSequences('alt+f')).toEqual(['\x1bf'])
        expect(keyNameToSequences('shift+tab')).toEqual(['\x1b[Z'])
        expect(keyNameToSequences('ctrl+c')).toBeNull()
        expect(keyNameToSequences('ctrl+j')).toBeNull()
        expect(keyNameToSequences('q')).toBeNull()
    })

    test('default keymap passes keys through unchanged', () => {
        const keymap = new Keymap()
        expect(keymap.translate('\x01', true)).toBe('\x01')
        expect(keymap.translate('\x1b[Z', true)).toBe('\x1b[Z')
    })

    test('a rebound action runs from its new key, and its old key stops working in the input bar', () => {
        const file = writeTemp(JSON.stringify({ bindings: { togglePlanMode: 'ctrl+g' } }))
        const keymap = Keymap.fromFile(file)
        expect(keymap.problems).toEqual([])
        expect(keymap.translate('\x07', true)).toBe('\x1b[Z')
        expect(keymap.translate('\x1b[Z', true)).toBeNull()
        // overlays keep their own keys
        expect(keymap.translate('\x1b[Z', false)).toBe('\x1b[Z')
        expect(keymap.translate('\x07', false)).toBe('\x07')
    })

    test('global actions are translated in overlays too', () => {
        const file = writeTemp(JSON.stringify({ bindings: { toggleTasks: 'alt+t' } }))
        const keymap = Keymap.fromFile(file)
        expect(keymap.translate('\x1bt', false)).toBe('\x14')
        expect(keymap.translate('\x14', false)).toBeNull()
    })

    test('swapping two keys works both ways', () => {
        const file = writeTemp(
            JSON.stringify({ bindings: { lineStart: 'ctrl+e', lineEnd: 'ctrl+a' } })
        )
        const keymap = Keymap.fromFile(file)
        expect(keymap.translate('\x05', true)).toBe('\x01')
        expect(keymap.translate('\x01', true)).toBe('\x05')
    })

    test('reports bad entries and keeps the defaults for them', () => {
        const file = writeTemp(
            JSON.stringify({
                bindings: { nope: 'ctrl+x', lineStart: 'ctrl+c', lineEnd: 'hyper+e' },
            })
        )
        const { bindings, problems } = loadKeybindings(file)
        expect(problems).toHaveLength(3)
        expect(bindings.lineStart).toEqual(['ctrl+a'])
        expect(bindings.lineEnd).toEqual(['ctrl+e'])
    })

    test('invalid JSON falls back to the defaults', () => {
        const keymap = Keymap.fromFile(writeTemp('{ not json'))
        expect(keymap.problems[0]).toContain('invalid JSON')
        expect(keymap.translate('\x01', true)).toBe('\x01')
    })

    test('the starter file lists every action with its default keys', () => {
        const file = writeTemp(defaultKeybindingsFileContent())
        const keymap = Keymap.fromFile(file)
        expect(keymap.problems).toEqual([])
        expect(keymap.keysFor('newline')).toEqual(['alt+enter', 'shift+enter'])
    })
})
