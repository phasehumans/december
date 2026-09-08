import { describe, it, expect, mock } from 'bun:test'
import { render } from 'ink-testing-library'
import React from 'react'

import { GrillQuestionMenu } from '../../src/components/menus/grill-question-menu'

describe('GrillQuestionMenu Component (Unit)', () => {
    const mockQuestions = [
        {
            question: 'Which database should be used?',
            options: ['PostgreSQL', 'SQLite', 'Redis'],
        },
        {
            question: 'Which authentication method?',
            options: ['JWT', 'Session Cookie'],
        },
    ]

    it('renders current question, options, write-in, and finish now option', () => {
        const handleGrillSelect = mock()
        const generatePlanFromGrill = mock()

        const { lastFrame } = render(
            <GrillQuestionMenu
                grillQuestions={mockQuestions}
                currentGrillIndex={0}
                customInputMode={false}
                handleGrillSelect={handleGrillSelect}
                customAnswer=""
                setCustomAnswer={mock()}
                setCustomInputMode={mock()}
                grillAnswers={[]}
                setGrillAnswers={mock()}
                setCurrentGrillIndex={mock()}
                generatePlanFromGrill={generatePlanFromGrill}
            />
        )

        const output = lastFrame() || ''
        expect(output).toContain('Question 1/2:')
        expect(output).toContain('Which database should be used?')
        expect(output).toContain('PostgreSQL')
        expect(output).toContain('Write-in...')
        expect(output).toContain('Finish interview & generate plan now')
        expect(output).not.toContain('⚡')
    })

    it('triggers generatePlanFromGrill immediately on pressing p key', () => {
        const generatePlanFromGrill = mock()

        const { stdin } = render(
            <GrillQuestionMenu
                grillQuestions={mockQuestions}
                currentGrillIndex={0}
                customInputMode={false}
                handleGrillSelect={mock()}
                customAnswer=""
                setCustomAnswer={mock()}
                setCustomInputMode={mock()}
                grillAnswers={['PostgreSQL']}
                setGrillAnswers={mock()}
                setCurrentGrillIndex={mock()}
                generatePlanFromGrill={generatePlanFromGrill}
            />
        )

        stdin.write('p')
        expect(generatePlanFromGrill).toHaveBeenCalledWith(['PostgreSQL'])
    })

    it('navigates back to previous question on pressing b key when index > 0', () => {
        const setCurrentGrillIndex = mock()

        const { stdin } = render(
            <GrillQuestionMenu
                grillQuestions={mockQuestions}
                currentGrillIndex={1}
                customInputMode={false}
                handleGrillSelect={mock()}
                customAnswer=""
                setCustomAnswer={mock()}
                setCustomInputMode={mock()}
                grillAnswers={['PostgreSQL']}
                setGrillAnswers={mock()}
                setCurrentGrillIndex={setCurrentGrillIndex}
                generatePlanFromGrill={mock()}
            />
        )

        stdin.write('b')
        expect(setCurrentGrillIndex).toHaveBeenCalledWith(0)
    })
})
