import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { InputBar } from '../../src/components/input-bar'
import { RootLayout } from '../../src/layouts/root-layout'

describe('Voice Input (/voice) Unit Tests', () => {
    it('activates voice mode on /voice, updates placeholder, and receives transcripts', async () => {
        let transcriptCallback: ((text: string, isFinal: boolean) => void) | undefined
        const mockStop = mock(async () => 'hello from voice')
        const mockCancel = mock(() => {})
        const mockSubmit = mock((_text: string) => {})

        const mockStartVoice = mock(async (callbacks: any) => {
            transcriptCallback = callbacks.onTranscript
            return {
                stop: mockStop,
                cancel: mockCancel,
            }
        })

        const { stdin, lastFrame } = render(
            <RootLayout>
                <InputBar onSubmit={mockSubmit} onStartVoice={mockStartVoice} />
            </RootLayout>
        )

        // Type /voice and hit Enter
        stdin.write('/voice')
        await new Promise((r) => setTimeout(r, 40))
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 40))

        expect(mockStartVoice).toHaveBeenCalled()
        expect(lastFrame()).toContain('Listening...')

        // Stream transcript
        if (transcriptCallback) {
            transcriptCallback('refactor authentication logic', false)
        }
        await new Promise((r) => setTimeout(r, 40))

        expect(lastFrame()).toContain('refactor authentication logic')

        // Hit enter to submit
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 40))

        expect(mockStop).toHaveBeenCalled()
        expect(mockSubmit).toHaveBeenCalledWith('hello from voice')
    })

    it('cancels voice mode on Escape key without submitting prompt', async () => {
        const mockStop = mock(async () => '')
        const mockCancel = mock(() => {})
        const mockSubmit = mock((_text: string) => {})

        let transcriptCb: ((text: string, isFinal: boolean) => void) | undefined
        const mockStartVoice = mock(async (callbacks: any) => {
            transcriptCb = callbacks?.onTranscript
            return {
                stop: mockStop,
                cancel: mockCancel,
            }
        })

        const { stdin, lastFrame } = render(
            <RootLayout>
                <InputBar onSubmit={mockSubmit} onStartVoice={mockStartVoice} />
            </RootLayout>
        )

        // Trigger voice
        stdin.write('/voice')
        await new Promise((r) => setTimeout(r, 40))
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 40))

        expect(mockStartVoice).toHaveBeenCalled()
        expect(lastFrame()).toContain('Listening...')

        // Stream partial transcript
        if (transcriptCb) {
            transcriptCb('partial voice text that should be cancelled', false)
        }
        await new Promise((r) => setTimeout(r, 40))
        expect(lastFrame()).toContain('partial voice text that should be cancelled')

        // Hit Escape to cancel
        stdin.write('\u001B')
        await new Promise((r) => setTimeout(r, 40))

        expect(mockCancel).toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
        expect(lastFrame()).not.toContain('Listening...')
        expect(lastFrame()).not.toContain('partial voice text that should be cancelled')
    })

    it('handles unconfigured voice gracefully without entering voice mode or triggering submission', async () => {
        const mockSubmit = mock((_text: string) => {})
        const mockStartVoice = mock(async () => null)

        const { stdin, lastFrame } = render(
            <RootLayout>
                <InputBar onSubmit={mockSubmit} onStartVoice={mockStartVoice} />
            </RootLayout>
        )

        stdin.write('/voice')
        await new Promise((r) => setTimeout(r, 40))
        stdin.write('\r')
        await new Promise((r) => setTimeout(r, 40))

        expect(mockStartVoice).toHaveBeenCalled()
        expect(mockSubmit).not.toHaveBeenCalled()
        expect(lastFrame()).not.toContain('Listening...')
    })
})
