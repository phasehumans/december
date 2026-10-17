import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import {
    type DiffTab,
    type DiffFileEntry,
    type DiffRow,
    type DiffComment,
    formatDiffSummary,
    parseUnifiedDiffToRows,
    fetchGitStatusFiles,
    fetchGitCommitTree,
    extractTurnDiffs,
} from '../../utils/diff'

export interface DiffViewMenuProps {
    agent?: any
    filesData?: DiffFileEntry[]
    commitTreeData?: string[]
    turnsData?: Array<{ turn: number; files: DiffFileEntry[] }>
    initialTab?: DiffTab
    initialSelectedIndex?: number
    initialDetailView?: boolean
    modelLabel?: string
    activeModel?: string
    setAuthMode?: (mode: string) => void
    onClose?: () => void
    onCommentAdded?: (comment: DiffComment) => void
    addToast?: (msg: string, variant?: string) => void
}

const TABS: Array<{ id: DiffTab; label: string }> = [
    { id: 'git', label: 'Diff (git)' },
    { id: 'all', label: 'All Changes' },
    { id: 'turns', label: 'Per Turn' },
    { id: 'tree', label: 'Commit Tree' },
]

export function DiffViewMenu(props: DiffViewMenuProps) {
    const {
        agent,
        filesData: initialFiles,
        commitTreeData: initialTree,
        turnsData: initialTurns,
        initialTab = 'git',
        initialSelectedIndex = 0,
        initialDetailView = false,
        modelLabel,
        activeModel,
        setAuthMode,
        onClose,
        onCommentAdded,
        addToast,
    } = props

    const columns = useTerminalColumns()
    const rows = useTerminalRows()
    const maxVisibleRows = Math.max(8, rows - 7)

    // State
    const [activeTab, setActiveTab] = useState<DiffTab>(initialTab)
    const [files, setFiles] = useState<DiffFileEntry[]>(initialFiles || [])
    const [commitTree, setCommitTree] = useState<string[]>(initialTree || [])
    const [turns, setTurns] = useState<Array<{ turn: number; files: DiffFileEntry[] }>>(
        initialTurns || (agent?.messages ? extractTurnDiffs(agent.messages) : [])
    )
    const [isLoading, setIsLoading] = useState(!initialFiles)

    const [selectedFileIndex, setSelectedFileIndex] = useState(initialSelectedIndex)
    const [isDetailView, setIsDetailView] = useState(initialDetailView)
    const [cursorLineIndex, setCursorLineIndex] = useState(0)
    const [detailScrollOffset, setDetailScrollOffset] = useState(0)
    const [fullFileMode, setFullFileMode] = useState(false)
    const [expandedFolds, setExpandedFolds] = useState<Record<string, boolean>>({})

    // Review comments: filePath -> (lineNumber -> commentText)
    const [comments, setComments] = useState<Record<string, Record<number, string>>>({})
    const [isCommenting, setIsCommenting] = useState(false)
    const [commentInput, setCommentInput] = useState('')

    // Per-file scroll & cursor memory
    const filePositionsRef = useRef<Record<string, { cursorIndex: number; scrollOffset: number }>>(
        {}
    )

    const handleClose = useCallback(() => {
        const totalComments = Object.values(comments).reduce(
            (acc, fileMap) => acc + Object.keys(fileMap).length,
            0
        )
        if (totalComments > 0 && addToast) {
            addToast(`Recorded ${totalComments} review comment(s).`, 'success')
        }

        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [comments, onClose, setAuthMode, addToast])

    // Load live git data if not provided
    useEffect(() => {
        let isMounted = true
        if (!initialFiles) {
            setIsLoading(true)
            Promise.all([fetchGitStatusFiles(), fetchGitCommitTree()])
                .then(([loadedFiles, loadedTree]) => {
                    if (isMounted) {
                        setFiles(loadedFiles)
                        setCommitTree(loadedTree)
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

    // Current files depending on tab
    const currentFiles = useMemo(() => {
        if (activeTab === 'turns') {
            const allTurnFiles: DiffFileEntry[] = []
            for (const t of turns) {
                allTurnFiles.push(...t.files)
            }
            return allTurnFiles
        }
        return files
    }, [activeTab, files, turns])

    const safeFileIndex = Math.min(
        Math.max(0, selectedFileIndex),
        Math.max(0, currentFiles.length - 1)
    )
    const currentFile = currentFiles[safeFileIndex]

    // Parse diff rows for current file
    const { diffRows, totalChanges, changeIndices } = useMemo(() => {
        if (!currentFile || !currentFile.diff) {
            return { diffRows: [], totalChanges: 0, changeIndices: [] }
        }
        const parsed = parseUnifiedDiffToRows(currentFile.diff, { expandedFolds })
        return {
            diffRows: parsed.rows,
            totalChanges: parsed.totalChanges,
            changeIndices: parsed.changeIndices,
        }
    }, [currentFile, expandedFolds])

    // Calculate current change index under cursor
    const currentChangeUnderCursor = useMemo(() => {
        if (changeIndices.length === 0) return '–'
        const pos = changeIndices.indexOf(cursorLineIndex)
        if (pos >= 0) return `${pos + 1}`
        // Find nearest change before cursor
        let nearestBefore = -1
        for (let i = 0; i < changeIndices.length; i++) {
            const idx = changeIndices[i]
            if (idx !== undefined && idx <= cursorLineIndex) {
                nearestBefore = i + 1
            }
        }
        return nearestBefore > 0 ? `${nearestBefore}` : '–'
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
        } else if (cursorLineIndex >= detailScrollOffset + maxVisibleRows) {
            setDetailScrollOffset(cursorLineIndex - maxVisibleRows + 1)
        }
    }, [cursorLineIndex, detailScrollOffset, maxVisibleRows, isDetailView])

    // Cycle files helper
    const cycleFile = useCallback(
        (delta: number) => {
            if (currentFiles.length === 0) return
            // Save current file scroll
            if (currentFile) {
                filePositionsRef.current[currentFile.path] = {
                    cursorIndex: cursorLineIndex,
                    scrollOffset: detailScrollOffset,
                }
            }

            const nextIndex = (safeFileIndex + delta + currentFiles.length) % currentFiles.length
            setSelectedFileIndex(nextIndex)

            const nextFile = currentFiles[nextIndex]
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
        [currentFiles, currentFile, safeFileIndex, cursorLineIndex, detailScrollOffset]
    )

    // Handle Input
    useInput((input, key) => {
        // Comment Input Mode
        if (isCommenting) {
            if (key.escape) {
                setIsCommenting(false)
                setCommentInput('')
                return
            }
            if (key.return) {
                if (currentFile && commentInput.trim()) {
                    const row = diffRows[cursorLineIndex]
                    const lineNum =
                        row?.type === 'line'
                            ? row.data.newLineNumber ||
                              row.data.oldLineNumber ||
                              cursorLineIndex + 1
                            : cursorLineIndex + 1

                    setComments((prev) => {
                        const fileComments = { ...(prev[currentFile.path] || {}) }
                        fileComments[lineNum] = commentInput.trim()
                        return { ...prev, [currentFile.path]: fileComments }
                    })

                    if (onCommentAdded) {
                        onCommentAdded({
                            filePath: currentFile.path,
                            lineNumber: lineNum,
                            text: commentInput.trim(),
                            createdAt: new Date(),
                        })
                    }
                }
                setIsCommenting(false)
                setCommentInput('')
                return
            }
            if (key.backspace || key.delete) {
                setCommentInput((prev) => prev.slice(0, -1))
                return
            }
            if (input && !key.ctrl && !key.meta) {
                setCommentInput((prev) => prev + input)
                return
            }
            return
        }

        // Global dismiss / escape
        if (key.escape || input === '\u001B') {
            if (isDetailView) {
                setIsDetailView(false)
            } else {
                handleClose()
            }
            return
        }

        // List View Navigation
        if (!isDetailView) {
            // Tab switching
            if (key.tab || input === 'l' || key.rightArrow) {
                const currentIdx = TABS.findIndex((t) => t.id === activeTab)
                const nextTab = TABS[(currentIdx + 1) % TABS.length]?.id || 'git'
                setActiveTab(nextTab)
                setSelectedFileIndex(0)
                return
            }
            if ((key.shift && key.tab) || input === 'h' || key.leftArrow) {
                const currentIdx = TABS.findIndex((t) => t.id === activeTab)
                const prevTab = TABS[(currentIdx - 1 + TABS.length) % TABS.length]?.id || 'git'
                setActiveTab(prevTab)
                setSelectedFileIndex(0)
                return
            }

            // Up / Down
            if (key.upArrow || input === 'k') {
                setSelectedFileIndex((prev) => Math.max(0, prev - 1))
                return
            }
            if (key.downArrow || input === 'j') {
                setSelectedFileIndex((prev) => Math.min(currentFiles.length - 1, prev + 1))
                return
            }

            // Enter view diff
            if (key.return) {
                if (currentFiles.length > 0 && currentFile) {
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
            return
        }

        // Detail View Navigation
        if (isDetailView) {
            // Cycle files
            if (key.leftArrow) {
                cycleFile(-1)
                return
            }
            if (key.rightArrow) {
                cycleFile(1)
                return
            }

            // Move cursor up/down
            if (key.upArrow || input === 'k') {
                setCursorLineIndex((prev) => Math.max(0, prev - 1))
                return
            }
            if (key.downArrow || input === 'j') {
                setCursorLineIndex((prev) => Math.min(diffRows.length - 1, prev + 1))
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

            // Toggle fold with ctrl+o
            if (key.ctrl && input === 'o') {
                const currentRow = diffRows[cursorLineIndex]
                if (currentRow && currentRow.type === 'fold') {
                    const fid = currentRow.data.id
                    setExpandedFolds((prev) => ({ ...prev, [fid]: !prev[fid] }))
                } else {
                    // Find nearest fold
                    const nearestFold = diffRows
                        .filter((r) => r.type === 'fold')
                        .reduce(
                            (closest, r) => {
                                if (!closest) return r
                                return Math.abs(r.index - cursorLineIndex) <
                                    Math.abs(closest.index - cursorLineIndex)
                                    ? r
                                    : closest
                            },
                            null as DiffRow | null
                        )

                    if (nearestFold && nearestFold.type === 'fold') {
                        const fid = nearestFold.data.id
                        setExpandedFolds((prev) => ({ ...prev, [fid]: !prev[fid] }))
                    }
                }
                return
            }

            // Full file toggle
            if (input === 'f') {
                setFullFileMode((prev) => !prev)
                return
            }

            // Add comment on current line
            if (input === 'c') {
                setIsCommenting(true)
                setCommentInput('')
                return
            }

            // Delete comment on current line
            if (input === 'd') {
                if (currentFile) {
                    const row = diffRows[cursorLineIndex]
                    const lineNum =
                        row?.type === 'line'
                            ? row.data.newLineNumber ||
                              row.data.oldLineNumber ||
                              cursorLineIndex + 1
                            : cursorLineIndex + 1

                    setComments((prev) => {
                        const fileComments = { ...(prev[currentFile.path] || {}) }
                        delete fileComments[lineNum]
                        return { ...prev, [currentFile.path]: fileComments }
                    })
                }
                return
            }
        }
    })

    const effectiveModelLabel = modelLabel || activeModel || 'Gemini 3.8 Flash · high'

    // ==========================================
    // RENDER: DETAIL VIEW
    // ==========================================
    if (isDetailView && currentFile) {
        const visibleRows = diffRows.slice(detailScrollOffset, detailScrollOffset + maxVisibleRows)
        const fileComments = comments[currentFile.path] || {}

        return (
            <Box flexDirection="column" paddingX={THEME.padding.paddingX} paddingY={1}>
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
                            {safeFileIndex + 1}/{currentFiles.length}
                        </Text>
                    </Box>
                </Box>

                {/* Diff Viewport */}
                <Box flexDirection="column" marginTop={1} minHeight={maxVisibleRows}>
                    {visibleRows.length === 0 ? (
                        <Text color={THEME.colors.dim}>(Empty diff)</Text>
                    ) : (
                        visibleRows.map((row) => {
                            const isCursor = row.index === cursorLineIndex

                            if (row.type === 'fold') {
                                return (
                                    <Box key={`fold-${row.index}`} flexDirection="row" gap={1}>
                                        <Text
                                            color={isCursor ? THEME.colors.brand : THEME.colors.dim}
                                        >
                                            {isCursor ? '> ' : '  '}
                                        </Text>
                                        <Text color={THEME.colors.dim}>
                                            ↕ {row.data.count} unchanged lines · {row.data.preview}
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

                            const lineComment = lineNum ? fileComments[lineNum] : undefined

                            return (
                                <Box key={`line-${row.index}`} flexDirection="column">
                                    <Box backgroundColor={bgColor} flexDirection="row">
                                        <Text
                                            color={isCursor ? THEME.colors.brand : THEME.colors.dim}
                                        >
                                            {isCursor ? '>' : ' '}
                                        </Text>
                                        <Text color={THEME.colors.dim}>{paddedLineNum} </Text>
                                        <Text color={signColor}>{sign} </Text>
                                        <Text color={textColor} wrap="truncate-end">
                                            {line.content}
                                        </Text>
                                    </Box>

                                    {/* Existing review comment */}
                                    {lineComment && (
                                        <Box paddingLeft={8} backgroundColor="#25241b">
                                            <Text color={THEME.colors.warning}>
                                                💬 Comment: {lineComment}
                                            </Text>
                                        </Box>
                                    )}

                                    {/* Inline comment editor */}
                                    {isCommenting && isCursor && (
                                        <Box
                                            paddingLeft={8}
                                            backgroundColor="#1e293b"
                                            flexDirection="row"
                                        >
                                            <Text color={THEME.colors.brand}>
                                                💬 Comment: {commentInput}
                                                <Text color={THEME.colors.dim}>
                                                    _ (Enter to save, Esc to cancel)
                                                </Text>
                                            </Text>
                                        </Box>
                                    )}
                                </Box>
                            )
                        })
                    )}
                </Box>

                {/* Footer */}
                <Box justifyContent="space-between" marginTop={1}>
                    <Box gap={1}>
                        <Text color={THEME.colors.dim}>
                            n/N next/prev diff · ←/→ cycle file · ctrl+o expand · f full file · c
                            comment · d delete comment · esc back
                        </Text>
                    </Box>
                    <Box>
                        <Text color={THEME.colors.dim}>{effectiveModelLabel}</Text>
                    </Box>
                </Box>
            </Box>
        )
    }

    // ==========================================
    // RENDER: LIST VIEW
    // ==========================================
    return (
        <Box flexDirection="column" paddingX={THEME.padding.paddingX} paddingY={1}>
            {/* Tabs Header */}
            <Box flexDirection="row" gap={3} marginBottom={1}>
                {TABS.map((tab) => {
                    const isActive = tab.id === activeTab
                    return (
                        <Text
                            key={tab.id}
                            bold={isActive}
                            color={isActive ? THEME.colors.brand : THEME.colors.dim}
                        >
                            {tab.label}
                        </Text>
                    )
                })}
            </Box>

            {/* Tab Summary Count */}
            {activeTab !== 'tree' && (
                <Box marginBottom={1}>
                    <Text color={THEME.colors.text}>{formatDiffSummary(currentFiles.length)}</Text>
                </Box>
            )}

            {/* Tab Content */}
            <Box flexDirection="column" minHeight={maxVisibleRows}>
                {isLoading ? (
                    <Text color={THEME.colors.dim}>Loading diffs...</Text>
                ) : activeTab === 'tree' ? (
                    /* Commit Tree View */
                    <Box flexDirection="column" gap={0}>
                        {commitTree.slice(0, maxVisibleRows).map((line, idx) => {
                            const isWorkingCopy = line.includes('Working Copy')
                            return (
                                <Text
                                    key={idx}
                                    bold={isWorkingCopy}
                                    color={isWorkingCopy ? THEME.colors.brand : THEME.colors.text}
                                >
                                    {line}
                                </Text>
                            )
                        })}
                    </Box>
                ) : activeTab === 'turns' && turns.length === 0 ? (
                    <Text color={THEME.colors.dim}>No agent changes in current session yet.</Text>
                ) : currentFiles.length === 0 ? (
                    <Text color={THEME.colors.dim}>No changes detected in working copy.</Text>
                ) : (
                    /* Files List */
                    currentFiles.slice(0, maxVisibleRows).map((file, idx) => {
                        const isSelected = idx === safeFileIndex
                        return (
                            <Box key={file.path} flexDirection="row" gap={1}>
                                <Text color={isSelected ? THEME.colors.brand : THEME.colors.dim}>
                                    {isSelected ? '>' : ' '}
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
                    })
                )}
            </Box>

            {/* Footer */}
            <Box justifyContent="space-between" marginTop={1}>
                <Box gap={1}>
                    <Text color={THEME.colors.dim}>
                        ←/→ switch view · ↑/↓/j/k navigate · enter view diff · esc dismiss
                    </Text>
                </Box>
                <Box>
                    <Text color={THEME.colors.dim}>{effectiveModelLabel}</Text>
                </Box>
            </Box>
        </Box>
    )
}
