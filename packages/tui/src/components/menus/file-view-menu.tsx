import fs from 'node:fs/promises'
import path from 'node:path'

import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

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
}: FileViewMenuProps) {
    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80
    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24

    // Bounded viewport height leaving room for header, footer, and container so footer is never clipped
    const visibleLineCount = Math.max(5, Math.min(18, rows - 10))

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

    const lines = useMemo(() => (content !== null ? content.split('\n') : []), [content])
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

        // Line-by-line navigation
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

        // Half page scroll (Ctrl+u / Ctrl+d) or full page (PageUp / PageDown)
        if (key.pageUp || (key.ctrl && input === 'u')) {
            const step = key.ctrl ? Math.max(1, Math.floor(visibleLineCount / 2)) : visibleLineCount
            setCursorLineIndex((prev) => {
                const next = Math.max(0, prev - step)
                setScrollOffset((offset) => Math.max(0, Math.min(next, offset - step)))
                return next
            })
            return
        }

        if (key.pageDown || (key.ctrl && input === 'd')) {
            const step = key.ctrl ? Math.max(1, Math.floor(visibleLineCount / 2)) : visibleLineCount
            setCursorLineIndex((prev) => {
                const next = Math.min(totalLines - 1, prev + step)
                setScrollOffset((offset) =>
                    Math.min(
                        Math.max(0, totalLines - visibleLineCount),
                        next >= offset + visibleLineCount
                            ? next - visibleLineCount + 1
                            : offset + step
                    )
                )
                return next
            })
            return
        }

        // Top / Bottom motions: g / G
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

        // Center cursor in viewport: z
        if (input === 'z') {
            const half = Math.floor(visibleLineCount / 2)
            setScrollOffset(
                Math.max(
                    0,
                    Math.min(
                        Math.max(0, totalLines - visibleLineCount),
                        cursorLineIndexRef.current - half
                    )
                )
            )
            return
        }

        // Screen positioning motions: H, M, L
        if (input === 'H') {
            setCursorLineIndex(scrollOffsetRef.current)
            return
        }

        if (input === 'M') {
            const visibleCount = Math.min(visibleLineCount, totalLines - scrollOffsetRef.current)
            setCursorLineIndex(scrollOffsetRef.current + Math.floor(visibleCount / 2))
            return
        }

        if (input === 'L') {
            const visibleCount = Math.min(visibleLineCount, totalLines - scrollOffsetRef.current)
            setCursorLineIndex(Math.max(0, scrollOffsetRef.current + visibleCount - 1))
            return
        }

        // Enter / Tab / c: insert context directly without calling handleClose
        if (key.return || key.tab || input === 'c') {
            const lineNum = cursorLineIndexRef.current + 1
            if (onInsertContext) {
                onInsertContext(filePath, lineNum)
            } else {
                handleClose()
            }
            return
        }
    })

    const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount)
    const remainingRows = Math.max(0, visibleLineCount - visibleLines.length)
    const gutterWidth = Math.max(3, String(totalLines).length)

    const footerItems = [
        { key: '↑/↓', label: 'scroll' },
        { key: 'enter', label: 'insert @file:line' },
        { key: 'esc', label: 'dismiss' },
    ]

    return (
        <Box flexDirection="column" width="100%">
            {/* Top Header: File info on left, line coordinates on right */}
            <Box justifyContent="space-between" width="100%" marginBottom={1}>
                <Box gap={1}>
                    <Text bold color={THEME.colors.text}>
                        {filePath || '(no file)'}
                    </Text>
                    {totalLines > 0 ? (
                        <Text color={THEME.colors.dim}>
                            · {totalLines} line{totalLines === 1 ? '' : 's'}
                        </Text>
                    ) : null}
                </Box>
                <Box>
                    <Text color={THEME.colors.text} bold>
                        line {cursorLineIndex + 1}:1
                    </Text>
                </Box>
            </Box>

            {/* Viewport: Code with full-row highlight bar and clean white text */}
            <Box flexDirection="column" width="100%">
                {isLoading ? (
                    <Box marginY={1}>
                        <Text color={THEME.colors.dim}>Loading file...</Text>
                    </Box>
                ) : error ? (
                    <Box marginY={1}>
                        <Text color={THEME.colors.error}>Error: {error}</Text>
                    </Box>
                ) : totalLines === 0 ? (
                    <Box marginY={1}>
                        <Text color={THEME.colors.dim}>(Empty file)</Text>
                    </Box>
                ) : (
                    <>
                        {visibleLines.map((lineText, relIdx) => {
                            const absIdx = scrollOffset + relIdx
                            const isCursor = absIdx === cursorLineIndex
                            const lineNum = absIdx + 1
                            const paddedLineNum = String(lineNum).padStart(gutterWidth, ' ')

                            return (
                                <Box
                                    key={`line-${absIdx}`}
                                    flexDirection="row"
                                    width="100%"
                                    backgroundColor={isCursor ? THEME.colors.codespanBg : undefined}
                                >
                                    <Box width={2} flexShrink={0}>
                                        <Text color={THEME.colors.brand} bold>
                                            {isCursor ? `${THEME.glyphs.selector} ` : '  '}
                                        </Text>
                                    </Box>
                                    <Box width={gutterWidth + 1} flexShrink={0}>
                                        <Text
                                            bold={isCursor}
                                            color={isCursor ? THEME.colors.brand : THEME.colors.dim}
                                        >
                                            {paddedLineNum}{' '}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} flexShrink={1}>
                                        <Text
                                            bold={isCursor}
                                            color={THEME.colors.text}
                                            wrap="truncate-end"
                                        >
                                            {lineText || ' '}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}
                        {remainingRows > 0 &&
                            Array.from({ length: remainingRows }).map((_, idx) => (
                                <Box key={`tilde-${idx}`} flexDirection="row" width="100%">
                                    <Box width={2} flexShrink={0}>
                                        <Text> </Text>
                                    </Box>
                                    <Box width={gutterWidth + 1} flexShrink={0}>
                                        <Text color={THEME.colors.brand}>~ </Text>
                                    </Box>
                                </Box>
                            ))}
                    </>
                )}
            </Box>

            {/* Clean Bottom Navigation Footer */}
            <MenuFooter items={footerItems} />
        </Box>
    )
}
