import { describe, expect, it, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React, { useState } from 'react'

import {
    TextInput,
    UncontrolledTextInput,
    isMouseEscapeSequence,
    sanitizeInput,
} from '../../src/components/text-input'

describe('TextInput Component (Unit)', () => {
    describe('helper functions', () => {
        it('detects SGR mouse escape sequences correctly', () => {
            expect(isMouseEscapeSequence('\x1b[<65;90;20M')).toBe(true)
            expect(isMouseEscapeSequence('[<65;90;20M')).toBe(true)
            expect(isMouseEscapeSequence('\x1b[<64;10;10M')).toBe(true)
            expect(isMouseEscapeSequence('[<64;10;10M')).toBe(true)
            expect(isMouseEscapeSequence('\x1b[<0;3;2M')).toBe(true)
            expect(isMouseEscapeSequence('[<0;3;2M')).toBe(true)
            expect(isMouseEscapeSequence('\x1b[<32;5;5M')).toBe(true)
            expect(isMouseEscapeSequence('[<32;5;5M')).toBe(true)
            expect(isMouseEscapeSequence('\x1b[<0;8;4m')).toBe(true)
            expect(isMouseEscapeSequence('[<0;8;4m')).toBe(true)
        })

        it('detects X10 and rxvt mouse sequences correctly', () => {
            expect(isMouseEscapeSequence('[M')).toBe(true)
            expect(isMouseEscapeSequence('\x1b[M')).toBe(true)
            expect(isMouseEscapeSequence('\x1b[64~')).toBe(true)
            expect(isMouseEscapeSequence('[65~')).toBe(true)
        })

        it('does not falsely detect regular text as mouse sequences', () => {
            expect(isMouseEscapeSequence('hello world')).toBe(false)
            expect(isMouseEscapeSequence('sk-proj-12345')).toBe(false)
            expect(isMouseEscapeSequence('[test]')).toBe(false)
            expect(isMouseEscapeSequence('[')).toBe(false)
            expect(isMouseEscapeSequence('<')).toBe(false)
            expect(isMouseEscapeSequence('')).toBe(false)
        })

        it('sanitizes pasted text and strips control codes', () => {
            expect(sanitizeInput('sk-proj-abc\r\n')).toBe('sk-proj-abc')
            expect(sanitizeInput('api\tkey')).toBe('apikey')
            expect(sanitizeInput('clean_key_123')).toBe('clean_key_123')
            expect(sanitizeInput('[<65;90;20M')).toBe('')
            expect(sanitizeInput('\x1b[200~pasted-secret\x1b[201~')).toBe('pasted-secret')
        })
    })

    it('renders placeholder when value is empty', () => {
        const { lastFrame } = render(
            <TextInput value="" onChange={() => {}} placeholder="Enter your API key..." />
        )
        expect(lastFrame()).toContain('Enter your API key...')
    })

    it('renders value when provided', () => {
        const { lastFrame } = render(
            <TextInput value="sk-ant-test" onChange={() => {}} placeholder="Enter key..." />
        )
        expect(lastFrame()).toContain('sk-ant-test')
    })

    it('masks value when mask prop is set', () => {
        const { lastFrame } = render(
            <TextInput value="secret123" mask="*" onChange={() => {}} focus={false} />
        )
        expect(lastFrame()).toContain('*********')
        expect(lastFrame()).not.toContain('secret123')
    })

    it('inserts typed characters cleanly', async () => {
        let currentValue = ''
        const onChange = mock((val: string) => {
            currentValue = val
        })

        function TestWrapper() {
            const [val, setVal] = useState('')
            return (
                <TextInput
                    value={val}
                    onChange={(next) => {
                        setVal(next)
                        onChange(next)
                    }}
                    focus={true}
                />
            )
        }

        const { stdin } = render(<TestWrapper />)

        stdin.write('a')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).toHaveBeenCalledWith('a')

        stdin.write('b')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).toHaveBeenCalledWith('ab')
    })

    it('completely ignores SGR mouse wheel escape sequences without inserting characters', async () => {
        const onChange = mock()
        const { stdin } = render(<TextInput value="my-key" onChange={onChange} focus={true} />)

        // Mouse wheel down with escape prefix: \x1b[<65;90;20M
        stdin.write('\u001B[<65;90;20M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).not.toHaveBeenCalled()

        // Mouse wheel down with stripped escape (as forwarded by Ink): [<65;90;20M
        stdin.write('[<65;90;20M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).not.toHaveBeenCalled()

        // Mouse wheel up: [<64;90;20M
        stdin.write('[<64;90;20M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).not.toHaveBeenCalled()
    })

    it('completely ignores SGR mouse click and drag escape sequences', async () => {
        const onChange = mock()
        const { stdin } = render(<TextInput value="my-key" onChange={onChange} focus={true} />)

        // Mouse click: [<0;3;2M
        stdin.write('[<0;3;2M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).not.toHaveBeenCalled()

        // Mouse drag coordinates: [<32;3;2M
        stdin.write('[<32;3;2M')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).not.toHaveBeenCalled()

        // Mouse release: [<0;8;4m
        stdin.write('[<0;8;4m')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).not.toHaveBeenCalled()
    })

    it('handles backspace and delete correctly', async () => {
        const onChange = mock()

        function TestWrapper() {
            const [val, setVal] = useState('abc')
            return (
                <TextInput
                    value={val}
                    onChange={(next) => {
                        setVal(next)
                        onChange(next)
                    }}
                    focus={true}
                />
            )
        }

        const { stdin } = render(<TestWrapper />)

        // Backspace: deletes 'c'
        stdin.write('\u0008')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).toHaveBeenCalledWith('ab')
    })

    it('calls onSubmit on Enter keypress', async () => {
        const onSubmit = mock()
        const { stdin } = render(
            <TextInput value="final-api-key" onChange={() => {}} onSubmit={onSubmit} focus={true} />
        )

        stdin.write('\r')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onSubmit).toHaveBeenCalledWith('final-api-key')
    })

    it('clears input with Ctrl+U shortcut', async () => {
        const onChange = mock()
        const { stdin } = render(<TextInput value="some-text" onChange={onChange} focus={true} />)

        // Ctrl+U is ASCII \x15
        stdin.write('\u0015')
        await new Promise((resolve) => setTimeout(resolve, 20))
        expect(onChange).toHaveBeenCalledWith('')
    })

    it('renders UncontrolledTextInput with initialValue', () => {
        const { lastFrame } = render(
            <UncontrolledTextInput initialValue="initial-test-value" focus={false} />
        )
        expect(lastFrame()).toContain('initial-test-value')
    })
})
