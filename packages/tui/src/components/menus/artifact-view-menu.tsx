import { ArtifactManager, type ArtifactEntry, type ArtifactReviewResult } from '@december/tools'
import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface ArtifactViewMenuProps {
    agent?: any
    sessionId?: string
    workspaceDir?: string
    initialArtifacts?: ArtifactEntry[]
    initialSelectedIndex?: number
    initialDetailView?: boolean
    pendingArtifactReview?: {
        artifact: ArtifactEntry
        resolve: (result: ArtifactReviewResult) => void
    } | null
    setPendingArtifactReview?: (review: any) => void
    setAuthMode?: (mode: string) => void
    onClose?: () => void
    addToast?: (msg: string, variant?: string) => void
}

export function ArtifactViewMenu(props: ArtifactViewMenuProps) {
    const {
        agent,
        sessionId: propSessionId,
        workspaceDir: propWorkspaceDir,
        initialArtifacts,
        initialSelectedIndex = 0,
        initialDetailView = false,
        pendingArtifactReview,
        setPendingArtifactReview,
        setAuthMode,
        onClose,
        addToast,
    } = props

    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80
    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24

    const visibleLineCount = Math.max(5, Math.min(14, rows - 10))

    const activeSessionId =
        propSessionId || agent?.sessionId || pendingArtifactReview?.artifact?.sessionId || 'default'
    const activeWorkspaceDir = propWorkspaceDir || process.cwd()

    const [artifacts, setArtifacts] = useState<ArtifactEntry[]>(() => {
        if (pendingArtifactReview?.artifact) {
            return [pendingArtifactReview.artifact]
        }
        return initialArtifacts || []
    })
    const [isLoading, setIsLoading] = useState(!initialArtifacts && !pendingArtifactReview)
    const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)
    const [isDetailView, setIsDetailView] = useState(() => {
        if (pendingArtifactReview) return true
        return initialDetailView
    })
    const [cursorLineIndex, setCursorLineIndex] = useState(0)
    const [scrollOffset, setScrollOffset] = useState(0)

    const positionsRef = useRef<Record<string, { cursorIndex: number; scrollOffset: number }>>({})

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [onClose, setAuthMode])

    // Load artifacts from global storage
    useEffect(() => {
        let isMounted = true
        if (!initialArtifacts && !pendingArtifactReview) {
            setIsLoading(true)
            ArtifactManager.listArtifacts(activeSessionId)
                .then((loaded) => {
                    if (isMounted) {
                        setArtifacts(loaded)
                        setIsLoading(false)
                    }
                })
                .catch(() => {
                    // Intentionally swallowed: artifact list read fallback
                    if (isMounted) {
                        setIsLoading(false)
                    }
                })
        }
        return () => {
            isMounted = false
        }
    }, [activeSessionId, initialArtifacts, pendingArtifactReview])

    const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, artifacts.length - 1))
    const currentArtifact = artifacts[safeIndex]

    // Content lines for Detail View
    const contentLines = useMemo(() => {
        if (!currentArtifact) return []
        return currentArtifact.content.split(/\r?\n/)
    }, [currentArtifact])

    // Detect section header indices for jumping with n/p
    const sectionIndices = useMemo(() => {
        const indices: number[] = []
        for (let i = 0; i < contentLines.length; i++) {
            const line = (contentLines[i] || '').trim()
            if (
                line.startsWith('#') ||
                line.startsWith('1.') ||
                line.startsWith('- [ ]') ||
                line.startsWith('- [x]')
            ) {
                indices.push(i)
            }
        }
        return indices
    }, [contentLines])

    // Keep scroll offset aligned with cursorLineIndex
    useEffect(() => {
        if (cursorLineIndex < scrollOffset) {
            setScrollOffset(cursorLineIndex)
        } else if (cursorLineIndex >= scrollOffset + visibleLineCount) {
            setScrollOffset(cursorLineIndex - visibleLineCount + 1)
        }
    }, [cursorLineIndex, scrollOffset, visibleLineCount])

    const handleApprove = useCallback(() => {
        if (!currentArtifact) return

        if (pendingArtifactReview && pendingArtifactReview.resolve) {
            pendingArtifactReview.resolve({ action: 'proceed' })
            if (setPendingArtifactReview) setPendingArtifactReview(null)
        }

        ArtifactManager.updateArtifactStatus(
            activeSessionId,
            currentArtifact.filename,
            'approved'
        ).catch(() => {
            // Intentionally swallowed: background status update failure
        })

        setArtifacts((prev) =>
            prev.map((item, idx) => (idx === safeIndex ? { ...item, status: 'approved' } : item))
        )

        if (addToast) {
            addToast(`Approved "${currentArtifact.filename}". Executing steps...`, 'success')
        }

        handleClose()
    }, [
        currentArtifact,
        pendingArtifactReview,
        setPendingArtifactReview,
        activeSessionId,
        safeIndex,
        addToast,
        handleClose,
    ])

    const handleRefine = useCallback(() => {
        if (!currentArtifact) return

        if (pendingArtifactReview && pendingArtifactReview.resolve) {
            pendingArtifactReview.resolve({
                action: 'refine',
                feedback: 'User requested plan refinement before execution.',
            })
            if (setPendingArtifactReview) setPendingArtifactReview(null)
        }

        ArtifactManager.updateArtifactStatus(
            activeSessionId,
            currentArtifact.filename,
            'needs_review'
        ).catch(() => {
            // Intentionally swallowed: background status update failure
        })

        if (addToast) {
            addToast(`Requested refinement for "${currentArtifact.filename}".`, 'info')
        }

        handleClose()
    }, [
        currentArtifact,
        pendingArtifactReview,
        setPendingArtifactReview,
        activeSessionId,
        addToast,
        handleClose,
    ])

    const handleReject = useCallback(() => {
        if (!currentArtifact) return

        if (pendingArtifactReview && pendingArtifactReview.resolve) {
            pendingArtifactReview.resolve({
                action: 'reject',
                feedback: 'Execution cancelled by user.',
            })
            if (setPendingArtifactReview) setPendingArtifactReview(null)
        }

        ArtifactManager.updateArtifactStatus(
            activeSessionId,
            currentArtifact.filename,
            'rejected'
        ).catch(() => {
            // Intentionally swallowed: background status update failure
        })

        setArtifacts((prev) =>
            prev.map((item, idx) => (idx === safeIndex ? { ...item, status: 'rejected' } : item))
        )

        if (addToast) {
            addToast(`Rejected "${currentArtifact.filename}".`, 'error')
        }

        handleClose()
    }, [
        currentArtifact,
        pendingArtifactReview,
        setPendingArtifactReview,
        activeSessionId,
        safeIndex,
        addToast,
        handleClose,
    ])

    const cycleArtifact = useCallback(
        (direction: number) => {
            if (artifacts.length <= 1 || !currentArtifact) return

            positionsRef.current[currentArtifact.filename] = {
                cursorIndex: cursorLineIndex,
                scrollOffset,
            }

            const nextIndex = (safeIndex + direction + artifacts.length) % artifacts.length
            setSelectedIndex(nextIndex)

            const target = artifacts[nextIndex]
            if (target && positionsRef.current[target.filename]) {
                const saved = positionsRef.current[target.filename]
                if (saved) {
                    setCursorLineIndex(saved.cursorIndex)
                    setScrollOffset(saved.scrollOffset)
                    return
                }
            }
            setCursorLineIndex(0)
            setScrollOffset(0)
        },
        [artifacts, currentArtifact, cursorLineIndex, scrollOffset, safeIndex]
    )

    useInput((input, key) => {
        // List View Navigation
        if (!isDetailView) {
            if (key.upArrow || input === 'k') {
                setSelectedIndex((prev) => Math.max(0, prev - 1))
                return
            }
            if (key.downArrow || input === 'j') {
                setSelectedIndex((prev) => Math.min(artifacts.length - 1, prev + 1))
                return
            }
            if (key.return || key.rightArrow) {
                if (artifacts.length > 0 && currentArtifact) {
                    setIsDetailView(true)
                    const saved = positionsRef.current[currentArtifact.filename]
                    if (saved) {
                        setCursorLineIndex(saved.cursorIndex)
                        setScrollOffset(saved.scrollOffset)
                    } else {
                        setCursorLineIndex(0)
                        setScrollOffset(0)
                    }
                }
                return
            }
            if (input === 'y') {
                handleApprove()
                return
            }
            if (key.escape || key.leftArrow) {
                handleClose()
                return
            }
            return
        }

        // Detail View Navigation
        if (isDetailView) {
            // Approval shortcuts
            if (input === 'y') {
                handleApprove()
                return
            }
            if (input === 'r') {
                handleRefine()
                return
            }
            if (input === 'n' && !key.ctrl) {
                // If it's a pending review, n is reject; otherwise n jumps next section
                if (pendingArtifactReview || currentArtifact?.status === 'needs_review') {
                    handleReject()
                    return
                }
            }

            // Cycle artifacts
            if (key.leftArrow) {
                cycleArtifact(-1)
                return
            }
            if (key.rightArrow) {
                cycleArtifact(1)
                return
            }

            // Scroll cursor
            if (key.upArrow || input === 'k') {
                setCursorLineIndex((prev) => Math.max(0, prev - 1))
                return
            }
            if (key.downArrow || input === 'j') {
                setCursorLineIndex((prev) => Math.min(contentLines.length - 1, prev + 1))
                return
            }

            // Section jump (J / K or ctrl+n / ctrl+p)
            if (input === 'J' || (key.ctrl && input === 'n')) {
                const nextSection = sectionIndices.find((idx) => idx > cursorLineIndex)
                if (nextSection !== undefined) {
                    setCursorLineIndex(nextSection)
                }
                return
            }
            if (input === 'K' || (key.ctrl && input === 'p')) {
                const prevSections = sectionIndices.filter((idx) => idx < cursorLineIndex)
                if (prevSections.length > 0) {
                    setCursorLineIndex(prevSections[prevSections.length - 1]!)
                }
                return
            }

            // Back to list view or dismiss
            if (key.escape) {
                if (pendingArtifactReview) {
                    handleClose()
                } else {
                    setIsDetailView(false)
                }
                return
            }
        }
    })

    const listFooterItems = [
        { key: '←/→', label: 'switch view' },
        { key: '↑/↓', label: 'navigate' },
        { key: 'enter', label: 'view artifact' },
        { key: 'y', label: 'quick approve' },
        { key: 'esc', label: 'dismiss' },
    ]

    const detailFooterItems = [
        { key: 'y', label: 'approve' },
        { key: 'r', label: 'refine' },
        { key: 'n', label: 'reject' },
        { key: 'J/K', label: 'jump sec' },
        { key: '←/→', label: 'cycle' },
        { key: 'esc', label: pendingArtifactReview ? 'dismiss' : 'back' },
    ]

    // ==========================================
    // RENDER: DETAIL VIEW
    // ==========================================
    if (isDetailView && currentArtifact) {
        const visibleRows = contentLines.slice(scrollOffset, scrollOffset + visibleLineCount)

        let statusColor: string = THEME.colors.muted
        let statusLabel = 'Draft'
        if (currentArtifact.status === 'approved') {
            statusColor = THEME.colors.success
            statusLabel = 'Approved'
        } else if (currentArtifact.status === 'needs_review') {
            statusColor = THEME.colors.brand
            statusLabel = 'Needs Review'
        } else if (currentArtifact.status === 'rejected') {
            statusColor = THEME.colors.error
            statusLabel = 'Rejected'
        }

        return (
            <Box flexDirection="column" width="100%">
                <Box flexDirection="column" marginY={1}>
                    {/* Header */}
                    <Box justifyContent="space-between">
                        <Box gap={1}>
                            <Text color={THEME.colors.brand} bold>
                                [Artifact {safeIndex + 1}/{artifacts.length}]
                            </Text>
                            <Text color={THEME.colors.text} bold>
                                {currentArtifact.filename}
                            </Text>
                            <Text color={THEME.colors.muted}>({currentArtifact.title})</Text>
                        </Box>
                        <Box gap={1}>
                            <Text color={statusColor} bold>
                                [{statusLabel}]
                            </Text>
                        </Box>
                    </Box>

                    {/* Path Bar */}
                    <Box marginBottom={1}>
                        <Text color={THEME.colors.muted}>
                            Path: ~/.december/artifacts/{activeSessionId}/{currentArtifact.filename}
                        </Text>
                    </Box>

                    {/* Viewport with line numbering */}
                    <Box flexDirection="column">
                        {visibleRows.map((line, relativeIdx) => {
                            const lineIndex = scrollOffset + relativeIdx
                            const isCursor = lineIndex === cursorLineIndex
                            const lineNum = String(lineIndex + 1).padStart(2, '0')

                            let lineTextColor: string = THEME.colors.text
                            let isBold = false
                            if (line.trim().startsWith('#')) {
                                lineTextColor = THEME.colors.brand
                                isBold = true
                            } else if (line.includes('[x]')) {
                                lineTextColor = THEME.colors.success
                            } else if (line.includes('[ ]')) {
                                lineTextColor = THEME.colors.muted
                            }

                            return (
                                <Box key={lineIndex} gap={1}>
                                    <Text
                                        color={isCursor ? THEME.colors.brand : THEME.colors.muted}
                                        bold={isCursor}
                                    >
                                        {lineNum} │
                                    </Text>
                                    <Text
                                        color={isCursor ? THEME.colors.brand : lineTextColor}
                                        bold={isCursor || isBold}
                                    >
                                        {line || ' '}
                                    </Text>
                                </Box>
                            )
                        })}
                    </Box>
                </Box>

                <MenuFooter items={detailFooterItems} />
            </Box>
        )
    }

    // ==========================================
    // RENDER: LIST VIEW
    // ==========================================
    return (
        <Box flexDirection="column" width="100%">
            <Box flexDirection="column" marginY={1}>
                {/* Header */}
                <Box justifyContent="space-between" marginBottom={1}>
                    <Text bold color={THEME.colors.text}>
                        Session Artifacts
                    </Text>
                    <Text color={THEME.colors.muted}>
                        {artifacts.length} {artifacts.length === 1 ? 'artifact' : 'artifacts'}{' '}
                        (~/.december/artifacts/{activeSessionId}/)
                    </Text>
                </Box>

                {isLoading ? (
                    <Box paddingY={1}>
                        <Text color={THEME.colors.muted}>Loading artifacts...</Text>
                    </Box>
                ) : artifacts.length === 0 ? (
                    <Box paddingY={1} flexDirection="column">
                        <Text color={THEME.colors.muted}>
                            No artifacts generated for this session yet.
                        </Text>
                        <Text color={THEME.colors.muted}>
                            Artifacts are created when planning architectures, refactors, or
                            execution specs.
                        </Text>
                    </Box>
                ) : (
                    <Box flexDirection="column">
                        {artifacts.map((artifact, idx) => {
                            const isSelected = idx === safeIndex

                            let statusBadgeColor: string = THEME.colors.muted
                            let statusText = 'Draft'
                            let statusBullet = '○'
                            if (artifact.status === 'approved') {
                                statusBadgeColor = THEME.colors.success
                                statusText = 'Approved'
                                statusBullet = '✓'
                            } else if (artifact.status === 'needs_review') {
                                statusBadgeColor = THEME.colors.brand
                                statusText = 'Needs Review'
                                statusBullet = '●'
                            } else if (artifact.status === 'rejected') {
                                statusBadgeColor = THEME.colors.error
                                statusText = 'Rejected'
                                statusBullet = '✕'
                            }

                            const typeLabel =
                                artifact.type.charAt(0).toUpperCase() + artifact.type.slice(1)

                            return (
                                <Box key={artifact.id || idx} justifyContent="space-between">
                                    <Box gap={1}>
                                        <Text
                                            color={isSelected ? THEME.colors.brand : 'transparent'}
                                        >
                                            {isSelected ? '>' : ' '}
                                        </Text>
                                        <Text color={statusBadgeColor} bold>
                                            {statusBullet}
                                        </Text>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.text
                                            }
                                            bold={isSelected}
                                        >
                                            {artifact.filename}
                                        </Text>
                                        <Text color={THEME.colors.muted}>({artifact.title})</Text>
                                    </Box>
                                    <Box gap={1}>
                                        <Text color={THEME.colors.muted}>[{typeLabel}]</Text>
                                        <Text color={statusBadgeColor} bold>
                                            [{statusText}]
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}
                    </Box>
                )}
            </Box>

            <MenuFooter items={listFooterItems} />
        </Box>
    )
}
