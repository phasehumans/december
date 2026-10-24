import fs from 'node:fs/promises'
import { homedir } from 'node:os'

import { SkillDiscoveryEngine, type DiscoveredSkill } from '@december/shared'
import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useCallback } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import { TextInput } from '../text-input'

import { MenuFooter } from './menu-footer'

export interface SkillsMenuProps {
    workspaceDir?: string
    initialSelectedIndex?: number
    initialDetailView?: boolean
    onClose?: () => void
    setAuthMode?: (mode: string) => void
    onRunSkill?: (skillName: string) => void
    handleSubmit?: (text: string) => void
    addToast?: (msg: string, variant?: string) => void
}

function toTildePath(p: string): string {
    try {
        const home = homedir()
        return p.startsWith(home) ? '~' + p.slice(home.length) : p
    } catch {
        // Intentionally swallowed: fallback to original path
        return p
    }
}

function formatSingleLineDescription(desc: string, maxLen: number = 80): string {
    if (!desc) return ''
    const clean = desc
        .replace(/\r?\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    if (clean.length <= maxLen) return clean
    return clean.slice(0, maxLen - 1).trimEnd() + '…'
}

export function SkillsMenu({
    workspaceDir: propWorkspaceDir,
    initialSelectedIndex = 0,
    initialDetailView = false,
    onClose,
    setAuthMode,
    onRunSkill,
    handleSubmit,
    addToast,
}: SkillsMenuProps) {
    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80
    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24

    const workspaceDir = propWorkspaceDir || process.cwd()

    // Bounded viewports so header and footer are always visible without clipping
    const visibleLineCount = Math.max(5, Math.min(16, rows - 10))
    const LIST_WINDOW_SIZE = Math.max(4, Math.min(8, rows - 16))

    // State
    const [skills, setSkills] = useState<DiscoveredSkill[]>(() => {
        try {
            const engine = new SkillDiscoveryEngine({ workspaceDir })
            return engine.discoverAllSkills()
        } catch {
            return []
        }
    })
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)
    const [windowStart, setWindowStart] = useState(0)

    // Detail view state
    const [isDetailView, setIsDetailView] = useState(initialDetailView)
    const [detailContent, setDetailContent] = useState<string | null>(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)
    const [cursorLineIndex, setCursorLineIndex] = useState(0)
    const [detailScrollOffset, setDetailScrollOffset] = useState(0)

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [onClose, setAuthMode])

    // Load skills via SkillDiscoveryEngine
    useEffect(() => {
        try {
            const engine = new SkillDiscoveryEngine({ workspaceDir })
            const discovered = engine.discoverAllSkills()
            setSkills(discovered)
            setIsLoading(false)
        } catch (e: any) {
            // Intentionally swallowed: skill discovery fallback
            setSkills([])
            setIsLoading(false)
        }
    }, [workspaceDir])

    // Filter skills by search query
    const filteredSkills = useMemo(() => {
        if (!searchQuery.trim()) return skills
        const q = searchQuery.toLowerCase().trim()
        return skills.filter((s) => {
            const nameMatch = s.name.toLowerCase().includes(q)
            const descMatch = (s.metadata.description || '').toLowerCase().includes(q)
            return nameMatch || descMatch
        })
    }, [skills, searchQuery])

    const safeIndex = Math.min(Math.max(0, selectedIndex), Math.max(0, filteredSkills.length - 1))
    const currentSkill = filteredSkills[safeIndex]

    // Load file content when opening detail view
    const loadDetailContent = useCallback(async (skill: DiscoveredSkill) => {
        if (!skill?.entryFilePath) {
            setDetailError('No entry file path found for skill.')
            setDetailContent(null)
            return
        }
        setIsDetailLoading(true)
        setDetailError(null)
        try {
            const text = await fs.readFile(skill.entryFilePath, 'utf8')
            setDetailContent(text)
            setCursorLineIndex(0)
            setDetailScrollOffset(0)
        } catch (err: any) {
            setDetailError(err?.message || 'Failed to read skill documentation.')
            setDetailContent(null)
        } finally {
            setIsDetailLoading(false)
        }
    }, [])

    // Keyboard navigation
    useInput((input, key) => {
        // Detail View Controls
        if (isDetailView) {
            if (key.escape || input === 'q') {
                setIsDetailView(false)
                return
            }

            const detailLines = detailContent !== null ? detailContent.split('\n') : []
            const totalLines = detailLines.length
            if (totalLines === 0) return

            const isWheelUp =
                /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
            const isWheelDown =
                /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

            // Line by line
            if (key.upArrow || input === 'k' || isWheelUp) {
                const count = isWheelUp
                    ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                    : 1
                setCursorLineIndex((prev) => {
                    const next = Math.max(0, prev - count)
                    setDetailScrollOffset((offset) => (next < offset ? next : offset))
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
                    setDetailScrollOffset((offset) =>
                        next >= offset + visibleLineCount ? next - visibleLineCount + 1 : offset
                    )
                    return next
                })
                return
            }

            // Half page / full page scroll
            if (key.pageUp || (key.ctrl && input === 'u')) {
                const step = key.ctrl
                    ? Math.max(1, Math.floor(visibleLineCount / 2))
                    : visibleLineCount
                setCursorLineIndex((prev) => {
                    const next = Math.max(0, prev - step)
                    setDetailScrollOffset((offset) => Math.max(0, Math.min(next, offset - step)))
                    return next
                })
                return
            }

            if (key.pageDown || (key.ctrl && input === 'd')) {
                const step = key.ctrl
                    ? Math.max(1, Math.floor(visibleLineCount / 2))
                    : visibleLineCount
                setCursorLineIndex((prev) => {
                    const next = Math.min(totalLines - 1, prev + step)
                    setDetailScrollOffset((offset) =>
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

            // Top / Bottom
            if (input === 'g') {
                setCursorLineIndex(0)
                setDetailScrollOffset(0)
                return
            }

            if (input === 'G') {
                setCursorLineIndex(Math.max(0, totalLines - 1))
                setDetailScrollOffset(Math.max(0, totalLines - visibleLineCount))
                return
            }

            return
        }

        // List View Controls
        if (isSearching) {
            if (key.escape) {
                setIsSearching(false)
                setSearchQuery('')
                setSelectedIndex(0)
                setWindowStart(0)
                return
            }
            if (key.return || key.downArrow) {
                setIsSearching(false)
                return
            }
            return
        }

        if (key.escape) {
            if (searchQuery) {
                setSearchQuery('')
                setSelectedIndex(0)
                setWindowStart(0)
                return
            }
            handleClose()
            return
        }

        if (input === '/') {
            setIsSearching(true)
            return
        }

        if (key.return && currentSkill) {
            setIsDetailView(true)
            loadDetailContent(currentSkill)
            return
        }

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            const count = isWheelUp
                ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                : 1
            setSelectedIndex((prev) => {
                const next = Math.max(0, prev - count)
                if (next < windowStart) setWindowStart(next)
                return next
            })
            return
        }

        if (key.downArrow || input === 'j' || isWheelDown) {
            const count = isWheelDown
                ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                : 1
            setSelectedIndex((prev) => {
                const next = Math.min(filteredSkills.length - 1, prev + count)
                if (next >= windowStart + LIST_WINDOW_SIZE) {
                    setWindowStart(next - LIST_WINDOW_SIZE + 1)
                }
                return next
            })
            return
        }
    })

    // Detail View Rendering (Matching FileViewMenu / CodeSearchMenu)
    if (isDetailView && currentSkill) {
        const lines = detailContent !== null ? detailContent.split('\n') : []
        const totalLines = lines.length
        const visibleLines = lines.slice(detailScrollOffset, detailScrollOffset + visibleLineCount)
        const remainingRows = Math.max(0, visibleLineCount - visibleLines.length)
        const gutterWidth = Math.max(3, String(totalLines).length)
        const displayPath = toTildePath(currentSkill.entryFilePath)

        const detailFooterItems = [
            { key: '↑/↓', label: 'scroll' },
            { key: 'esc', label: 'back' },
        ]

        return (
            <Box flexDirection="column" width="100%">
                {/* Header: Skill name & entry file path on left, line coordinates on right */}
                <Box justifyContent="space-between" width="100%" marginBottom={1}>
                    <Box gap={1} flexShrink={1}>
                        <Text bold color={THEME.colors.brand}>
                            {currentSkill.name}
                        </Text>
                        <Box flexShrink={1}>
                            <Text color={THEME.colors.dim} wrap="truncate-end">
                                · {displayPath}
                            </Text>
                        </Box>
                        {totalLines > 0 ? (
                            <Text color={THEME.colors.dim}>({totalLines} lines)</Text>
                        ) : null}
                    </Box>
                    <Box flexShrink={0} marginLeft={1}>
                        <Text color={THEME.colors.text} bold>
                            line {cursorLineIndex + 1}:{totalLines}
                        </Text>
                    </Box>
                </Box>

                {/* Code Viewport with gutter, cursor highlight, and vim tildes */}
                <Box flexDirection="column" width="100%">
                    {isDetailLoading ? (
                        <Box marginY={1}>
                            <Text color={THEME.colors.dim}>Loading documentation...</Text>
                        </Box>
                    ) : detailError ? (
                        <Box marginY={1}>
                            <Text color={THEME.colors.error}>Error: {detailError}</Text>
                        </Box>
                    ) : totalLines === 0 ? (
                        <Box marginY={1}>
                            <Text color={THEME.colors.dim}>(Empty documentation)</Text>
                        </Box>
                    ) : (
                        <>
                            {visibleLines.map((lineText, relIdx) => {
                                const absIdx = detailScrollOffset + relIdx
                                const isCursor = absIdx === cursorLineIndex
                                const lineNum = absIdx + 1
                                const paddedLineNum = String(lineNum).padStart(gutterWidth, ' ')

                                return (
                                    <Box
                                        key={`line-${absIdx}`}
                                        flexDirection="row"
                                        width="100%"
                                        backgroundColor={
                                            isCursor ? THEME.colors.codespanBg : undefined
                                        }
                                    >
                                        <Box width={2} flexShrink={0}>
                                            <Text color={THEME.colors.brand} bold>
                                                {isCursor ? `${THEME.glyphs.selector} ` : '  '}
                                            </Text>
                                        </Box>
                                        <Box width={gutterWidth + 1} flexShrink={0}>
                                            <Text
                                                bold={isCursor}
                                                color={
                                                    isCursor ? THEME.colors.brand : THEME.colors.dim
                                                }
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

                {/* Footer */}
                <MenuFooter items={detailFooterItems} />
            </Box>
        )
    }

    // List View Windowing
    const windowEnd = Math.min(windowStart + LIST_WINDOW_SIZE, filteredSkills.length)
    const visibleSkills = filteredSkills.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = filteredSkills.length - windowEnd
    const hasOverflow = filteredSkills.length > LIST_WINDOW_SIZE

    let statusText = ''
    if (hasOverflow) {
        if (itemsAbove > 0 && itemsBelow > 0) {
            statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
        } else if (itemsAbove > 0) {
            statusText = `↑ ${itemsAbove} more`
        } else if (itemsBelow > 0) {
            statusText = `↓ ${itemsBelow} more`
        }
    }

    const workspaceSkillsCount = skills.filter((s) => s.origin === 'workspace').length
    const globalSkillsCount = skills.length - workspaceSkillsCount
    const workspaceSkillTemplate = `${toTildePath(workspaceDir)}/.agents/skills/{skill_name}/SKILL.md`

    const originLabel = currentSkill
        ? currentSkill.origin === 'workspace'
            ? 'Workspace skills'
            : currentSkill.origin === 'builtin'
              ? 'Builtin skills'
              : 'Global skills'
        : 'Skills'
    const originPath = currentSkill ? toTildePath(currentSkill.directoryPath) : ''

    const listFooterItems = isSearching
        ? [
              { key: 'enter / ↓', label: 'focus list' },
              { key: 'esc', label: 'exit search' },
          ]
        : [
              { key: '↑/↓', label: 'navigate' },
              { key: 'enter', label: 'view' },
              { key: '/', label: 'search' },
              { key: 'esc', label: 'close' },
          ]

    return (
        <Box flexDirection="column" width="100%">
            {/* Header */}
            <Box flexDirection="column" marginBottom={0}>
                <Text bold color={THEME.colors.text}>
                    Skills
                </Text>
                <Text color={THEME.colors.muted}>
                    {skills.length} skills
                    {skills.length > 0
                        ? ` · ${workspaceSkillsCount} workspace · ${globalSkillsCount} global`
                        : ''}
                </Text>
            </Box>

            {/* Create new skills guide */}
            <Box flexDirection="column" marginY={1}>
                <Text color={THEME.colors.muted}>Create new skills</Text>
                <Text color={THEME.colors.dim}> Workspace: {workspaceSkillTemplate}</Text>
                <Text color={THEME.colors.dim}>
                    {' '}
                    Global: ~/.gemini/antigravity-cli/skills/{'{skill_name}'}/SKILL.md
                </Text>
                <Text color={THEME.colors.dim}>
                    {' '}
                    Shared: ~/.gemini/skills/{'{skill_name}'}/SKILL.md
                </Text>
            </Box>

            {/* Search Filter Bar */}
            {isSearching ? (
                <Box flexDirection="row" gap={1} marginBottom={1}>
                    <Text color={THEME.colors.brand}>Search:</Text>
                    <TextInput
                        value={searchQuery}
                        onChange={(val) => {
                            setSearchQuery(val)
                            setSelectedIndex(0)
                            setWindowStart(0)
                        }}
                        onSubmit={() => setIsSearching(false)}
                        placeholder="Filter skills by name or description..."
                        focus={true}
                    />
                </Box>
            ) : searchQuery ? (
                <Box flexDirection="row" gap={1} marginBottom={1}>
                    <Text color={THEME.colors.muted}>Filter:</Text>
                    <Text color={THEME.colors.brand}>{searchQuery}</Text>
                    <Text color={THEME.colors.dim}>({filteredSkills.length} matches)</Text>
                </Box>
            ) : null}

            {/* Active Group / Origin Line */}
            {currentSkill && (
                <Box marginBottom={0}>
                    <Text color={THEME.colors.muted}>
                        {originLabel} · From {originPath}
                    </Text>
                </Box>
            )}

            {/* Skills List Container */}
            <Box flexDirection="column">
                {isLoading ? (
                    <Text color={THEME.colors.dim}>Loading skills...</Text>
                ) : filteredSkills.length === 0 ? (
                    <Text color={THEME.colors.dim}>
                        {searchQuery ? 'No skills matched your filter.' : 'No skills discovered.'}
                    </Text>
                ) : (
                    visibleSkills.map((skill, relIdx) => {
                        const absIdx = windowStart + relIdx
                        const isSelected = absIdx === safeIndex
                        const cleanDesc = formatSingleLineDescription(
                            skill.metadata.description,
                            75
                        )

                        return (
                            <Box key={skill.name} flexDirection="row">
                                <Box width={2} flexShrink={0}>
                                    <Text
                                        color={isSelected ? THEME.colors.brand : THEME.colors.muted}
                                    >
                                        {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                    </Text>
                                </Box>
                                <Box flexShrink={1}>
                                    <Text wrap="truncate-end">
                                        <Text
                                            bold={isSelected}
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.text
                                            }
                                        >
                                            {skill.name}
                                        </Text>
                                        <Text color={THEME.colors.dim}>: </Text>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.text : THEME.colors.muted
                                            }
                                        >
                                            {cleanDesc}
                                        </Text>
                                    </Text>
                                </Box>
                            </Box>
                        )
                    })
                )}

                {/* Bottom status line for overflow pagination */}
                {hasOverflow && statusText && (
                    <Box paddingLeft={2}>
                        <Text color={THEME.colors.muted}>{statusText}</Text>
                    </Box>
                )}
            </Box>

            {/* Footer */}
            <MenuFooter items={listFooterItems} />
        </Box>
    )
}
