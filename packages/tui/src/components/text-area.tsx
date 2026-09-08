import { Text, useInput } from 'ink'
import React, { useState, useEffect, useRef } from 'react'

import { THEME } from '../theme'

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

    useInput((input, key) => {
        if (!focus) return

        const offset = Math.min(Math.max(0, cursorOffset), value.length)

        if (key.return) {
            if (key.meta) {
                const newValue = value.slice(0, offset) + '\n' + value.slice(offset)
                onChange(newValue)
                setCursorOffset(offset + 1)
            } else {
                onSubmit(value)
            }
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
            <Text color={THEME.colors.muted} wrap="wrap">
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
