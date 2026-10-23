import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { expect, test, describe, afterEach, mock } from 'bun:test'
import React from 'react'

import { InteractiveQuestionCard } from '../src/features/chat/components/InteractiveQuestionCard'
import { sessionAPI } from '../src/features/sessions/api/session'

if (!globalThis.document) {
    GlobalRegistrator.register()
}

const { render, screen, fireEvent, cleanup, waitFor } = await import('@testing-library/react')

describe('Web Interactive ask_question Component (Ticket #590 - Seam 3)', () => {
    afterEach(() => {
        cleanup()
    })

    test('renders question and selectable options with recommended badge', () => {
        const questions = [
            {
                question: 'Which database should the migration target?',
                options: ['(Recommended) PostgreSQL', 'SQLite', 'MySQL'],
                is_multi_select: false,
            },
        ]

        render(
            <InteractiveQuestionCard
                sessionId="sess-test-qa"
                questionId="qid-1"
                questions={questions}
            />
        )

        expect(screen.getByText('Which database should the migration target?')).not.toBeNull()
        expect(screen.getByText('PostgreSQL')).not.toBeNull()
        expect(screen.getByText('SQLite')).not.toBeNull()
        expect(screen.getByText('MySQL')).not.toBeNull()
        expect(screen.getByText('Recommended')).not.toBeNull()
    })

    test('submits single choice and triggers onAnswerSubmitted callback and api call', async () => {
        sessionAPI.submitQuestionAnswer = mock(async () => ({ success: true }))
        const onSubmitted = mock()

        const questions = [
            {
                question: 'Choose test runner',
                options: ['Vitest', 'Jest', 'Bun Test'],
                is_multi_select: false,
            },
        ]

        render(
            <InteractiveQuestionCard
                sessionId="sess-single"
                questionId="qid-single"
                questions={questions}
                onAnswerSubmitted={onSubmitted}
            />
        )

        const optionBtn = screen.getByRole('button', { name: /Vitest/i })
        fireEvent.click(optionBtn)

        await waitFor(() => {
            expect(sessionAPI.submitQuestionAnswer).toHaveBeenCalledWith({
                sessionId: 'sess-single',
                questionId: 'qid-single',
                answer: 'Vitest',
            })
            expect(onSubmitted).toHaveBeenCalledWith('Vitest')
            expect(screen.getByText(/Response Delivered/i)).not.toBeNull()
        })
    })

    test('supports multi-select with submit button', async () => {
        sessionAPI.submitQuestionAnswer = mock(async () => ({ success: true }))
        const onSubmitted = mock()

        const questions = [
            {
                question: 'Select cloud providers to support:',
                options: ['AWS', 'GCP', 'Azure'],
                is_multi_select: true,
            },
        ]

        render(
            <InteractiveQuestionCard
                sessionId="sess-multi"
                questionId="qid-multi"
                questions={questions}
                onAnswerSubmitted={onSubmitted}
            />
        )

        // Select AWS and Azure
        fireEvent.click(screen.getByRole('button', { name: /AWS/i }))
        fireEvent.click(screen.getByRole('button', { name: /Azure/i }))

        const submitBtn = screen.getByRole('button', { name: /Submit Answer/i })
        fireEvent.click(submitBtn)

        await waitFor(() => {
            expect(sessionAPI.submitQuestionAnswer).toHaveBeenCalledWith({
                sessionId: 'sess-multi',
                questionId: 'qid-multi',
                answer: ['AWS', 'Azure'],
            })
            expect(onSubmitted).toHaveBeenCalledWith(['AWS', 'Azure'])
        })
    })

    test('renders already answered state when initialAnswer is provided', () => {
        const questions = [
            {
                question: 'Which architecture pattern?',
                options: ['Microservices', 'Monolith'],
            },
        ]

        render(
            <InteractiveQuestionCard
                sessionId="sess-done"
                questionId="qid-done"
                questions={questions}
                initialAnswer="Monolith"
                disabled={true}
            />
        )

        expect(screen.getByText(/Response Delivered: Monolith/i)).not.toBeNull()
    })
})
