import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { discoverProjectRules } from '@december/shared'
import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter, type MenuFooterItem } from './menu-footer'

export interface MemoryViewMenuProps {
    agent?: any
    workspaceDir?: string
    initialTab?: 'memory' | 'rules'
    memoryInitialTab?: 'memory' | 'rules'
    onClose?: () => void
    setAuthMode?: (mode: string) => void
    handleSubmit?: (text: string, options?: any) => void
    addToast?: (msg: string, variant?: string) => void
}

interface ContextDocument {
    id: string
    title: string
    filePath: string
    displayPath: string
    content: string
    exists: boolean
    isMemory: boolean
}

function toTildePath(p: string): string {
    try {
        const home = os.homedir()
        return p.startsWith(home) ? '~' + p.slice(home.length) : p
    } catch {
        // Intentionally swallowed: fallback to original path
        return p
    }
}

export function MemoryViewMenu(props: MemoryViewMenuProps) {
    const {
        agent,
        workspaceDir: propWorkspaceDir,
        initialTab,
        memoryInitialTab,
        onClose,
        setAuthMode,
    } = props

    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80
    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24

    const workspaceDir = propWorkspaceDir || agent?.workspaceDir || process.cwd()

    // Determine initial active document category: 'memory' vs 'rules'
    const requestedTab = initialTab || memoryInitialTab || 'memory'

    const [documents, setDocuments] = useState<ContextDocument[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeDocIndex, setActiveDocIndex] = useState(0)
    const [cursorLineIndex, setCursorLineIndex] = useState(0)
    const [scrollOffset, setScrollOffset] = useState(0)

    // Store per-document scroll positions
    const scrollPositionsRef = useRef<
        Record<string, { cursorIndex: number; scrollOffset: number }>
    >({})

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [onClose, setAuthMode])

    // Discover memory and rules documents
    useEffect(() => {
        let isMounted = true
        setIsLoading(true)

        async function loadAllDocuments() {
            const docs: ContextDocument[] = []

            // 1. Detect memory file (case-insensitive check)
            const memoryCandidates = [
                path.join(workspaceDir, '.december', 'memory.md'),
                path.join(workspaceDir, '.december', 'MEMORY.md'),
                path.join(workspaceDir, 'memory.md'),
                path.join(workspaceDir, 'MEMORY.md'),
            ]

            let foundMemoryPath = ''
            let memoryContent = ''

            for (const cand of memoryCandidates) {
                try {
                    const text = await fs.readFile(cand, 'utf8')
                    foundMemoryPath = cand
                    memoryContent = text
                    break
                } catch {
                    // Intentionally swallowed: candidate memory file not found
                }
            }

            if (foundMemoryPath) {
                const base = path.basename(foundMemoryPath)
                docs.push({
                    id: 'memory',
                    title: base,
                    filePath: foundMemoryPath,
                    displayPath: path.relative(workspaceDir, foundMemoryPath) || base,
                    content: memoryContent,
                    exists: true,
                    isMemory: true,
                })
            } else {
                docs.push({
                    id: 'memory',
                    title: 'memory.md',
                    filePath: path.join(workspaceDir, '.december', 'memory.md'),
                    displayPath: '.december/memory.md',
                    content: '',
                    exists: false,
                    isMemory: true,
                })
            }

            // 2. Discover rules files via shared engine
            try {
                const discoveredRules = discoverProjectRules(workspaceDir)
                if (discoveredRules.length > 0) {
                    discoveredRules.forEach((rf, idx) => {
                        const base = path.basename(rf.path)
                        const isGlobal =
                            rf.path.includes('.december') && !rf.path.startsWith(workspaceDir)
                        const relPath = path.relative(workspaceDir, rf.path)
                        let title = base
                        if (isGlobal) {
                            title = `${base} (global)`
                        } else if (relPath.startsWith('..')) {
                            title = `${base} (parent)`
                        }

                        docs.push({
                            id: `rule-${idx}`,
                            title,
                            filePath: rf.path,
                            displayPath: toTildePath(rf.path),
                            content: rf.content,
                            exists: true,
                            isMemory: false,
                        })
                    })
                } else {
                    // Placeholder when no rules file is found
                    docs.push({
                        id: 'rules',
                        title: 'AGENTS.md',
                        filePath: path.join(workspaceDir, 'AGENTS.md'),
                        displayPath: './AGENTS.md',
                        content: '',
                        exists: false,
                        isMemory: false,
                    })
                }
            } catch {
                // Intentionally swallowed: fallback to empty rules entry
                docs.push({
                    id: 'rules',
                    title: 'AGENTS.md',
                    filePath: path.join(workspaceDir, 'AGENTS.md'),
                    displayPath: './AGENTS.md',
                    content: '',
                    exists: false,
                    isMemory: false,
                })
            }

            if (isMounted) {
                setDocuments(docs)

                // Select initial document based on requested tab
                if (requestedTab === 'rules') {
                    const firstRuleIndex = docs.findIndex((d) => !d.isMemory)
                    setActiveDocIndex(firstRuleIndex !== -1 ? firstRuleIndex : 0)
                } else {
                    setActiveDocIndex(0)
                }

                setIsLoading(false)
            }
        }

        loadAllDocuments()

        return () => {
            isMounted = false
        }
    }, [workspaceDir, requestedTab])

    const safeDocIndex = Math.min(Math.max(0, activeDocIndex), Math.max(0, documents.length - 1))
    const currentDoc = documents[safeDocIndex]

    const contentLines = useMemo(() => {
        if (!currentDoc || !currentDoc.content) return []
        return currentDoc.content.split(/\r?\n/)
    }, [currentDoc])

    const totalLines = contentLines.length
    const visibleLineCount = Math.max(5, rows - 9)

    // Switch documents while preserving scroll offset
    const switchDocument = useCallback(
        (targetIndex: number) => {
            if (
                targetIndex === safeDocIndex ||
                targetIndex < 0 ||
                targetIndex >= documents.length
            ) {
                return
            }

            if (currentDoc) {
                scrollPositionsRef.current[currentDoc.id] = {
                    cursorIndex: cursorLineIndex,
                    scrollOffset,
                }
            }

            setActiveDocIndex(targetIndex)

            const targetDoc = documents[targetIndex]
            if (targetDoc && scrollPositionsRef.current[targetDoc.id]) {
                const saved = scrollPositionsRef.current[targetDoc.id]
                if (saved) {
                    setCursorLineIndex(saved.cursorIndex)
                    setScrollOffset(saved.scrollOffset)
                    return
                }
            }

            setCursorLineIndex(0)
            setScrollOffset(0)
        },
        [safeDocIndex, documents, currentDoc, cursorLineIndex, scrollOffset]
    )

    // Keyboard navigation (arrows only for scrolling, no j/k)
    useInput((input, key) => {
        // Close menu
        if (key.escape || (key.ctrl && input === 'c')) {
            handleClose()
            return
        }

        // Tab switching: Tab, Shift+Tab, Left/Right arrow keys
        if (key.tab || key.rightArrow) {
            if (documents.length > 1) {
                const step = key.shift ? -1 : 1
                const next = (safeDocIndex + step + documents.length) % documents.length
                switchDocument(next)
            }
            return
        }

        if (key.leftArrow) {
            if (documents.length > 1) {
                const next = (safeDocIndex - 1 + documents.length) % documents.length
                switchDocument(next)
            }
            return
        }

        // Number keys 1-9 to jump directly to a tab
        const num = parseInt(input, 10)
        if (!isNaN(num) && num >= 1 && num <= documents.length) {
            switchDocument(num - 1)
            return
        }

        if (totalLines === 0) return

        // Scrolling: Up arrow (no j/k)
        if (key.upArrow) {
            setCursorLineIndex((prev) => {
                const next = Math.max(0, prev - 1)
                if (next < scrollOffset) {
                    setScrollOffset(next)
                }
                return next
            })
            return
        }

        // Scrolling: Down arrow (no j/k)
        if (key.downArrow) {
            setCursorLineIndex((prev) => {
                const next = Math.min(totalLines - 1, prev + 1)
                if (next >= scrollOffset + visibleLineCount) {
                    setScrollOffset(next - visibleLineCount + 1)
                }
                return next
            })
            return
        }

        // Page navigation: PageUp / PageDown
        if (key.pageUp) {
            setCursorLineIndex((prev) => {
                const next = Math.max(0, prev - visibleLineCount)
                setScrollOffset((offset) => Math.max(0, offset - visibleLineCount))
                return next
            })
            return
        }

        if (key.pageDown) {
            setCursorLineIndex((prev) => {
                const next = Math.min(totalLines - 1, prev + visibleLineCount)
                setScrollOffset((offset) =>
                    Math.min(Math.max(0, totalLines - visibleLineCount), offset + visibleLineCount)
                )
                return next
            })
            return
        }
    })

    const visibleLines = contentLines.slice(scrollOffset, scrollOffset + visibleLineCount)
    const gutterWidth = Math.max(3, String(totalLines).length)
    const remainingRows = Math.max(0, visibleLineCount - visibleLines.length)

    const byteSize = currentDoc ? Buffer.byteLength(currentDoc.content, 'utf8') : 0
    const formatKb = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        return `${(bytes / 1024).toFixed(1)} KB`
    }

    const footerItems: MenuFooterItem[] = [
        { key: 'Tab / ← →', label: 'switch file' },
        { key: '↑/↓', label: 'scroll' },
        { key: 'PgUp/PgDn', label: 'page' },
        { key: 'Esc', label: 'close' },
    ]

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={THEME.colors.brand}
            paddingX={1}
            width={Math.min(columns, 110)}
        >
            {/* Top Bar: Tabs for each discovered file */}
            <Box gap={1} paddingBottom={1} flexWrap="wrap">
                {documents.map((doc, idx) => {
                    const isActive = idx === safeDocIndex
                    return (
                        <Box
                            key={doc.id}
                            borderStyle={isActive ? 'single' : undefined}
                            borderColor={THEME.colors.brand}
                            paddingX={1}
                        >
                            <Text
                                bold={isActive}
                                color={isActive ? THEME.colors.brand : THEME.colors.muted}
                            >
                                [{idx + 1}] {doc.title}
                                {!doc.exists && ' (empty)'}
                            </Text>
                        </Box>
                    )
                })}
            </Box>

            {/* Document Header: File path, line count, byte size, coordinates */}
            {currentDoc && (
                <Box justifyContent="space-between" width="100%" marginBottom={1}>
                    <Box gap={1} flexShrink={1}>
                        <Text bold color={THEME.colors.brand}>
                            {currentDoc.title}
                        </Text>
                        <Text color={THEME.colors.dim}>·</Text>
                        <Text color={THEME.colors.muted} wrap="truncate-end">
                            {currentDoc.displayPath}
                        </Text>
                        {totalLines > 0 && (
                            <Text color={THEME.colors.dim}>
                                ({totalLines} lines, {formatKb(byteSize)})
                            </Text>
                        )}
                    </Box>
                    <Box flexShrink={0} marginLeft={1}>
                        <Text color={THEME.colors.text} bold>
                            line {totalLines > 0 ? cursorLineIndex + 1 : 0}:{totalLines}
                        </Text>
                    </Box>
                </Box>
            )}

            {/* Main Content Viewport */}
            <Box flexDirection="column" minHeight={visibleLineCount}>
                {isLoading ? (
                    <Text color={THEME.colors.muted}>Loading agent memory and rules...</Text>
                ) : !currentDoc || !currentDoc.exists || totalLines === 0 ? (
                    <Box flexDirection="column" paddingY={2} gap={1}>
                        <Text color={THEME.colors.warning} bold>
                            {currentDoc?.isMemory
                                ? 'No workspace memory recorded yet.'
                                : 'No project rules found in workspace.'}
                        </Text>
                        <Text color={THEME.colors.dim}>
                            {currentDoc?.isMemory
                                ? 'December automatically records workspace notes, build commands, and quirks into .december/memory.md as you work.'
                                : 'Create an AGENTS.md or .december/rules.md file in your repository to define persistent guidelines for the agent.'}
                        </Text>
                    </Box>
                ) : (
                    <Box flexDirection="column" width="100%">
                        {visibleLines.map((line, idx) => {
                            const lineNum = scrollOffset + idx + 1
                            const isCursor = scrollOffset + idx === cursorLineIndex
                            const numStr = String(lineNum).padStart(gutterWidth, ' ')

                            return (
                                <Box key={idx} width="100%">
                                    <Text
                                        color={isCursor ? THEME.colors.brand : THEME.colors.border}
                                    >
                                        {numStr} │{' '}
                                    </Text>
                                    <Text
                                        color={isCursor ? THEME.colors.text : THEME.colors.muted}
                                        wrap="truncate"
                                    >
                                        {line || ' '}
                                    </Text>
                                </Box>
                            )
                        })}

                        {/* Fill empty viewport rows with subtle tildes */}
                        {Array.from({ length: remainingRows }).map((_, idx) => (
                            <Box key={`tilde-${idx}`} width="100%">
                                <Text color={THEME.colors.border}>{' '.repeat(gutterWidth)} ~</Text>
                            </Box>
                        ))}
                    </Box>
                )}
            </Box>

            {/* Footer with key hints */}
            <MenuFooter items={footerItems} />
        </Box>
    )
}
