import fs from 'node:fs/promises'
import path from 'node:path'

import { discoverProjectRules, type DiscoveredRuleFile } from '@december/shared'
import {
    getWorkspaceMemoryDetails,
    recordMemoryDirect,
    forgetMemoryDirect,
    clearMemoryDirect,
    DEFAULT_AGENTS_MD_TEMPLATE,
    MAX_WORKSPACE_MEMORY_BYTES,
    type WorkspaceMemoryDetails,
} from '@december/tools'
import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect, useMemo, useCallback } from 'react'

import { useTerminalColumns, useTerminalRows } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'
import { TextInput } from '../text-input'

import { MenuFooter, type MenuFooterItem } from './menu-footer'

export interface MemoryViewMenuProps {
    agent?: any
    workspaceDir?: string
    initialTab?: 'memory' | 'rules'
    onClose?: () => void
    setAuthMode?: (mode: string) => void
    handleSubmit?: (text: string, options?: any) => void
    addToast?: (msg: string, variant?: string) => void
}

const MEMORY_CATEGORIES = [
    'conventions',
    'build_and_test',
    'architecture',
    'quirks',
    'rules',
    'general',
] as const

export function MemoryViewMenu(props: MemoryViewMenuProps) {
    const {
        agent,
        workspaceDir: propWorkspaceDir,
        initialTab = 'memory',
        onClose,
        setAuthMode,
        handleSubmit,
        addToast,
    } = props

    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80
    const terminalRows = useTerminalRows()
    const rows = terminalRows > 0 ? terminalRows : 24
    const isNarrow = columns < 88

    const workspaceDir = propWorkspaceDir || agent?.workspaceDir || process.cwd()

    // Tab state: 'memory' vs 'rules'
    const [activeTab, setActiveTab] = useState<'memory' | 'rules'>(initialTab)

    // Workspace memory state
    const [memoryDetails, setMemoryDetails] = useState<WorkspaceMemoryDetails | null>(null)
    const [isMemoryLoading, setIsMemoryLoading] = useState(true)
    const [selectedEntryIndex, setSelectedEntryIndex] = useState(0)
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')

    // Memory mutation states
    const [isAddingEntry, setIsAddingEntry] = useState(false)
    const [newEntryText, setNewEntryText] = useState('')
    const [newEntryCategoryIndex, setNewEntryCategoryIndex] = useState(0)
    const [isConfirmingClear, setIsConfirmingClear] = useState(false)

    // Search state for memory
    const [isSearching, setIsSearching] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Rules state
    const [ruleFiles, setRuleFiles] = useState<DiscoveredRuleFile[]>([])
    const [selectedRuleIndex, setSelectedRuleIndex] = useState(0)
    const [ruleScrollOffset, setRuleScrollOffset] = useState(0)
    const [isRulesLoading, setIsRulesLoading] = useState(true)

    const handleClose = useCallback(() => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }, [onClose, setAuthMode])

    // Load workspace memory
    const loadMemory = useCallback(async () => {
        setIsMemoryLoading(true)
        try {
            const details = await getWorkspaceMemoryDetails(workspaceDir)
            setMemoryDetails(details)
        } catch {
            // Intentionally swallowed: fallback to empty memory details
            setMemoryDetails(null)
        } finally {
            setIsMemoryLoading(false)
        }
    }, [workspaceDir])

    // Load discovered rules
    const loadRules = useCallback(() => {
        setIsRulesLoading(true)
        try {
            const discovered = discoverProjectRules(workspaceDir)
            setRuleFiles(discovered)
        } catch {
            // Intentionally swallowed: rules discovery error fallback
            setRuleFiles([])
        } finally {
            setIsRulesLoading(false)
        }
    }, [workspaceDir])

    useEffect(() => {
        loadMemory()
        loadRules()
    }, [loadMemory, loadRules])

    // Filter memory entries by category and search
    const filteredEntries = useMemo(() => {
        if (!memoryDetails?.entries) return []
        let items = memoryDetails.entries

        if (selectedCategoryFilter !== 'all') {
            items = items.filter(
                (e) => e.category.toLowerCase() === selectedCategoryFilter.toLowerCase()
            )
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim()
            items = items.filter((e) => e.text.toLowerCase().includes(q) || e.category.includes(q))
        }

        return items
    }, [memoryDetails, selectedCategoryFilter, searchQuery])

    // Keep selected index in bounds
    useEffect(() => {
        if (selectedEntryIndex >= filteredEntries.length) {
            setSelectedEntryIndex(Math.max(0, filteredEntries.length - 1))
        }
    }, [filteredEntries.length, selectedEntryIndex])

    // Keep rule index in bounds
    useEffect(() => {
        if (selectedRuleIndex >= ruleFiles.length) {
            setSelectedRuleIndex(Math.max(0, ruleFiles.length - 1))
        }
    }, [ruleFiles.length, selectedRuleIndex])

    // Refresh active agent context if agent instance exists
    const refreshAgentSession = useCallback(() => {
        if (agent) {
            try {
                if (agent.conversation?.initSession) {
                    agent.conversation.initSession({
                        workspaceRoot: workspaceDir,
                        systemPrompt: agent.systemPrompt,
                    })
                }
            } catch {
                // Intentionally swallowed: background agent prompt re-sync fallback
            }
        }
    }, [agent, workspaceDir])

    // Action: Forget selected memory entry
    const handleForgetEntry = useCallback(async () => {
        const item = filteredEntries[selectedEntryIndex]
        if (!item) return

        try {
            const res = await forgetMemoryDirect(workspaceDir, item.text)
            if (res.success) {
                if (addToast) addToast('Removed entry from memory.', 'success')
                await loadMemory()
                refreshAgentSession()
            } else {
                if (addToast) addToast(res.message || 'Failed to remove entry.', 'error')
            }
        } catch (err: any) {
            if (addToast) addToast(`Error: ${err.message}`, 'error')
        }
    }, [
        filteredEntries,
        selectedEntryIndex,
        workspaceDir,
        addToast,
        loadMemory,
        refreshAgentSession,
    ])

    // Action: Submit new memory entry
    const handleAddSubmit = useCallback(async () => {
        const text = newEntryText.trim()
        if (!text) {
            setIsAddingEntry(false)
            setNewEntryText('')
            return
        }

        const category = MEMORY_CATEGORIES[newEntryCategoryIndex] || 'general'
        try {
            const res = await recordMemoryDirect(workspaceDir, text, category)
            if (res.success) {
                if (addToast) addToast(`Recorded under "${category}".`, 'success')
                setIsAddingEntry(false)
                setNewEntryText('')
                await loadMemory()
                refreshAgentSession()
            } else {
                if (addToast) addToast(res.message, 'warning')
            }
        } catch (err: any) {
            if (addToast) addToast(`Error: ${err.message}`, 'error')
        }
    }, [
        newEntryText,
        newEntryCategoryIndex,
        workspaceDir,
        addToast,
        loadMemory,
        refreshAgentSession,
    ])

    // Action: Clear all memory
    const handleClearAllMemory = useCallback(async () => {
        try {
            const res = await clearMemoryDirect(workspaceDir)
            if (res.success) {
                if (addToast) addToast('Cleared all workspace memory.', 'success')
                await loadMemory()
                refreshAgentSession()
            } else {
                if (addToast) addToast(res.message, 'info')
            }
        } catch (err: any) {
            if (addToast) addToast(`Error: ${err.message}`, 'error')
        } finally {
            setIsConfirmingClear(false)
        }
    }, [workspaceDir, addToast, loadMemory, refreshAgentSession])

    // Action: Scaffold AGENTS.md in workspace root
    const handleScaffoldAgentsMd = useCallback(async () => {
        const targetPath = path.join(workspaceDir, 'AGENTS.md')
        try {
            await fs.writeFile(targetPath, DEFAULT_AGENTS_MD_TEMPLATE, 'utf8')
            if (addToast) addToast('Created AGENTS.md at project root.', 'success')
            loadRules()
            refreshAgentSession()
        } catch (err: any) {
            if (addToast) addToast(`Failed to create AGENTS.md: ${err.message}`, 'error')
        }
    }, [workspaceDir, addToast, loadRules, refreshAgentSession])

    // Action: Open in editor
    const handleOpenFile = useCallback(
        (targetFilePath: string) => {
            if (handleSubmit) {
                handleSubmit(`/open ${targetFilePath}`)
            } else if (addToast) {
                addToast(`Open target: ${targetFilePath}`, 'info')
            }
        },
        [handleSubmit, addToast]
    )

    // Keyboard navigation
    useInput((input, key) => {
        // Esc: exit current sub-modal or close menu
        if (key.escape) {
            if (isAddingEntry) {
                setIsAddingEntry(false)
                setNewEntryText('')
                return
            }
            if (isConfirmingClear) {
                setIsConfirmingClear(false)
                return
            }
            if (isSearching) {
                setIsSearching(false)
                setSearchQuery('')
                return
            }
            handleClose()
            return
        }

        // Sub-modal: Confirm clear memory
        if (isConfirmingClear) {
            if (input === 'y' || input === 'Y') {
                handleClearAllMemory()
            } else if (input === 'n' || input === 'N') {
                setIsConfirmingClear(false)
            }
            return
        }

        // Sub-modal: Adding entry category cycle
        if (isAddingEntry) {
            if (key.tab) {
                setNewEntryCategoryIndex((prev) => (prev + 1) % MEMORY_CATEGORIES.length)
                return
            }
            if (key.return) {
                handleAddSubmit()
                return
            }
            return
        }

        // Tab: toggle active tab (Workspace Memory vs Rules)
        if (key.tab) {
            setActiveTab((prev) => (prev === 'memory' ? 'rules' : 'memory'))
            return
        }

        // Number keys 1 and 2 to switch tabs directly
        if (!isSearching) {
            if (input === '1') {
                setActiveTab('memory')
                return
            }
            if (input === '2') {
                setActiveTab('rules')
                return
            }
        }

        // Search toggle in memory tab
        if (activeTab === 'memory' && !isSearching && input === '/') {
            setIsSearching(true)
            return
        }

        // --- Memory Tab Navigation & Actions ---
        if (activeTab === 'memory') {
            if (key.upArrow || input === 'k') {
                setSelectedEntryIndex((prev) => Math.max(0, prev - 1))
                return
            }
            if (key.downArrow || input === 'j') {
                setSelectedEntryIndex((prev) => Math.min(filteredEntries.length - 1, prev + 1))
                return
            }

            // Category filter cycling (left/right arrows)
            if (key.leftArrow || key.rightArrow) {
                const cats = ['all', ...MEMORY_CATEGORIES]
                const currentIdx = cats.indexOf(selectedCategoryFilter)
                const nextIdx = key.rightArrow
                    ? (currentIdx + 1) % cats.length
                    : (currentIdx - 1 + cats.length) % cats.length
                setSelectedCategoryFilter(cats[nextIdx] || 'all')
                setSelectedEntryIndex(0)
                return
            }

            // [a]: Add new memory entry
            if (input === 'a' || input === 'A') {
                setIsAddingEntry(true)
                setNewEntryText('')
                return
            }

            // [d]: Delete / Forget selected entry
            if (input === 'd' || input === 'D') {
                handleForgetEntry()
                return
            }

            // [e]: Edit file in editor
            if (input === 'e' || input === 'E') {
                const fileToOpen =
                    memoryDetails?.targetFile || path.join(workspaceDir, '.december', 'memory.md')
                handleOpenFile(fileToOpen)
                return
            }

            // [x] or [C]: Clear all memory prompt
            if (input === 'x' || input === 'X' || input === 'C') {
                setIsConfirmingClear(true)
                return
            }

            // [r]: Reload memory from disk
            if (input === 'r' || input === 'R') {
                loadMemory()
                refreshAgentSession()
                if (addToast) addToast('Reloaded workspace memory from disk.', 'info')
                return
            }
        }

        // --- Rules Tab Navigation & Actions ---
        if (activeTab === 'rules') {
            if (key.upArrow || input === 'k') {
                if (key.shift || input === 'K') {
                    // Scroll rule content up
                    setRuleScrollOffset((prev) => Math.max(0, prev - 5))
                } else {
                    // Navigate files
                    setSelectedRuleIndex((prev) => Math.max(0, prev - 1))
                    setRuleScrollOffset(0)
                }
                return
            }
            if (key.downArrow || input === 'j') {
                if (key.shift || input === 'J') {
                    // Scroll rule content down
                    setRuleScrollOffset((prev) => prev + 5)
                } else {
                    // Navigate files
                    setSelectedRuleIndex((prev) => Math.min(ruleFiles.length - 1, prev + 1))
                    setRuleScrollOffset(0)
                }
                return
            }

            if (key.pageUp) {
                setRuleScrollOffset((prev) => Math.max(0, prev - 10))
                return
            }
            if (key.pageDown) {
                setRuleScrollOffset((prev) => prev + 10)
                return
            }

            // [c]: Scaffold starter AGENTS.md if none exists
            if (input === 'c' || input === 'C') {
                handleScaffoldAgentsMd()
                return
            }

            // [e]: Edit active rule file
            if (input === 'e' || input === 'E') {
                const currentRule = ruleFiles[selectedRuleIndex]
                const target = currentRule?.path || path.join(workspaceDir, 'AGENTS.md')
                handleOpenFile(target)
                return
            }

            // [r]: Reload rules and hot-refresh agent context
            if (input === 'r' || input === 'R') {
                loadRules()
                refreshAgentSession()
                if (addToast) addToast('Reloaded rules and updated agent context.', 'success')
                return
            }
        }
    })

    // Compute byte budget metrics
    const totalBytes = memoryDetails?.totalBytes || 0
    const maxBytes = memoryDetails?.maxBytes || MAX_WORKSPACE_MEMORY_BYTES
    const usagePct = Math.min(100, (totalBytes / maxBytes) * 100)
    const budgetGaugeWidth = 16
    const filledGauge = Math.round((usagePct / 100) * budgetGaugeWidth)
    const emptyGauge = Math.max(0, budgetGaugeWidth - filledGauge)
    const gaugeColor =
        usagePct >= 90
            ? THEME.colors.error
            : usagePct >= 75
              ? THEME.colors.warning
              : THEME.colors.brand

    // Active rule file content preview
    const activeRule = ruleFiles[selectedRuleIndex]
    const activeRuleLines = useMemo(() => {
        if (!activeRule) return []
        return activeRule.content.split('\n')
    }, [activeRule])

    const visibleRuleLineCount = Math.max(5, rows - 12)
    const displayedRuleLines = activeRuleLines.slice(
        ruleScrollOffset,
        ruleScrollOffset + visibleRuleLineCount
    )

    // Build footer hints based on state
    const footerItems: MenuFooterItem[] = useMemo(() => {
        if (isConfirmingClear) {
            return [
                { key: 'y', label: 'Confirm Clear' },
                { key: 'n', label: 'Cancel' },
                { key: 'Esc', label: 'Back' },
            ]
        }
        if (isAddingEntry) {
            return [
                { key: 'Tab', label: 'Cycle Category' },
                { key: 'Enter', label: 'Save Entry' },
                { key: 'Esc', label: 'Cancel' },
            ]
        }
        if (activeTab === 'memory') {
            return [
                { key: 'Tab', label: 'Rules' },
                { key: '↑/↓', label: 'Navigate' },
                { key: '←/→', label: 'Category' },
                { key: 'a', label: 'Add' },
                { key: 'd', label: 'Forget' },
                { key: 'e', label: 'Edit File' },
                { key: 'x', label: 'Clear' },
                { key: 'r', label: 'Reload' },
                { key: '/', label: 'Search' },
                { key: 'Esc', label: 'Close' },
            ]
        }
        return [
            { key: 'Tab', label: 'Memory' },
            { key: '↑/↓', label: 'Files' },
            { key: 'Shift+↑/↓', label: 'Scroll' },
            { key: 'c', label: 'Create AGENTS.md' },
            { key: 'e', label: 'Edit' },
            { key: 'r', label: 'Hot Reload' },
            { key: 'Esc', label: 'Close' },
        ]
    }, [isConfirmingClear, isAddingEntry, activeTab])

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={THEME.colors.brand}
            paddingX={1}
            width={Math.min(columns, 110)}
        >
            {/* Header: Title, Budget & Tabs */}
            <Box flexDirection="column" paddingBottom={1}>
                <Box justifyContent="space-between" width="100%">
                    <Box gap={1}>
                        <Text bold color={THEME.colors.brand}>
                            Agent Memory & Rules
                        </Text>
                        <Text color={THEME.colors.dim}>│</Text>
                        <Text color={THEME.colors.muted}>
                            {activeTab === 'memory' ? 'Workspace Memory' : 'Project Guidelines'}
                        </Text>
                    </Box>
                    <Box gap={1}>
                        <Text color={THEME.colors.muted}>Budget:</Text>
                        <Text color={gaugeColor} bold>
                            {totalBytes} / {maxBytes} B ({usagePct.toFixed(0)}%)
                        </Text>
                        <Text color={gaugeColor}>{'█'.repeat(filledGauge)}</Text>
                        <Text color={THEME.colors.dim}>{'░'.repeat(emptyGauge)}</Text>
                    </Box>
                </Box>

                {/* Tabs */}
                <Box gap={2} paddingTop={1}>
                    <Box
                        borderStyle={activeTab === 'memory' ? 'single' : undefined}
                        borderColor={THEME.colors.brand}
                        paddingX={1}
                    >
                        <Text
                            bold={activeTab === 'memory'}
                            color={activeTab === 'memory' ? THEME.colors.brand : THEME.colors.muted}
                        >
                            [1] Workspace Memory ({filteredEntries.length})
                        </Text>
                    </Box>
                    <Box
                        borderStyle={activeTab === 'rules' ? 'single' : undefined}
                        borderColor={THEME.colors.brand}
                        paddingX={1}
                    >
                        <Text
                            bold={activeTab === 'rules'}
                            color={activeTab === 'rules' ? THEME.colors.brand : THEME.colors.muted}
                        >
                            [2] Rules & Guidelines ({ruleFiles.length} file
                            {ruleFiles.length === 1 ? '' : 's'})
                        </Text>
                    </Box>
                </Box>
            </Box>

            {/* Sub-modal: Confirm Clear Memory */}
            {isConfirmingClear && (
                <Box
                    borderStyle="single"
                    borderColor={THEME.colors.error}
                    padding={1}
                    flexDirection="column"
                    marginY={1}
                >
                    <Text bold color={THEME.colors.error}>
                        Clear All Workspace Memory?
                    </Text>
                    <Text color={THEME.colors.text}>
                        This will erase all recorded memories from {memoryDetails?.targetFile}. This
                        action cannot be undone.
                    </Text>
                    <Box paddingTop={1} gap={2}>
                        <Text bold color={THEME.colors.error}>
                            [y] Confirm and Erase
                        </Text>
                        <Text color={THEME.colors.muted}>[n] Cancel</Text>
                    </Box>
                </Box>
            )}

            {/* Sub-modal: Add New Memory Entry */}
            {isAddingEntry && (
                <Box
                    borderStyle="single"
                    borderColor={THEME.colors.brand}
                    padding={1}
                    flexDirection="column"
                    marginY={1}
                >
                    <Text bold color={THEME.colors.brand}>
                        Record New Workspace Memory
                    </Text>
                    <Box gap={1} paddingTop={1}>
                        <Text color={THEME.colors.muted}>Category:</Text>
                        <Text bold color={THEME.colors.warning}>
                            [{MEMORY_CATEGORIES[newEntryCategoryIndex]}]
                        </Text>
                        <Text color={THEME.colors.dim}>(Press Tab to cycle category)</Text>
                    </Box>
                    <Box paddingTop={1}>
                        <Text color={THEME.colors.brand}>Entry: </Text>
                        <TextInput
                            value={newEntryText}
                            onChange={setNewEntryText}
                            placeholder="e.g. bun test requires test DB migration first"
                            focus={true}
                        />
                    </Box>
                </Box>
            )}

            {/* Search Bar for Memory Tab */}
            {activeTab === 'memory' && isSearching && !isAddingEntry && !isConfirmingClear && (
                <Box paddingY={1} gap={1}>
                    <Text color={THEME.colors.brand}>Search Memory: </Text>
                    <TextInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        placeholder="filter memories by keyword..."
                        focus={true}
                    />
                </Box>
            )}

            {/* TAB 1: WORKSPACE MEMORY */}
            {activeTab === 'memory' && !isAddingEntry && !isConfirmingClear && (
                <Box flexDirection="column" flexGrow={1} minHeight={8}>
                    {/* Category Filter Pills */}
                    <Box gap={1} paddingBottom={1}>
                        <Text color={THEME.colors.muted}>Filter:</Text>
                        {['all', ...MEMORY_CATEGORIES].map((cat) => {
                            const isSelected = selectedCategoryFilter === cat
                            return (
                                <Text
                                    key={cat}
                                    color={isSelected ? THEME.colors.brand : THEME.colors.dim}
                                    bold={isSelected}
                                >
                                    {isSelected ? `▶[${cat}]` : `[${cat}]`}
                                </Text>
                            )
                        })}
                    </Box>

                    {isMemoryLoading ? (
                        <Text color={THEME.colors.muted}>Loading workspace memory...</Text>
                    ) : filteredEntries.length === 0 ? (
                        <Box flexDirection="column" paddingY={2}>
                            <Text color={THEME.colors.muted}>
                                No memories recorded yet in this workspace.
                            </Text>
                            <Text color={THEME.colors.dim}>
                                Press [a] to record an entry, or December will automatically note
                                conventions as you pair program.
                            </Text>
                        </Box>
                    ) : (
                        <Box flexDirection={isNarrow ? 'column' : 'row'} gap={2}>
                            {/* Entry list */}
                            <Box flexDirection="column" width={isNarrow ? '100%' : '60%'}>
                                {filteredEntries.map((item, idx) => {
                                    const isSelected = idx === selectedEntryIndex
                                    return (
                                        <Box key={idx} gap={1}>
                                            <Text
                                                color={
                                                    isSelected
                                                        ? THEME.colors.brand
                                                        : THEME.colors.muted
                                                }
                                                bold={isSelected}
                                            >
                                                {isSelected ? '❭' : ' '} [{item.category}]
                                            </Text>
                                            <Text
                                                color={
                                                    isSelected
                                                        ? THEME.colors.text
                                                        : THEME.colors.muted
                                                }
                                                wrap="truncate"
                                            >
                                                {item.text}
                                            </Text>
                                        </Box>
                                    )
                                })}
                            </Box>

                            {/* Entry Detail Panel */}
                            {!isNarrow && (
                                <Box
                                    flexDirection="column"
                                    width="40%"
                                    borderStyle="single"
                                    borderColor={THEME.colors.border}
                                    padding={1}
                                >
                                    <Text bold color={THEME.colors.brand}>
                                        Entry Details
                                    </Text>
                                    {filteredEntries[selectedEntryIndex] ? (
                                        <Box flexDirection="column" paddingTop={1} gap={1}>
                                            <Box gap={1}>
                                                <Text color={THEME.colors.muted}>Category:</Text>
                                                <Text color={THEME.colors.warning}>
                                                    {filteredEntries[selectedEntryIndex]?.category}
                                                </Text>
                                            </Box>
                                            <Box gap={1}>
                                                <Text color={THEME.colors.muted}>Target:</Text>
                                                <Text color={THEME.colors.text}>
                                                    {path.basename(
                                                        filteredEntries[selectedEntryIndex]
                                                            ?.sourceFile || '.december/memory.md'
                                                    )}
                                                </Text>
                                            </Box>
                                            <Box flexDirection="column" paddingTop={1}>
                                                <Text color={THEME.colors.muted}>Content:</Text>
                                                <Text color={THEME.colors.text} wrap="wrap">
                                                    {filteredEntries[selectedEntryIndex]?.text}
                                                </Text>
                                            </Box>
                                        </Box>
                                    ) : (
                                        <Text color={THEME.colors.dim}>Select an entry</Text>
                                    )}
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            )}

            {/* TAB 2: RULES & GUIDELINES (AGENTS.md) */}
            {activeTab === 'rules' && (
                <Box flexDirection="column" flexGrow={1} minHeight={8}>
                    {isRulesLoading ? (
                        <Text color={THEME.colors.muted}>Scanning for project rules...</Text>
                    ) : ruleFiles.length === 0 ? (
                        <Box flexDirection="column" paddingY={2} gap={1}>
                            <Text color={THEME.colors.warning} bold>
                                No AGENTS.md or project rules found.
                            </Text>
                            <Text color={THEME.colors.muted}>
                                December loads instructions from AGENTS.md, CLAUDE.md, or
                                .december/rules.md to align with repository conventions.
                            </Text>
                            <Box paddingTop={1}>
                                <Text bold color={THEME.colors.brand}>
                                    Press [c] to create a starter AGENTS.md in the project root.
                                </Text>
                            </Box>
                        </Box>
                    ) : (
                        <Box flexDirection={isNarrow ? 'column' : 'row'} gap={2}>
                            {/* Rule file selector */}
                            <Box flexDirection="column" width={isNarrow ? '100%' : '35%'}>
                                <Box paddingBottom={1}>
                                    <Text color={THEME.colors.muted} bold>
                                        Discovered Rule Files ({ruleFiles.length}):
                                    </Text>
                                </Box>
                                {ruleFiles.map((rf, idx) => {
                                    const isSelected = idx === selectedRuleIndex
                                    const relPath = path.relative(workspaceDir, rf.path)
                                    const displayName = relPath.startsWith('..')
                                        ? path.basename(rf.path) + ' (parent)'
                                        : relPath || path.basename(rf.path)
                                    const isGlobal =
                                        rf.path.includes('.december') &&
                                        !rf.path.startsWith(workspaceDir)

                                    return (
                                        <Box key={rf.path} gap={1}>
                                            <Text
                                                color={
                                                    isSelected
                                                        ? THEME.colors.brand
                                                        : THEME.colors.muted
                                                }
                                                bold={isSelected}
                                            >
                                                {isSelected ? '❭' : ' '} {displayName}
                                            </Text>
                                            {isGlobal && (
                                                <Text color={THEME.colors.dim}>[global]</Text>
                                            )}
                                        </Box>
                                    )
                                })}
                            </Box>

                            {/* Rule File Content Viewer */}
                            <Box
                                flexDirection="column"
                                width={isNarrow ? '100%' : '65%'}
                                borderStyle="single"
                                borderColor={THEME.colors.border}
                                padding={1}
                            >
                                <Box justifyContent="space-between" paddingBottom={1}>
                                    <Text bold color={THEME.colors.brand}>
                                        {activeRule
                                            ? path.basename(activeRule.path)
                                            : 'No Rule Selected'}
                                    </Text>
                                    {activeRuleLines.length > visibleRuleLineCount && (
                                        <Text color={THEME.colors.dim}>
                                            Lines {ruleScrollOffset + 1}-
                                            {Math.min(
                                                ruleScrollOffset + visibleRuleLineCount,
                                                activeRuleLines.length
                                            )}{' '}
                                            of {activeRuleLines.length} (Shift+↑/↓ to scroll)
                                        </Text>
                                    )}
                                </Box>

                                {displayedRuleLines.length > 0 ? (
                                    displayedRuleLines.map((line, lIdx) => (
                                        <Text key={lIdx} color={THEME.colors.text} wrap="truncate">
                                            {line || ' '}
                                        </Text>
                                    ))
                                ) : (
                                    <Text color={THEME.colors.dim}>Empty file</Text>
                                )}
                            </Box>
                        </Box>
                    )}
                </Box>
            )}

            {/* Footer with key hints */}
            <MenuFooter items={footerItems} />
        </Box>
    )
}
