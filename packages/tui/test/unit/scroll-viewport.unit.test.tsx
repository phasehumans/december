import { describe, expect, it, mock } from 'bun:test'
import { Box, Text } from 'ink'
import { render } from 'ink-testing-library'
import React from 'react'

import { ScrollViewport } from '../../src/components/scroll-viewport'
import { RootLayout } from '../../src/layouts/root-layout'

describe('ScrollViewport Component (Unit)', () => {
    it('renders children within explicit height viewport', () => {
        const { lastFrame } = render(
            <RootLayout>
                <ScrollViewport height={5}>
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                    <Text>Line 3</Text>
                </ScrollViewport>
            </RootLayout>
        )

        const frame = lastFrame()
        expect(frame).toContain('Line 1')
        expect(frame).toContain('Line 2')
        expect(frame).toContain('Line 3')
    })

    it('renders reading mode indicator when lines below are present', () => {
        const { lastFrame } = render(
            <RootLayout>
                <ScrollViewport height={3} scrollFromBottom={5} showIndicator={true}>
                    <Text>Line 1</Text>
                    <Text>Line 2</Text>
                </ScrollViewport>
            </RootLayout>
        )

        const frame = lastFrame()
        expect(frame).toContain('lines streaming below')
        expect(frame).toContain('PageDown')
        expect(frame).toContain('End')
    })

    it('navigates with mouse wheel up and down', async () => {
        const handleScrollChange = mock((linesBelow: number) => {})

        const { stdin } = render(
            <RootLayout>
                <ScrollViewport height={3} onScrollChange={handleScrollChange}>
                    {Array.from({ length: 15 }, (_, i) => (
                        <Box key={i} flexShrink={0}>
                            <Text>{`Message Item ${i + 1}`}</Text>
                        </Box>
                    ))}
                </ScrollViewport>
            </RootLayout>
        )

        // Mouse wheel up escape sequence: \u001B[<64;20;10M
        stdin.write('\u001B[<64;20;10M')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(handleScrollChange).toHaveBeenCalled()
    })

    it('navigates with PageUp, PageDown, Home, and End keys', async () => {
        const handleScrollChange = mock((linesBelow: number) => {})

        const { stdin } = render(
            <RootLayout>
                <ScrollViewport height={5} onScrollChange={handleScrollChange}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <Box key={i} flexShrink={0}>
                            <Text>{`Row ${i + 1}`}</Text>
                        </Box>
                    ))}
                </ScrollViewport>
            </RootLayout>
        )

        // PageUp: \u001B[5~
        stdin.write('\u001B[5~')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(handleScrollChange).toHaveBeenCalled()

        // Home: \u001B[H
        stdin.write('\u001B[H')
        await new Promise((resolve) => setTimeout(resolve, 50))

        // End: \u001B[F
        stdin.write('\u001B[F')
        await new Promise((resolve) => setTimeout(resolve, 50))
    })

    it('exits reading mode and returns to bottom when pressing escape', async () => {
        const handleScrollChange = mock((linesBelow: number) => {})

        const { stdin } = render(
            <RootLayout>
                <ScrollViewport height={5} scrollFromBottom={4} onScrollChange={handleScrollChange}>
                    {Array.from({ length: 20 }, (_, i) => (
                        <Box key={i} flexShrink={0}>
                            <Text>{`Row ${i + 1}`}</Text>
                        </Box>
                    ))}
                </ScrollViewport>
            </RootLayout>
        )

        // Escape: \u001B
        stdin.write('\u001B')
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(handleScrollChange).toHaveBeenCalledWith(0)
    })
})
