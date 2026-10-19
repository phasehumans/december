import { describe, expect, it } from 'bun:test'
import React from 'react'

import { MessageList } from '../../src/components/message-list'
import { ScrollViewportContext } from '../../src/components/scroll-viewport'
import { renderWithProviders } from '../test-providers'

describe('Virtual Message List Row Bounds (Unit)', () => {
    it('calculates row bounds and only renders messages in viewport when reading mode is scrolled to top', () => {
        const messages = Array.from({ length: 60 }, (_, i) => ({
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            text: i % 2 === 0 ? `User question ${i}` : undefined,
            blocks:
                i % 2 !== 0
                    ? [{ type: 'text' as const, content: `Assistant answer ${i}` }]
                    : undefined,
        }))

        // Viewport at top (scrollTop = 0, viewportHeight = 20)
        const { lastFrame } = renderWithProviders(
            <ScrollViewportContext.Provider
                value={{
                    scrollTop: 0,
                    viewportHeight: 20,
                    contentHeight: 240,
                    isReadingMode: true,
                }}
            >
                <MessageList
                    staticKey={0}
                    staticMessages={messages}
                    activeMessages={[]}
                    isAuthenticated={true}
                    fullscreen={true}
                    isReadingMode={true}
                />
            </ScrollViewportContext.Provider>
        )

        const frame = lastFrame() || ''
        // Top messages must be visible
        expect(frame).toContain('User question 0')
        expect(frame).toContain('Assistant answer 1')

        // Messages far below viewport must NOT be mounted into the DOM
        expect(frame).not.toMatch(/\bUser question 58\b/)
        expect(frame).not.toMatch(/\bAssistant answer 59\b/)
    })

    it('virtualizes both top and bottom when scrolled into the middle of message history', () => {
        const messages = Array.from({ length: 100 }, (_, i) => ({
            id: `msg-${i}`,
            role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
            text: i % 2 === 0 ? `User line ${i}` : undefined,
            blocks:
                i % 2 !== 0
                    ? [{ type: 'text' as const, content: `Assistant line ${i}` }]
                    : undefined,
        }))

        // Viewport centered at item 50 (around row 125)
        const { lastFrame } = renderWithProviders(
            <ScrollViewportContext.Provider
                value={{
                    scrollTop: 125,
                    viewportHeight: 25,
                    contentHeight: 250,
                    isReadingMode: true,
                }}
            >
                <MessageList
                    staticKey={0}
                    staticMessages={messages}
                    activeMessages={[]}
                    isAuthenticated={true}
                    fullscreen={true}
                    isReadingMode={true}
                />
            </ScrollViewportContext.Provider>
        )

        const frame = lastFrame() || ''
        // Items around row 200 should be mounted
        expect(frame).toContain('User line 50')

        // Items far above should be windowed out into topSpacer
        expect(frame).not.toMatch(/\bUser line 0\b/)
        expect(frame).not.toMatch(/\bUser line 2\b/)

        // Items far below should be windowed out into bottomSpacer
        expect(frame).not.toMatch(/\bUser line 98\b/)
        expect(frame).not.toMatch(/\bAssistant line 99\b/)
    })
})
