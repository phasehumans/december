import { describe, expect, it, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { GlobalShortcuts } from '../../src/components/global-shortcuts'
import { AskQuestionMenu } from '../../src/components/menus/ask-question-menu'
import { renderWithProviders } from '../test-providers'

describe('TUI Keyboard Navigation (Unit)', () => {
    it('handles choice selection in AskQuestionMenu', () => {
        const onCompleteMock = mock()
        const questions = [
            {
                question: 'Which framework do you prefer?',
                options: ['Next.js', 'Remix'],
                is_multi_select: false,
            },
        ]

        const { stdin, lastFrame } = render(
            <AskQuestionMenu questions={questions} onComplete={onCompleteMock} />
        )

        expect(lastFrame()).toContain('Which framework do you prefer?')
        expect(lastFrame()).toContain('Next.js')
        expect(lastFrame()).toContain('Remix')

        // Simulate enter keypress
        stdin.write('\r')
        expect(onCompleteMock).toHaveBeenCalledWith('Next.js')
    })

    it('closes authMode menu on Escape even while streaming in GlobalShortcuts', async () => {
        const setAuthMode = mock()
        const session = {
            authMode: 'model_select',
            setAuthMode,
            isStreaming: true,
            handleAbort: mock(),
        }

        const { stdin } = renderWithProviders(<GlobalShortcuts {...session} />)
        stdin.write('\u001B') // Escape
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(setAuthMode).toHaveBeenCalledWith('none')
        expect(session.handleAbort).not.toHaveBeenCalled()
    })
})
