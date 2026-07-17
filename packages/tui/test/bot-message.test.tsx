import { describe, expect, it } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { BotMessage } from '../src/components/messages/bot-message'

import type { MessageBlock } from '../src/components/messages/bot-message'

describe('BotMessage Component', () => {
    it('renders text block correctly', () => {
        const blocks: MessageBlock[] = [{ type: 'text', content: 'Hello from Bot' }]
        const { lastFrame } = render(<BotMessage blocks={blocks} />)
        expect(lastFrame()).toContain('Hello from Bot')
    })

    it('renders thought block (dimmed) correctly', () => {
        const blocks: MessageBlock[] = [
            {
                type: 'text',
                content: '<thought>I am thinking heavily</thought>\nAnd here is the answer',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} />)
        const frame = lastFrame()

        expect(frame).toContain('Thinking...')
        expect(frame).toContain('I am thinking heavily')
        expect(frame).toContain('And here is the answer')
    })

    it('renders code blocks correctly without crashing', () => {
        const blocks: MessageBlock[] = [
            {
                type: 'text',
                content: '```typescript\nconst a = 1;\n```',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} />)
        const frame = lastFrame()
        expect(frame).toContain('typescript')
        expect(frame).toContain('const a = 1')
    })

    it('renders command status correctly', () => {
        const blocks: MessageBlock[] = [
            {
                type: 'command',
                toolCallId: '123',
                toolName: 'readFile',
                command: 'Read package.json',
                status: 'success',
                output: 'file contents',
            },
        ]
        const { lastFrame } = render(<BotMessage blocks={blocks} />)
        const frame = lastFrame()
        expect(frame).toContain('Read package.json')
    })
})
