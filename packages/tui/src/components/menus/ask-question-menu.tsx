import { Box, Text, useInput } from 'ink'
import React, { useState, useRef } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

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
    const [answers, setAnswers] = useState<Array<string | string[]>>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [selectedMultiIndices, setSelectedMultiIndices] = useState<Set<number>>(new Set())

    const selectedIndexRef = useRef(0)
    selectedIndexRef.current = selectedIndex

    const selectedMultiRef = useRef<Set<number>>(new Set())
    selectedMultiRef.current = selectedMultiIndices

    const currentQ = questions[currentQuestionIdx]
    const isMulti = Boolean(currentQ?.is_multi_select)
    const options = currentQ?.options || []

    const advanceQuestion = (chosen: string | string[]) => {
        const nextAnswers = [...answers, chosen]
        if (currentQuestionIdx + 1 < questions.length) {
            setAnswers(nextAnswers)
            setCurrentQuestionIdx(currentQuestionIdx + 1)
            setSelectedIndex(0)
            selectedIndexRef.current = 0
            setSelectedMultiIndices(new Set())
            selectedMultiRef.current = new Set()
        } else {
            if (questions.length === 1) {
                onComplete(nextAnswers[0] as any)
            } else {
                onComplete(nextAnswers as any)
            }
        }
    }

    useInput((input, key) => {
        if (!currentQ) return

        if (key.escape || input === '\u001B') {
            if (currentQuestionIdx > 0) {
                setCurrentQuestionIdx(currentQuestionIdx - 1)
                setSelectedIndex(0)
                selectedIndexRef.current = 0
                setAnswers((prev) => prev.slice(0, -1))
            } else {
                onComplete(isMulti ? [] : '')
            }
            return
        }

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            const count = isWheelUp
                ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                : 1
            const next = Math.max(0, selectedIndexRef.current - count)
            selectedIndexRef.current = next
            setSelectedIndex(next)
            return
        }
        if (key.downArrow || input === 'j' || isWheelDown) {
            const count = isWheelDown
                ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                : 1
            const next = Math.min(options.length - 1, selectedIndexRef.current + count)
            selectedIndexRef.current = next
            setSelectedIndex(next)
            return
        }

        // Number keys (1-9) to jump to option
        const num = parseInt(input, 10)
        if (!isNaN(num) && num >= 1 && num <= options.length) {
            const targetIdx = num - 1
            selectedIndexRef.current = targetIdx
            setSelectedIndex(targetIdx)
            if (!isMulti) {
                advanceQuestion(options[targetIdx])
            }
            return
        }

        if (isMulti) {
            if (input === ' ') {
                const currentIdx = selectedIndexRef.current
                const next = new Set(selectedMultiRef.current)
                if (next.has(currentIdx)) {
                    next.delete(currentIdx)
                } else {
                    next.add(currentIdx)
                }
                selectedMultiRef.current = next
                setSelectedMultiIndices(next)
                return
            }

            if (key.return) {
                const selectedItems = options.filter((_, idx) => selectedMultiRef.current.has(idx))
                const result =
                    selectedItems.length > 0 ? selectedItems : [options[selectedIndexRef.current]]
                advanceQuestion(result)
                return
            }
        } else {
            if (key.return) {
                advanceQuestion(options[selectedIndexRef.current])
                return
            }
        }
    })

    if (!currentQ) return null

    const footerItems = isMulti
        ? [
              { key: '↑/↓', label: 'navigate' },
              { key: 'space', label: 'toggle' },
              { key: 'enter', label: 'submit' },
              { key: 'esc', label: currentQuestionIdx > 0 ? 'back' : 'close' },
          ]
        : [
              { key: '↑/↓', label: 'navigate' },
              { key: 'enter', label: 'select' },
              { key: 'esc', label: currentQuestionIdx > 0 ? 'back' : 'close' },
          ]

    return (
        <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" gap={1}>
                <Text
                    color={THEME.colors.brand}
                >{`Q${currentQuestionIdx + 1}/${questions.length}:`}</Text>
                <Text color={THEME.colors.text}>{currentQ.question}</Text>
            </Box>
            <Box flexDirection="column" paddingLeft={1}>
                {options.map((opt, idx) => {
                    const isHighlighted = idx === selectedIndex
                    const isChecked = selectedMultiIndices.has(idx)

                    return (
                        <Box key={idx} flexDirection="row" gap={1}>
                            <Text color={isHighlighted ? THEME.colors.brand : THEME.colors.muted}>
                                {isHighlighted ? THEME.glyphs.selector : ' '}
                            </Text>
                            {isMulti && (
                                <Text color={isChecked ? THEME.colors.success : THEME.colors.muted}>
                                    {isChecked ? '[x]' : '[ ]'}
                                </Text>
                            )}
                            <Text
                                color={
                                    isHighlighted
                                        ? THEME.colors.brand
                                        : isChecked
                                          ? THEME.colors.success
                                          : THEME.colors.text
                                }
                            >
                                {opt}
                            </Text>
                        </Box>
                    )
                })}
            </Box>
            <MenuFooter items={footerItems} />
        </Box>
    )
}
