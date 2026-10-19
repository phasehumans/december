import fs from 'node:fs/promises'
import path from 'node:path'

import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useRef, useCallback } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface FileViewMenuProps {
    filePath?: string
    initialLine?: number
    onClose?: () => void
    setAuthMode?: (mode: any) => void
    onInsertContext?: (file: string, line: number) => void
    addToast?: (msg: string, variant?: string) => void
}

export function FileViewMenu({
    filePath = '',
    initialLine = 1,
    onClose,
    setAuthMode,
    onInsertContext,
    addToast,
}: FileViewMenuProps) {
    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80
    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24

    const visibleLineCount = Math.max(6, Math.min(16, rows - 10))

    const [content, setContent] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const targetLine0 = Math.max(0, initialLine - 1)
    const [cursorLineIndex, setCursorLineIndex] = useState(targetLine0)
    const [scrollOffset, setScrollOffset] = useState(() =>
        Math.max(0, targetLine0 - Math.floor(visibleLineCount / 2))
    )

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [onClose, setAuthMode])

    // Load file content
    useEffect(() => {
        let isMounted = true
        if (!filePath) {
            setIsLoading(false)
            setError('No file path provided')
            return
        }

        setIsLoading(true)
        setError(null)

        const fullPath = path.isAbsolute(filePath)
            ? filePath
            : path.resolve(process.cwd(), filePath)

        fs.readFile(fullPath, 'utf8')
            .then((text) => {
                if (isMounted) {
                    setContent(text)
                    setIsLoading(false)
                }
            })
            .catch((err: any) => {
                if (isMounted) {
                    setError(err?.message || 'Failed to read file')
                    setIsLoading(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [filePath])

    const lines = content !== null ? content.split('\n') : []
    const totalLines = lines.length

    const cursorLineIndexRef = useRef(cursorLineIndex)
    cursorLineIndexRef.current = cursorLineIndex

    const scrollOffsetRef = useRef(scrollOffset)
    scrollOffsetRef.current = scrollOffset

    useInput((input, key) => {
        if (key.escape || input === 'q') {
            handleClose()
            return
        }

        if (totalLines === 0) return

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            const count = isWheelUp
                ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                : 1
            setCursorLineIndex((prev) => {
                const next = Math.max(0, prev - count)
                setScrollOffset((offset) => (next < offset ? next : offset))
                return next
            })
            return
        }

        if (key.downArrow || input === 'j' || isWheelDown) {
            const count = isWheelDown
                ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                : 1
            setCursorLineIndex((prev) => {
                const next = Math.min(totalLines - 1, prev + count)
                setScrollOffset((offset) =>
                    next >= offset + visibleLineCount ? next - visibleLineCount + 1 : offset
                )
                return next
            })
            return
        }

        if (key.pageUp || (key.ctrl && input === 'u')) {
            setCursorLineIndex((prev) => {
                const next = Math.max(0, prev - visibleLineCount)
                setScrollOffset((offset) => Math.max(0, offset - visibleLineCount))
                return next
            })
            return
        }

        if (key.pageDown || (key.ctrl && input === 'd')) {
            setCursorLineIndex((prev) => {
                const next = Math.min(totalLines - 1, prev + visibleLineCount)
                setScrollOffset((offset) =>
                    Math.min(Math.max(0, totalLines - visibleLineCount), offset + visibleLineCount)
                )
                return next
            })
            return
        }

        if (input === 'g') {
            setCursorLineIndex(0)
            setScrollOffset(0)
            return
        }

        if (input === 'G') {
            setCursorLineIndex(Math.max(0, totalLines - 1))
            setScrollOffset(Math.max(0, totalLines - visibleLineCount))
            return
        }

        if (key.return || key.tab || input === 'c') {
            const lineNum = cursorLineIndexRef.current + 1
            if (onInsertContext) {
                onInsertContext(filePath, lineNum)
            }
            handleClose()
            return
        }
    })

    const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount)
    const linesAbove = scrollOffset
    const linesBelow = Math.max(0, totalLines - (scrollOffset + visibleLineCount))
    const hasOverflow = totalLines > visibleLineCount

    let statusText = ''
    if (hasOverflow) {
        if (linesAbove > 0 && linesBelow > 0) {
            statusText = `↑ ${linesAbove} lines above · ↓ ${linesBelow} lines below`
        } else if (linesAbove > 0) {
            statusText = `↑ ${linesAbove} lines above`
        } else if (linesBelow > 0) {
            statusText = `↓ ${linesBelow} lines below`
        }
    }

    const gutterWidth = Math.max(3, String(totalLines).length)

    const footerItems = [
        { key: '↑/↓', label: 'scroll' },
        { key: 'enter', label: 'insert @file:line' },
        { key: 'esc', label: 'dismiss' },
    ]

    return (
        <Box flexDirection="column" width={columns} paddingX={THEME.padding.paddingX}>
            {/* Header */}
            <Box justifyContent="space-between" width="100%">
                <Box gap={1}>
                    <Text bold color={THEME.colors.text}>
                        {filePath || '(no file)'}
                    </Text>
                    {totalLines > 0 ? (
                        <Text color={THEME.colors.dim}>
                            · {totalLines} line{totalLines === 1 ? '' : 's'} · line{' '}
                            {cursorLineIndex + 1}
                        </Text>
                    ) : null}
                </Box>
            </Box>

            {/* Viewport */}
            <Box flexDirection="column" width="100%" marginY={1}>
                {isLoading ? (
                    <Text color={THEME.colors.dim}>Loading file...</Text>
                ) : error ? (
                    <Text color={THEME.colors.error}>Error: {error}</Text>
                ) : totalLines === 0 ? (
                    <Text color={THEME.colors.dim}>(Empty file)</Text>
                ) : (
                    <>
                        {visibleLines.map((lineText, relIdx) => {
                            const absIdx = scrollOffset + relIdx
                            const isCursor = absIdx === cursorLineIndex
                            const lineNum = absIdx + 1
                            const paddedLineNum = String(lineNum).padStart(gutterWidth, ' ')

                            return (
                                <Box key={`line-${absIdx}`} flexDirection="row" width="100%">
                                    <Text color={isCursor ? THEME.colors.brand : THEME.colors.dim}>
                                        {isCursor ? `${THEME.glyphs.selector} ` : '  '}
                                    </Text>
                                    <Box width={gutterWidth + 3} flexShrink={0}>
                                        <Text
                                            color={isCursor ? THEME.colors.brand : THEME.colors.dim}
                                        >
                                            {paddedLineNum} |
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} flexShrink={1}>
                                        <Text
                                            bold={isCursor}
                                            color={isCursor ? THEME.colors.text : THEME.colors.dim}
                                            wrap="truncate-end"
                                        >
                                            {lineText || ' '}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}
                        {hasOverflow && statusText && (
                            <Box paddingLeft={2} marginTop={1}>
                                <Text color={THEME.colors.muted}>{statusText}</Text>
                            </Box>
                        )}
                    </>
                )}
            </Box>

            {/* Branded Footer */}
            <MenuFooter items={footerItems} />
        </Box>
    )
}
