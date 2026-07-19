import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import React, { useState } from 'react'

export interface AskQuestionMenuProps {
    questions: Array<{
        question: string
        options: string[]
        is_multi_select?: boolean
    }>
    onComplete: (answers: string | string[]) => void
}

export function AskQuestionMenu({ questions, onComplete }: AskQuestionMenuProps) {
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
    const [answers, setAnswers] = useState<string[]>([])

    // for now we just support single-select because standard ink-select-input doesn't do multi-select natively well
    // if we need multi-select, we'd build a custom checkbox list.
    const currentQ = questions[currentQuestionIdx]

    if (!currentQ) return null

    const items = currentQ.options.map((opt) => ({ label: opt, value: opt }))

    const handleSelect = (item: any) => {
        const newAnswers = [...answers, item.value]
        if (currentQuestionIdx + 1 < questions.length) {
            setAnswers(newAnswers)
            setCurrentQuestionIdx(currentQuestionIdx + 1)
        } else {
            onComplete(newAnswers.length === 1 ? newAnswers[0] : newAnswers)
        }
    }

    return (
        <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" gap={1}>
                <Text color="cyan" bold>{`Q${currentQuestionIdx + 1}/${questions.length}:`}</Text>
                <Text color="white" bold>
                    {currentQ.question}
                </Text>
            </Box>
            <Box paddingLeft={2}>
                <SelectInput items={items} onSelect={handleSelect} />
            </Box>
        </Box>
    )
}
