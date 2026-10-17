import fs from 'node:fs/promises'
import path from 'node:path'

import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import {
    type DiffFileEntry,
    formatDiffSummary,
    parseUnifiedDiffToRows,
    fetchGitStatusFiles,
} from '../../utils/diff'

import { MenuFooter } from './menu-footer'

export interface DiffViewMenuProps {
    agent?: any
    filesData?: DiffFileEntry[]
    initialSelectedIndex?: number
    initialDetailView?: boolean
    setAuthMode?: (mode: string) => void
    onClose?: () => void
    addToast?: (msg: string, variant?: string) => void
}

export function DiffViewMenu(props: DiffViewMenuProps) {
    const {
        filesData: initialFiles,
        initialSelectedIndex = 0,
        initialDetailView = false,
        setAuthMode,
        onClose,
    } = props

    const columns = useTerminalColumns()
    const rows = useTerminalRows()

    // Bounded heights to ensure headers, viewport, and footer are always visible on screen
    const visibleLineCount = Math.max(5, Math.min(14, rows - 14))
    const WINDOW_SIZE = 6

    // State
    const [files, setFiles] = useState<DiffFileEntry[]>(initialFiles || [])
    const [isLoading, setIsLoading] = useState(!initialFiles)

    const [selectedFileIndex, setSelectedFileIndex] = useState(initialSelectedIndex)
    const [windowStart, setWindowStart] = useState(() =>
        Math.max(0, initialSelectedIndex - WINDOW_SIZE + 1)
    )
    const [isDetailView, setIsDetailView] = useState(initialDetailView)
    const [cursorLineIndex, setCursorLineIndex] = useState(0)
    const [detailScrollOffset, setDetailScrollOffset] = useState(0)
    const [expandedFolds, setExpandedFolds] = useState<Record<string, boolean>>({})
    const [fileContent, setFileContent] = useState<string | null>(null)

    // Per-file scroll & cursor memory
    const filePositionsRef = useRef<Record<string, { cursorIndex: number; scrollOffset: number }>>(
        {}
    )

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [onClose, setAuthMode])

    // Load live git data if not provided
    useEffect(() => {
        let isMounted = true
        if (!initialFiles) {
            setIsLoading(true)
            fetchGitStatusFiles()
                .then((loadedFiles) => {
                    if (isMounted) {
                        setFiles(loadedFiles)
                        setIsLoading(false)
                    }
                })
                .catch(() => {
                    // Intentionally swallowed: background git diff fetch error fallback
                    if (isMounted) {
                        setIsLoading(false)
                    }
                })
        }
        return () => {
            isMounted = false
        }
    }, [initialFiles])

    const safeFileIndex = Math.min(Math.max(0, selectedFileIndex), Math.max(0, files.length - 1))
    const currentFile = files[safeFileIndex]

    // Read file content for detail view (to display fold previews)
    useEffect(() => {
        let active = true
        if (isDetailView && currentFile?.path) {
            fs.readFile(path.resolve(process.cwd(), currentFile.path), 'utf8')
                .then((content) => {
                    if (active) setFileContent(content)
                })
                .catch(() => {
                    // Intentionally swallowed: file might be deleted or unreadable in test env
                    if (active) setFileContent(null)
                })
        } else {
            setFileContent(null)
        }
        return () => {
            active = false
        }
    }, [isDetailView, currentFile?.path])

    // Parse diff rows for current file
    const { diffRows, totalChanges, changeIndices } = useMemo(() => {
        if (!currentFile || !currentFile.diff) {
            return { diffRows: [], totalChanges: 0, changeIndices: [] }
        }
        const parsed = parseUnifiedDiffToRows(currentFile.diff, {
            fullContent: fileContent,
            expandedFolds,
        })
        return {
            diffRows: parsed.rows,
            totalChanges: parsed.totalChanges,
            changeIndices: parsed.changeIndices,
        }
    }, [currentFile, fileContent, expandedFolds])

    // Calculate current change index under cursor
    const currentChangeUnderCursor = useMemo(() => {
        if (changeIndices.length === 0) return '-'
        const pos = changeIndices.indexOf(cursorLineIndex)
        if (pos >= 0) return `${pos + 1}`
        let nearestBefore = -1
        for (let i = 0; i < changeIndices.length; i++) {
            const idx = changeIndices[i]
            if (idx !== undefined && idx <= cursorLineIndex) {
                nearestBefore = i + 1
            }
        }
        return nearestBefore > 0 ? `${nearestBefore}` : '-'
    }, [changeIndices, cursorLineIndex])

    // Ensure cursor stays within bounds when diffRows changes
    useEffect(() => {
        if (diffRows.length > 0 && cursorLineIndex >= diffRows.length) {
            setCursorLineIndex(Math.max(0, diffRows.length - 1))
        }
    }, [diffRows.length, cursorLineIndex])

    // Keep cursor in view
    useEffect(() => {
        if (!isDetailView) return
        if (cursorLineIndex < detailScrollOffset) {
            setDetailScrollOffset(cursorLineIndex)
        } else if (cursorLineIndex >= detailScrollOffset + visibleLineCount) {
            setDetailScrollOffset(cursorLineIndex - visibleLineCount + 1)
        }
    }, [cursorLineIndex, detailScrollOffset, visibleLineCount, isDetailView])

    // Cycle files helper
    const cycleFile = useCallback(
        (delta: number) => {
            if (files.length === 0) return
            if (currentFile) {
                filePositionsRef.current[currentFile.path] = {
                    cursorIndex: cursorLineIndex,
                    scrollOffset: detailScrollOffset,
                }
            }

            const nextIndex = (safeFileIndex + delta + files.length) % files.length
            setSelectedFileIndex(nextIndex)
            setWindowStart((ws) => {
                if (nextIndex < ws) return nextIndex
                if (nextIndex >= ws + WINDOW_SIZE) return Math.max(0, nextIndex - WINDOW_SIZE + 1)
                return ws
            })

            const nextFile = files[nextIndex]
            if (nextFile && filePositionsRef.current[nextFile.path]) {
                const saved = filePositionsRef.current[nextFile.path]
                if (saved) {
                    setCursorLineIndex(saved.cursorIndex)
                    setDetailScrollOffset(saved.scrollOffset)
                }
            } else {
                setCursorLineIndex(0)
                setDetailScrollOffset(0)
            }
        },
        [files, currentFile, safeFileIndex, cursorLineIndex, detailScrollOffset]
    )

    // Handle Input
    useInput((input, key) => {
        // Esc: strict 1-step back (detail view -> file list -> close)
        if (key.escape || input === '\u001B') {
            if (isDetailView) {
                setIsDetailView(false)
                return
            }
            handleClose()
            return
        }

        // List View Navigation
        if (!isDetailView) {
            const isWheelUp =
                /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
            const isWheelDown =
                /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

            // Navigate files up/down
            if (key.upArrow || input === 'k' || isWheelUp) {
                const count = isWheelUp
                    ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                    : 1
                if (selectedFileIndex > 0) {
                    const next = Math.max(0, selectedFileIndex - count)
                    setSelectedFileIndex(next)
                    if (next < windowStart) {
                        setWindowStart(next)
                    }
                }
                return
            }
            if (key.downArrow || input === 'j' || isWheelDown) {
                const count = isWheelDown
                    ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                    : 1
                if (selectedFileIndex < files.length - 1) {
                    const next = Math.min(files.length - 1, selectedFileIndex + count)
                    setSelectedFileIndex(next)
                    if (next >= windowStart + WINDOW_SIZE) {
                        setWindowStart(Math.max(0, next - WINDOW_SIZE + 1))
                    }
                }
                return
            }

            // View diff
            if (key.return || key.rightArrow) {
                if (files.length > 0 && currentFile) {
                    setIsDetailView(true)
                    const saved = filePositionsRef.current[currentFile.path]
                    if (saved) {
                        setCursorLineIndex(saved.cursorIndex)
                        setDetailScrollOffset(saved.scrollOffset)
                    } else {
                        setCursorLineIndex(0)
                        setDetailScrollOffset(0)
                    }
                }
                return
            }

            // Dismiss
            if (key.leftArrow) {
                handleClose()
                return
            }

            // Ignore unhandled mouse sequences
            if (
                input.includes('[<') ||
                input.includes('\x1b[<') ||
                input.includes('[M') ||
                input.includes('\x1b[M')
            ) {
                return
            }

            return
        }

        // Detail View Navigation
        if (isDetailView) {
            const isWheelUp =
                /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
            const isWheelDown =
                /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

            // Cycle files
            if (key.leftArrow) {
                cycleFile(-1)
                return
            }
            if (key.rightArrow) {
                cycleFile(1)
                return
            }

            // Cursor up/down
            if (key.upArrow || input === 'k' || isWheelUp) {
                const count = isWheelUp
                    ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                    : 1
                setCursorLineIndex((prev) => Math.max(0, prev - count))
                return
            }
            if (key.downArrow || input === 'j' || isWheelDown) {
                const count = isWheelDown
                    ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                    : 1
                setCursorLineIndex((prev) => Math.min(diffRows.length - 1, prev + count))
                return
            }

            // Jump next/prev diff change
            if (input === 'n') {
                const nextChange = changeIndices.find((idx) => idx > cursorLineIndex)
                if (nextChange !== undefined) {
                    setCursorLineIndex(nextChange)
                }
                return
            }
            if (input === 'N') {
                const prevChanges = changeIndices.filter((idx) => idx < cursorLineIndex)
                const prevChange = prevChanges[prevChanges.length - 1]
                if (prevChange !== undefined) {
                    setCursorLineIndex(prevChange)
                }
                return
            }

            // Toggle fold with Enter, Space, or ctrl+o when on a fold row
            if (key.return || input === ' ' || (key.ctrl && input === 'o')) {
                const currentRow = diffRows[cursorLineIndex]
                if (currentRow && currentRow.type === 'fold') {
                    const fid = currentRow.data.id
                    setExpandedFolds((prev) => ({ ...prev, [fid]: !prev[fid] }))
                }
                return
            }

            // Ignore unhandled mouse sequences
            if (
                input.includes('[<') ||
                input.includes('\x1b[<') ||
                input.includes('[M') ||
                input.includes('\x1b[M')
            ) {
                return
            }
        }
    })

    const listFooterItems = [
        { key: '←/→', label: 'switch view' },
        { key: '↑/↓/j/k', label: 'navigate' },
        { key: 'enter', label: 'view diff' },
        { key: 'esc', label: 'dismiss' },
    ]

    const detailFooterItems = [
        { key: 'n/N', label: 'next/prev diff' },
        { key: '←/→', label: 'cycle file' },
        { key: 'esc', label: 'back' },
    ]

    // ==========================================
    // RENDER: DETAIL VIEW
    // ==========================================
    if (isDetailView && currentFile) {
        const visibleRows = diffRows.slice(
            detailScrollOffset,
            detailScrollOffset + visibleLineCount
        )
        const remainingBelow = Math.max(
            0,
            diffRows.length - (detailScrollOffset + visibleLineCount)
        )

        return (
            <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
                {/* Header */}
                <Box justifyContent="space-between" width="100%">
                    <Box gap={1}>
                        <Text bold color={THEME.colors.text}>
                            {currentFile.path}
                        </Text>
                        <Text>
                            {currentFile.additions > 0 && (
                                <Text color={THEME.colors.success}>+{currentFile.additions} </Text>
                            )}
                            {currentFile.deletions > 0 && (
                                <Text color={THEME.colors.error}>-{currentFile.deletions}</Text>
                            )}
                        </Text>
                    </Box>
                    <Box>
                        <Text color={THEME.colors.dim}>
                            change {currentChangeUnderCursor}/{totalChanges || 0} · file{' '}
                            {safeFileIndex + 1}/{files.length}
                        </Text>
                    </Box>
                </Box>

                {/* Diff Viewport */}
                <Box flexDirection="column" marginTop={1}>
                    {visibleRows.length === 0 ? (
                        <Text color={THEME.colors.dim}>(Empty diff)</Text>
                    ) : (
                        visibleRows.map((row) => {
                            const isCursor = row.index === cursorLineIndex

                            if (row.type === 'fold') {
                                return (
                                    <Box key={`fold-${row.index}`} width="100%" flexDirection="row">
                                        <Text
                                            color={isCursor ? THEME.colors.brand : THEME.colors.dim}
                                        >
                                            {isCursor ? `${THEME.glyphs.selector} ` : '  '}
                                        </Text>
                                        <Text color={THEME.colors.dim}>
                                            {'      '}↕ {row.data.count} unchanged lines ·{' '}
                                            {row.data.preview}
                                        </Text>
                                    </Box>
                                )
                            }

                            const line = row.data
                            const lineNum =
                                line.type === 'delete' ? line.oldLineNumber : line.newLineNumber
                            const paddedLineNum = lineNum
                                ? String(lineNum).padStart(5, ' ')
                                : '     '

                            const sign =
                                line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
                            const bgColor =
                                line.type === 'add'
                                    ? THEME.colors.diffAddBg
                                    : line.type === 'delete'
                                      ? THEME.colors.diffDeleteBg
                                      : undefined

                            const signColor =
                                line.type === 'add'
                                    ? THEME.colors.success
                                    : line.type === 'delete'
                                      ? THEME.colors.error
                                      : THEME.colors.dim

                            const textColor =
                                line.type === 'add'
                                    ? THEME.colors.success
                                    : line.type === 'delete'
                                      ? THEME.colors.error
                                      : THEME.colors.text

                            return (
                                <Box
                                    key={`line-${row.index}`}
                                    width="100%"
                                    backgroundColor={bgColor}
                                    flexDirection="row"
                                >
                                    <Text color={isCursor ? THEME.colors.brand : THEME.colors.dim}>
                                        {isCursor ? `${THEME.glyphs.selector} ` : '  '}
                                    </Text>
                                    <Text color={THEME.colors.dim}>{paddedLineNum} </Text>
                                    <Text color={signColor}>{sign} </Text>
                                    <Text color={textColor} wrap="truncate-end">
                                        {line.content}
                                    </Text>
                                </Box>
                            )
                        })
                    )}
                    {remainingBelow > 0 && (
                        <Box marginTop={1}>
                            <Text color={THEME.colors.dim}>
                                … {remainingBelow} more lines (↓ to scroll)
                            </Text>
                        </Box>
                    )}
                </Box>

                {/* Branded Footer - Always rendered directly under viewport */}
                <MenuFooter items={detailFooterItems} />
            </Box>
        )
    }

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, files.length)
    const visibleFiles = files.slice(windowStart, windowEnd)
    const filesAbove = windowStart
    const filesBelow = files.length - windowEnd

    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX}>
            {/* Diff Summary Count */}
            <Box>
                <Text color={THEME.colors.text}>{formatDiffSummary(files.length)}</Text>
            </Box>

            {/* Files List - Sliding window with pagination indicators */}
            <Box flexDirection="column" marginY={1}>
                {isLoading ? (
                    <Text color={THEME.colors.dim}>Loading diffs...</Text>
                ) : files.length === 0 ? (
                    <Text color={THEME.colors.dim}>No changes detected in working copy.</Text>
                ) : (
                    <>
                        {filesAbove > 0 && (
                            <Box paddingLeft={2}>
                                <Text color={THEME.colors.muted}>↑ {filesAbove} more</Text>
                            </Box>
                        )}
                        {visibleFiles.map((file, relIdx) => {
                            const absIdx = windowStart + relIdx
                            const isSelected = absIdx === safeFileIndex
                            return (
                                <Box key={file.path} flexDirection="row">
                                    <Text
                                        color={isSelected ? THEME.colors.brand : THEME.colors.dim}
                                    >
                                        {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                    </Text>
                                    <Text
                                        bold={isSelected}
                                        color={isSelected ? THEME.colors.brand : THEME.colors.text}
                                    >
                                        {file.path}
                                    </Text>
                                    <Box marginLeft={1}>
                                        <Text>
                                            {file.additions > 0 && (
                                                <Text color={THEME.colors.success}>
                                                    +{file.additions}{' '}
                                                </Text>
                                            )}
                                            {file.deletions > 0 && (
                                                <Text color={THEME.colors.error}>
                                                    -{file.deletions}
                                                </Text>
                                            )}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}
                        {filesBelow > 0 && (
                            <Box paddingLeft={2}>
                                <Text color={THEME.colors.muted}>↓ {filesBelow} more</Text>
                            </Box>
                        )}
                    </>
                )}
            </Box>

            {/* Branded Footer */}
            <MenuFooter items={listFooterItems} />
        </Box>
    )
}
