import { Text, useInput } from 'ink'
import React, { useState, useEffect, useRef } from 'react'

import { THEME } from '../theme'

export interface TextInputProps {
    value: string
    onChange: (value: string) => void
    onSubmit?: (value: string) => void
    placeholder?: string
    focus?: boolean
    mask?: string
    highlightPastedText?: boolean
    showCursor?: boolean
}

export function isMouseEscapeSequence(str: string): boolean {
    return (
        str.includes('[<') ||
        str.includes('\x1b[<') ||
        str.includes('[M') ||
        str.includes('\x1b[M') ||
        /\[<(?:64|65|68|69|72|73|80|81|84|85|\d+);/.test(str) ||
        /\[M[`@a]/.test(str) ||
        /\[6[45]~/.test(str)
    )
}

/* eslint-disable no-control-regex */
export function sanitizeInput(input: string): string {
    // If it contains terminal mouse reporting escape sequences, drop entirely
    if (isMouseEscapeSequence(input)) {
        return ''
    }

    // Strip bracketed paste wrappers
    let sanitized = input.replace(/\x1b\[200~|\[200~|\x1b\[201~|\[201~/g, '')

    // Strip general ANSI CSI sequences or VT private mode escapes
    sanitized = sanitized.replace(/\x1b\[[0-9;?]*[a-zA-Z~]/g, '')
    sanitized = sanitized.replace(/\[\??\d+(?:;\d+)*[a-zA-Z~]/g, '')

    // Strip non-printable ASCII control characters and newlines for single-line inputs
    sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '')

    return sanitized
}
/* eslint-enable no-control-regex */

export function TextInput({
    value: originalValue,
    placeholder = '',
    focus = true,
    mask,
    highlightPastedText = false,
    showCursor = true,
    onChange,
    onSubmit,
}: TextInputProps) {
    const value = originalValue || ''
    const [cursorOffset, setCursorOffset] = useState(value.length)
    const [cursorWidth, setCursorWidth] = useState(0)
    const pendingX10MouseRef = useRef(false)

    useEffect(() => {
        if (!focus || !showCursor) return
        setCursorOffset((prev) => {
            if (prev > value.length) {
                return value.length
            }
            return prev
        })
    }, [value, focus, showCursor])

    useInput(
        (input, key) => {
            // Ignore arrow keys that are handled by parent components or not text cursor moves
            if (key.upArrow || key.downArrow || key.tab || (key.shift && key.tab)) {
                return
            }

            // Global interrupt (Ctrl+C)
            if (key.ctrl && input === 'c') {
                return
            }

            // X10 mouse tracking state machine
            if (pendingX10MouseRef.current) {
                pendingX10MouseRef.current = false
                return
            }
            if (input === '[M' || input === '\x1b[M') {
                pendingX10MouseRef.current = true
                return
            }

            // Ignore mouse escape sequences
            if (isMouseEscapeSequence(input)) {
                return
            }

            // Enter key
            if (key.return) {
                onSubmit?.(value)
                return
            }

            let nextOffset = cursorOffset
            let nextValue = value
            let nextWidth = 0

            // Navigation and editing keys
            if (key.leftArrow) {
                if (showCursor) {
                    nextOffset = Math.max(0, cursorOffset - 1)
                }
            } else if (key.rightArrow) {
                if (showCursor) {
                    nextOffset = Math.min(value.length, cursorOffset + 1)
                }
            } else if (key.home || (key.ctrl && input === 'a')) {
                nextOffset = 0
            } else if (key.end || (key.ctrl && input === 'e')) {
                nextOffset = value.length
            } else if (key.ctrl && input === 'u') {
                nextValue = ''
                nextOffset = 0
            } else if (key.ctrl && input === 'k') {
                nextValue = value.slice(0, cursorOffset)
            } else if (key.backspace) {
                if (cursorOffset > 0) {
                    nextValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset)
                    nextOffset = cursorOffset - 1
                }
            } else if (key.delete) {
                if (cursorOffset < value.length) {
                    nextValue = value.slice(0, cursorOffset) + value.slice(cursorOffset + 1)
                }
            } else {
                const sanitized = sanitizeInput(input)
                if (sanitized.length > 0) {
                    nextValue = value.slice(0, cursorOffset) + sanitized + value.slice(cursorOffset)
                    nextOffset = cursorOffset + sanitized.length
                    if (sanitized.length > 1) {
                        nextWidth = sanitized.length
                    }
                }
            }

            nextOffset = Math.max(0, Math.min(nextValue.length, nextOffset))

            setCursorOffset(nextOffset)
            setCursorWidth(nextWidth)

            if (nextValue !== value) {
                onChange(nextValue)
            }
        },
        { isActive: focus }
    )

    const displayValue = mask ? mask.repeat(value.length) : value

    if (!value && placeholder) {
        return (
            <Text color={THEME.colors.muted}>
                {focus && showCursor ? (
                    <>
                        <Text inverse>{placeholder[0] || ' '}</Text>
                        <Text>{placeholder.slice(1)}</Text>
                    </>
                ) : (
                    placeholder
                )}
            </Text>
        )
    }

    if (!focus || !showCursor) {
        return <Text>{displayValue}</Text>
    }

    const actualWidth = highlightPastedText ? cursorWidth : 0
    if (actualWidth > 1 && cursorOffset >= actualWidth) {
        const start = cursorOffset - actualWidth
        const before = displayValue.slice(0, start)
        const highlighted = displayValue.slice(start, cursorOffset)
        const after = displayValue.slice(cursorOffset)
        return (
            <Text>
                <Text>{before}</Text>
                <Text inverse>{highlighted}</Text>
                <Text>{after}</Text>
            </Text>
        )
    }

    const before = displayValue.slice(0, cursorOffset)
    const at = displayValue[cursorOffset] ?? ' '
    const after = displayValue.slice(cursorOffset + 1)

    return (
        <Text>
            <Text>{before}</Text>
            <Text inverse>{at}</Text>
            <Text>{after}</Text>
        </Text>
    )
}

export function UncontrolledTextInput({
    initialValue = '',
    ...props
}: Omit<TextInputProps, 'value' | 'onChange'> & { initialValue?: string }) {
    const [value, setValue] = useState(initialValue)
    return <TextInput {...props} value={value} onChange={setValue} />
}

export default TextInput
