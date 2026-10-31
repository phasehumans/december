import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { discoverProjectRules } from '@december/shared'
import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'

import { useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter, type MenuFooterItem } from './menu-footer'

export interface MemoryViewMenuProps {
    agent?: any
    workspaceDir?: string
    initialTab?: 'memory' | 'rules'
    memoryInitialTab?: 'memory' | 'rules'
    onClose?: () => void
    setAuthMode?: (mode: any) => void
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

    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24

    // Bounded viewport height matching FileViewMenu so header, code, and footer fit cleanly
    const visibleLineCount = Math.max(5, Math.min(18, rows - 10))

    const workspaceDir = propWorkspaceDir || agent?.workspaceDir || process.cwd()

    // Requested initial document category: 'memory' vs 'rules'
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

            // 1. Detect memory file (case-insensitive candidate check)
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

            // 2. Discover rules files via shared discovery engine
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
                    // Placeholder when no rules file exists
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

    const lines = useMemo(() => {
        if (!currentDoc || !currentDoc.content) return []
        return currentDoc.content.split(/\r?\n/)
    }, [currentDoc])

    const totalLines = lines.length

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
        if (key.escape || input === 'q' || (key.ctrl && input === 'c')) {
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
                setScrollOffset((offset) => (next < offset ? next : offset))
                return next
            })
            return
        }

        // Scrolling: Down arrow (no j/k)
        if (key.downArrow) {
            setCursorLineIndex((prev) => {
                const next = Math.min(totalLines - 1, prev + 1)
                setScrollOffset((offset) =>
                    next >= offset + visibleLineCount ? next - visibleLineCount + 1 : offset
                )
                return next
            })
            return
        }

        // Page navigation: PageUp / PageDown or Ctrl+u / Ctrl+d
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
    })

    const visibleLines = lines.slice(scrollOffset, scrollOffset + visibleLineCount)
    const remainingRows = Math.max(0, visibleLineCount - visibleLines.length)
    const gutterWidth = Math.max(3, String(totalLines).length)

    const footerItems: MenuFooterItem[] = [
        { key: '←/→', label: 'switch file' },
        { key: '↑/↓', label: 'scroll' },
        { key: 'PgUp/PgDn', label: 'page' },
        { key: 'esc', label: 'close' },
    ]

    return (
        <Box flexDirection="column" width="100%">
            {/* Top Navigation Bar: Exact HelpMenu Tab Style (no borders) */}
            <Box flexDirection="row" gap={2} marginBottom={1}>
                {documents.map((doc, idx) => {
                    const isCurrent = idx === safeDocIndex
                    return (
                        <Text
                            key={doc.id}
                            color={isCurrent ? THEME.colors.brand : THEME.colors.muted}
                            bold={isCurrent}
                        >
                            {doc.title}
                        </Text>
                    )
                })}
            </Box>

            {/* Top Header: Exact FileViewMenu Header Style */}
            <Box justifyContent="space-between" width="100%" marginBottom={1}>
                <Box gap={1}>
                    <Text bold color={THEME.colors.text}>
                        {currentDoc ? currentDoc.displayPath : '(no file)'}
                    </Text>
                    {totalLines > 0 ? (
                        <Text color={THEME.colors.dim}>
                            · {totalLines} line{totalLines === 1 ? '' : 's'}
                        </Text>
                    ) : null}
                </Box>
                <Box>
                    <Text color={THEME.colors.text} bold>
                        line {totalLines > 0 ? cursorLineIndex + 1 : 0}:1
                    </Text>
                </Box>
            </Box>

            {/* Viewport: Exact FileViewMenu Code Viewport Style */}
            <Box flexDirection="column" width="100%">
                {isLoading ? (
                    <Box marginY={1}>
                        <Text color={THEME.colors.dim}>Loading file...</Text>
                    </Box>
                ) : !currentDoc || !currentDoc.exists || totalLines === 0 ? (
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
