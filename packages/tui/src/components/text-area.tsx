import { Text, useInput, usePaste } from 'ink'
import React, { useState, useEffect, useRef } from 'react'

import { THEME } from '../theme'
import { storePaste } from '../utils/paste-manager'

type Props = {
    value: string
    onChange: (value: string) => void
    onSubmit: (value: string) => void
    onHistoryUp?: () => void
    onHistoryDown?: () => void
    placeholder?: string
    focus?: boolean
    disableHistoryNav?: boolean
}

export function TextArea({
    value,
    onChange,
    onSubmit,
    onHistoryUp,
    onHistoryDown,
    placeholder = '',
    focus = true,
    disableHistoryNav = false,
}: Props) {
    const [cursorOffset, setCursorOffset] = useState(value.length)
    const prevValueRef = useRef(value)
    const valueRef = useRef(value)
    valueRef.current = value
    const cursorOffsetRef = useRef(cursorOffset)
    cursorOffsetRef.current = cursorOffset

    useEffect(() => {
        if (value !== prevValueRef.current) {
            // When value changes from outside (e.g. autocomplete, history navigation, clear)
            setCursorOffset((prev) => {
                if (
                    Math.abs(value.length - prevValueRef.current.length) > 1 ||
                    !value.startsWith(prevValueRef.current) ||
                    prev > value.length
                ) {
                    return value.length
                }
                return prev
            })
            prevValueRef.current = value
        }
    }, [value])

    const isPastingRef = useRef(false)
    const pasteBufferRef = useRef('')

    const handlePastedText = (pasted: string, offset?: number) => {
        const cleaned = pasted.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        if (!cleaned) return
        const currentVal = valueRef.current
        const currentOffset =
            offset !== undefined
                ? Math.min(Math.max(0, offset), currentVal.length)
                : Math.min(Math.max(0, cursorOffsetRef.current), currentVal.length)
        const lines = cleaned.split('\n')
        if (lines.length >= 2 || cleaned.length >= 80) {
            const token = storePaste(cleaned)
            const newValue =
                currentVal.slice(0, currentOffset) + token + currentVal.slice(currentOffset)
            valueRef.current = newValue
            onChange(newValue)
            const newOffset = currentOffset + token.length
            cursorOffsetRef.current = newOffset
            setCursorOffset(newOffset)
        } else {
            const newValue =
                currentVal.slice(0, currentOffset) + cleaned + currentVal.slice(currentOffset)
            valueRef.current = newValue
            onChange(newValue)
            const newOffset = currentOffset + cleaned.length
            cursorOffsetRef.current = newOffset
            setCursorOffset(newOffset)
        }
    }

    usePaste(
        (pastedText) => {
            if (!focus) return
            handlePastedText(pastedText)
        },
        { isActive: focus }
    )

    useInput((input, key) => {
        if (!focus) return

        const offset = Math.min(Math.max(0, cursorOffset), value.length)

        // Bracketed paste detection fallback (for mock stdin / testing environments)
        if (input.includes('\x1b[200~')) {
            const startIdx = input.indexOf('\x1b[200~')
            const endIdx = input.indexOf('\x1b[201~')
            if (endIdx !== -1 && endIdx > startIdx) {
                const pasted = input.slice(startIdx + 6, endIdx)
                handlePastedText(pasted, offset)
                return
            } else {
                isPastingRef.current = true
                pasteBufferRef.current = input.slice(startIdx + 6)
                return
            }
        }

        if (isPastingRef.current) {
            if (input.includes('\x1b[201~')) {
                const endIdx = input.indexOf('\x1b[201~')
                pasteBufferRef.current += input.slice(0, endIdx)
                isPastingRef.current = false
                const pasted = pasteBufferRef.current
                pasteBufferRef.current = ''
                handlePastedText(pasted, offset)
            } else {
                pasteBufferRef.current += input
            }
            return
        }

        // Multiline raw paste fallback (for non-bracketed paste environments)
        if (
            input &&
            (input.includes('\n') || input.includes('\r')) &&
            input.split(/\r?\n/).length >= 2
        ) {
            handlePastedText(input, offset)
            return
        }

        // Multiline key handlers: Shift+Enter, Alt+Enter, and line continuation (\ + Enter)
        const isShiftEnter =
            input === '\x1b[13;2u' ||
            input === '\x1b[27;2;13~' ||
            (Boolean(key.shift) && Boolean(key.return))
        const isAltEnter = Boolean(key.meta) && Boolean(key.return)
        const isBackslashEnter = Boolean(key.return) && offset > 0 && value[offset - 1] === '\\'

        if (isShiftEnter || isAltEnter) {
            const newValue = value.slice(0, offset) + '\n' + value.slice(offset)
            onChange(newValue)
            setCursorOffset(offset + 1)
            return
        }

        if (isBackslashEnter) {
            const newValue = value.slice(0, offset - 1) + '\n' + value.slice(offset)
            onChange(newValue)
            setCursorOffset(offset)
            return
        }

        if (key.return) {
            onSubmit(value)
            return
        }

        if (key.leftArrow) {
            setCursorOffset(Math.max(0, offset - 1))
            return
        }
        if (key.rightArrow) {
            setCursorOffset(Math.min(value.length, offset + 1))
            return
        }
        if (key.upArrow) {
            if (disableHistoryNav) return
            const lines = value.slice(0, offset).split('\n')
            if (lines.length > 1) {
                const currentLineLength = lines[lines.length - 1]?.length || 0
                const prevLineLength = lines[lines.length - 2]?.length || 0
                const newCol = Math.min(currentLineLength, prevLineLength)
                const newOffset = offset - currentLineLength - 1 - (prevLineLength - newCol)
                setCursorOffset(Math.max(0, newOffset))
            } else {
                if (offset === 0 && onHistoryUp) {
                    onHistoryUp()
                } else {
                    setCursorOffset(0)
                }
            }
            return
        }
        if (key.downArrow) {
            if (disableHistoryNav) return
            const postLines = value.slice(offset).split('\n')
            if (postLines.length > 1) {
                const preLines = value.slice(0, offset).split('\n')
                const currentLineLength = preLines[preLines.length - 1]?.length || 0
                const nextLineLength = postLines[1]?.length || 0
                const newCol = Math.min(currentLineLength, nextLineLength)
                const postLineZeroLength = postLines[0]?.length || 0
                const newOffset = offset + postLineZeroLength + 1 + newCol
                setCursorOffset(Math.min(value.length, newOffset))
            } else {
                if (offset === value.length && onHistoryDown) {
                    onHistoryDown()
                } else {
                    setCursorOffset(value.length)
                }
            }
            return
        }
        if (key.backspace || key.delete) {
            if (offset > 0) {
                const preCursor = value.slice(0, offset)
                const tokenMatch = preCursor.match(/(\[Pasted \d+ lines(?: #\d+)?\])$/)
                if (tokenMatch && tokenMatch[1]) {
                    const tokenLen = tokenMatch[1].length
                    const newValue = value.slice(0, offset - tokenLen) + value.slice(offset)
                    onChange(newValue)
                    setCursorOffset(offset - tokenLen)
                    return
                }
                const newValue = value.slice(0, offset - 1) + value.slice(offset)
                onChange(newValue)
                setCursorOffset(offset - 1)
            }
            return
        }

        if (key.ctrl && input === 'a') {
            setCursorOffset(0)
            return
        }
        if (key.ctrl && input === 'e') {
            setCursorOffset(value.length)
            return
        }
        if (key.ctrl && input === 'k') {
            const newValue = value.slice(0, offset)
            onChange(newValue)
            return
        }
        if (key.ctrl && input === 'u') {
            const newValue = value.slice(offset)
            onChange(newValue)
            setCursorOffset(0)
            return
        }

        if (key.ctrl) return

        if (input) {
            const newValue = value.slice(0, offset) + input + value.slice(offset)
            onChange(newValue)
            setCursorOffset(offset + input.length)
        }
    })

    if (!value && placeholder) {
        return (
            <Text color={THEME.colors.subtle} wrap="wrap">
                {focus ? <Text inverse>{placeholder[0] || ' '}</Text> : null}
                {placeholder.slice(focus ? 1 : 0)}
            </Text>
        )
    }

    // Determine token colors for syntax highlighting
    // 1. Slash command at start (e.g. /model, /plan)
    let cmdEnd = -1
    if (value.startsWith('/')) {
        const spaceIdx = value.indexOf(' ')
        cmdEnd = spaceIdx === -1 ? value.length : spaceIdx
    }

    // 2. @file mentions (e.g. @ or @src/app.tsx)
    const mentionRanges: [number, number][] = []
    const mentionRegex = /@\S*/g
    let match: RegExpExecArray | null
    while ((match = mentionRegex.exec(value)) !== null) {
        if (match[0].length > 0) {
            mentionRanges.push([match.index, match.index + match[0].length])
        }
    }

    // 3. Direct shell command at start (e.g. !git status, !ping, or standalone !)
    const isDirectShell = value.startsWith('!')

    // 4. Folded [Pasted X lines] tokens
    const pasteRanges: [number, number][] = []
    const pasteRegex = /\[Pasted \d+ lines(?: #\d+)?\]/g
    let pMatch: RegExpExecArray | null
    while ((pMatch = pasteRegex.exec(value)) !== null) {
        if (pMatch[0].length > 0) {
            pasteRanges.push([pMatch.index, pMatch.index + pMatch[0].length])
        }
    }

    const getCharColor = (index: number): string | undefined => {
        if (isDirectShell) {
            return THEME.colors.brand
        }
        if (value.startsWith('?') && index === 0) {
            return THEME.colors.brand
        }
        if (cmdEnd > 0 && index < cmdEnd) {
            return THEME.colors.brand
        }
        for (const [start, end] of mentionRanges) {
            if (index >= start && index < end) {
                return THEME.colors.brand
            }
        }
        for (const [start, end] of pasteRanges) {
            if (index >= start && index < end) {
                return THEME.colors.brand
            }
        }
        return undefined
    }

    const effectiveCursorOffset = Math.min(Math.max(0, cursorOffset), value.length)
    const elements: React.ReactNode[] = []
    const len = value.length

    const pushChunk = (key: string, text: string, color: string | undefined, inverse = false) => {
        if (!text) return
        elements.push(
            <Text key={key} color={color} inverse={inverse}>
                {text}
            </Text>
        )
    }

    if (!focus) {
        let currentChunk = ''
        let currentColor: string | undefined = undefined
        let chunkStart = 0

        for (let i = 0; i < len; i++) {
            const color = getCharColor(i)
            if (i === 0) {
                currentColor = color
                currentChunk = value[i]!
                chunkStart = 0
            } else if (color === currentColor) {
                currentChunk += value[i]!
            } else {
                pushChunk(`chunk-${chunkStart}`, currentChunk, currentColor)
                currentChunk = value[i]!
                currentColor = color
                chunkStart = i
            }
        }
        if (currentChunk) {
            pushChunk(`chunk-${chunkStart}`, currentChunk, currentColor)
        }
        return <Text wrap="wrap">{elements}</Text>
    }

    // Process characters before cursor
    let currentChunk = ''
    let currentColor: string | undefined = undefined
    let chunkStart = 0

    for (let i = 0; i < effectiveCursorOffset; i++) {
        const color = getCharColor(i)
        if (i === 0) {
            currentColor = color
            currentChunk = value[i]!
            chunkStart = 0
        } else if (color === currentColor) {
            currentChunk += value[i]!
        } else {
            pushChunk(`pre-${chunkStart}`, currentChunk, currentColor)
            currentChunk = value[i]!
            currentColor = color
            chunkStart = i
        }
    }
    if (currentChunk) {
        pushChunk(`pre-${chunkStart}`, currentChunk, currentColor)
    }

    // Cursor character
    if (effectiveCursorOffset < len) {
        const cursorChar = value[effectiveCursorOffset]!
        const cursorColor = getCharColor(effectiveCursorOffset)
        if (cursorChar === '\n') {
            pushChunk('cursor', ' ', cursorColor, true)
            pushChunk('cursor-nl', '\n', undefined, false)
        } else {
            pushChunk('cursor', cursorChar, cursorColor, true)
        }
    }

    // Process characters after cursor
    const afterCursorStart = effectiveCursorOffset + 1
    currentChunk = ''
    currentColor = undefined
    chunkStart = afterCursorStart

    for (let i = afterCursorStart; i < len; i++) {
        const color = getCharColor(i)
        if (i === afterCursorStart) {
            currentColor = color
            currentChunk = value[i]!
            chunkStart = afterCursorStart
        } else if (color === currentColor) {
            currentChunk += value[i]!
        } else {
            pushChunk(`post-${chunkStart}`, currentChunk, currentColor)
            currentChunk = value[i]!
            currentColor = color
            chunkStart = i
        }
    }
    if (currentChunk) {
        pushChunk(`post-${chunkStart}`, currentChunk, currentColor)
    }

    // Cursor at the very end of the line
    if (effectiveCursorOffset >= len) {
        pushChunk('cursor-end', ' ', undefined, true)
    }

    return <Text wrap="wrap">{elements}</Text>
}
