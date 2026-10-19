import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useRef, useMemo } from 'react'

import { useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import { writeToClipboard } from '../../utils/clipboard'
import { Markdown } from '../markdown'
import { Spinner } from '../spinner'

import type { BtwState } from '../../types'

export interface BtwOverlayProps extends BtwState {
    onClose: () => void
    onCopy?: (text: string) => void
}

const CALLOUT_BORDER = {
    topLeft: '',
    topRight: '',
    bottomLeft: '',
    bottomRight: '',
    top: '',
    bottom: '',
    left: '▎',
    right: '',
}

export function BtwOverlay({ question, answer, status, error, onClose, onCopy }: BtwOverlayProps) {
    const rows = useTerminalRows()
    const [scrollOffset, setScrollOffset] = useState(0)

    const MAX_VISIBLE_LINES = useMemo(() => {
        return Math.min(8, Math.max(4, Math.floor((rows || 24) / 4)))
    }, [rows])

    const answerLines = useMemo(() => {
        if (!answer) return []
        return answer.split('\n')
    }, [answer])

    const maxScroll = Math.max(0, answerLines.length - MAX_VISIBLE_LINES)

    // Auto-scroll to bottom while streaming new tokens
    const prevAnswerLengthRef = useRef(0)
    useEffect(() => {
        if (status === 'streaming' && answerLines.length > prevAnswerLengthRef.current) {
            setScrollOffset(maxScroll)
        }
        prevAnswerLengthRef.current = answerLines.length
    }, [status, answerLines.length, maxScroll])

    useInput((input, key) => {
        if (key.escape || input === '\u001B') {
            onClose()
            return
        }

        if (key.return && status === 'complete') {
            onClose()
            return
        }

        if ((input === 'c' || input === 'C' || input === 'y') && answer) {
            writeToClipboard(answer)
            if (onCopy) {
                onCopy(answer)
            }
            return
        }

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            setScrollOffset((prev) => Math.max(0, prev - 1))
            return
        }

        if (key.downArrow || input === 'j' || isWheelDown) {
            setScrollOffset((prev) => Math.min(maxScroll, prev + 1))
            return
        }

        if (key.pageUp) {
            setScrollOffset((prev) => Math.max(0, prev - MAX_VISIBLE_LINES))
            return
        }

        if (key.pageDown) {
            setScrollOffset((prev) => Math.min(maxScroll, prev + MAX_VISIBLE_LINES))
            return
        }
    })

    const visibleText = useMemo(() => {
        if (answerLines.length <= MAX_VISIBLE_LINES) {
            return answer
        }
        return answerLines.slice(scrollOffset, scrollOffset + MAX_VISIBLE_LINES).join('\n')
    }, [answer, answerLines, scrollOffset, MAX_VISIBLE_LINES])

    const itemsAbove = scrollOffset
    const itemsBelow = Math.max(0, answerLines.length - (scrollOffset + MAX_VISIBLE_LINES))
    const hasOverflow = answerLines.length > MAX_VISIBLE_LINES

    let overflowStatusText = ''
    if (hasOverflow) {
        if (itemsAbove > 0 && itemsBelow > 0) {
            overflowStatusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
        } else if (itemsAbove > 0) {
            overflowStatusText = `↑ ${itemsAbove} more`
        } else if (itemsBelow > 0) {
            overflowStatusText = `↓ ${itemsBelow} more`
        }
    }

    return (
        <Box
            flexDirection="column"
            borderStyle={CALLOUT_BORDER}
            borderLeft
            borderRight={false}
            borderTop={false}
            borderBottom={false}
            borderColor={THEME.colors.brand}
            paddingLeft={1}
            width="100%"
        >
            {/* Header row */}
            <Box flexDirection="row">
                <Text bold color={THEME.colors.brand}>
                    [btw]{' '}
                </Text>
                <Text bold color={THEME.colors.text} wrap="truncate-end">
                    {question}
                </Text>
            </Box>

            {/* Body */}
            {status === 'loading' && (
                <Box flexDirection="row" gap={1} marginTop={1}>
                    <Spinner />
                    <Text color={THEME.colors.muted}>Looking up cached context...</Text>
                </Box>
            )}

            {(status === 'streaming' || status === 'complete') && (
                <Box flexDirection="column" marginTop={1}>
                    <Markdown isStreaming={status === 'streaming'}>{visibleText}</Markdown>
                </Box>
            )}

            {status === 'error' && (
                <Box flexDirection="row" marginTop={1}>
                    <Text color={THEME.colors.error}>
                        Error: {error || 'Failed to answer side question'}
                    </Text>
                </Box>
            )}

            {/* Command Menu style overflow pagination indicator */}
            {hasOverflow && overflowStatusText && (
                <Box marginTop={1}>
                    <Text color={THEME.colors.muted}>{overflowStatusText}</Text>
                </Box>
            )}

            {/* Branded Footer Navigation */}
            <Box flexDirection="row" gap={1} marginTop={1}>
                {status !== 'loading' && (
                    <>
                        <Text color={THEME.colors.brand}>c</Text>
                        <Text color={THEME.colors.muted}>copy</Text>
                        {hasOverflow && (
                            <>
                                <Text color={THEME.colors.muted}>·</Text>
                                <Text color={THEME.colors.brand}>↑/↓</Text>
                                <Text color={THEME.colors.muted}>scroll</Text>
                            </>
                        )}
                        <Text color={THEME.colors.muted}>·</Text>
                    </>
                )}
                <Text color={THEME.colors.brand}>esc</Text>
                <Text color={THEME.colors.muted}>{status === 'loading' ? 'cancel' : 'close'}</Text>
            </Box>
        </Box>
    )
}
