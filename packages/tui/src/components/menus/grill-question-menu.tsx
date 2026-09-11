import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'
import { CustomIndicator, CustomItem } from './menu-items'

export function GrillQuestionMenu(props: any) {
    const {
        grillQuestions,
        currentGrillIndex,
        customInputMode,
        handleGrillSelect,
        customAnswer,
        setCustomAnswer,
        setCustomInputMode,
        grillAnswers,
        setGrillAnswers,
        setCurrentGrillIndex,
        generatePlanFromGrill,
        onCancel,
    } = props

    const [confirmExit, setConfirmExit] = React.useState(false)

    useInput((input, key) => {
        if (confirmExit) {
            const lower = (input || '').toLowerCase()
            if (lower === 'y') {
                setConfirmExit(false)
                if (onCancel) {
                    onCancel()
                } else if (props.setAuthMode) {
                    props.setGrillQuestions?.([])
                    props.setCurrentGrillIndex?.(0)
                    props.setGrillAnswers?.([])
                    props.setGrillPrompt?.(null)
                    props.setGrillMode?.(false)
                    props.setPlanWorkflow?.({ phase: 'idle' })
                    props.setAuthMode('none')
                }
                return
            }
            if (lower === 'p' || lower === 's') {
                setConfirmExit(false)
                void generatePlanFromGrill(grillAnswers)
                return
            }
            if (lower === 'c' || key.escape) {
                setConfirmExit(false)
                return
            }
            return
        }

        if (key.escape) {
            if (customInputMode) {
                setCustomInputMode(false)
                return
            }
            setConfirmExit(true)
            return
        }

        if (customInputMode) return

        const lower = (input || '').toLowerCase()
        if (lower === 'p' || lower === 's') {
            void generatePlanFromGrill(grillAnswers)
            return
        }
        if ((lower === 'b' || key.leftArrow) && currentGrillIndex > 0) {
            setCurrentGrillIndex(currentGrillIndex - 1)
            if (props.setPlanWorkflow) {
                props.setPlanWorkflow((prev: any) =>
                    prev?.phase === 'grilling'
                        ? {
                              ...prev,
                              currentIndex: prev.currentIndex - 1,
                          }
                        : prev
                )
            }
            return
        }
    })

    if (confirmExit) {
        return (
            <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
                <Box marginBottom={1} flexDirection="column" gap={1}>
                    <Text color={THEME.colors.warning}>
                        Exit interview? Any unanswered questions will be skipped.
                    </Text>
                    <Text color={THEME.colors.text}>
                        Press{' '}
                        <Text bold color={THEME.colors.error}>
                            y
                        </Text>{' '}
                        to discard,{' '}
                        <Text bold color={THEME.colors.brand}>
                            p
                        </Text>{' '}
                        to generate plan now with answered questions, or{' '}
                        <Text bold color={THEME.colors.success}>
                            c
                        </Text>{' '}
                        to continue interview.
                    </Text>
                </Box>
                <MenuFooter
                    items={[
                        { key: 'y', label: 'Discard & Exit' },
                        { key: 'p', label: 'Plan with answers' },
                        { key: 'c/esc', label: 'Continue' },
                    ]}
                />
            </Box>
        )
    }

    const q = grillQuestions[currentGrillIndex]
    if (q) {
        const items = [
            ...q.options.map((opt: string, i: number) => ({
                label: `${i + 1}. ${opt}`,
                value: opt,
            })),
            { label: `${q.options.length + 1}. Write-in...`, value: 'custom' },
            { label: 'Finish interview & generate plan now', value: '__finish_now__' },
        ]
        return (
            <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
                <Box marginBottom={1} flexDirection="column">
                    {q.docSource && (
                        <Text color={THEME.colors.brand}>[Doc Grounding: {q.docSource}]</Text>
                    )}
                    <Text color={THEME.colors.brand}>
                        [GRILL] Question {currentGrillIndex + 1}/{grillQuestions.length}:
                    </Text>
                    <Text color={THEME.colors.text}>{q.question}</Text>
                </Box>
                {!customInputMode ? (
                    <>
                        <SelectInput
                            items={items}
                            onSelect={handleGrillSelect}
                            indicatorComponent={CustomIndicator}
                            itemComponent={CustomItem}
                        />
                        <MenuFooter
                            items={[
                                { key: 'p/s', label: 'Finish & Plan' },
                                ...(currentGrillIndex > 0 ? [{ key: 'b/←', label: 'Back' }] : []),
                                { key: '↑/↓', label: 'Navigate' },
                                { key: 'enter', label: 'Select' },
                                { key: 'esc', label: 'Cancel' },
                            ]}
                        />
                    </>
                ) : (
                    <Box flexDirection="column" gap={1}>
                        <Box flexDirection="row" gap={1}>
                            <Text color={THEME.colors.brand}>Your answer:</Text>
                            <TextInput
                                focus={true}
                                value={customAnswer}
                                onChange={setCustomAnswer}
                                onSubmit={(value) => {
                                    const answer = value.trim()
                                    if (answer.length === 0) {
                                        setCustomInputMode(false)
                                        return
                                    }

                                    setCustomInputMode(false)
                                    setCustomAnswer('')

                                    const nextAnswers = [...grillAnswers, answer]
                                    setGrillAnswers(nextAnswers)

                                    if (currentGrillIndex + 1 < grillQuestions.length) {
                                        setCurrentGrillIndex(currentGrillIndex + 1)
                                        if (props.setPlanWorkflow) {
                                            props.setPlanWorkflow((prev: any) =>
                                                prev?.phase === 'grilling'
                                                    ? {
                                                          ...prev,
                                                          currentIndex: prev.currentIndex + 1,
                                                          answers: nextAnswers,
                                                      }
                                                    : prev
                                            )
                                        }
                                    } else {
                                        void generatePlanFromGrill(nextAnswers)
                                    }
                                }}
                            />
                        </Box>
                        <MenuFooter
                            items={[
                                { key: 'enter', label: 'Submit' },
                                { key: 'esc', label: 'Cancel' },
                            ]}
                        />
                    </Box>
                )}
            </Box>
        )
    }
    return null
}
