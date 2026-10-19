import { Box, Text, useInput } from 'ink'
import React, { useMemo, useState } from 'react'

import { THEME } from '../../theme'
import { getAllAvailableCommands } from '../command-menu/filter-commands'
import { formatBillingLabel, formatModelDisplayName, getCwd, getGitBranch } from '../header'

import { MenuFooter } from './menu-footer'
import { SHORTCUTS } from './shortcuts-menu'

const TABS = ['general', 'commands', 'shortcuts'] as const
export type HelpTab = (typeof TABS)[number]

const CMD_COL_WIDTH = 32
const SHORTCUT_COL_WIDTH = 34
const WINDOW_SIZE = 7

export interface HelpMenuProps {
    onClose?: () => void
    setAuthMode?: (mode: string) => void
    initialTab?: HelpTab
    helpInitialTab?: HelpTab
    cliVersion?: string
    userEmail?: string
    currentEmail?: string
    decemberEmail?: string
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    activeProvider?: string
    workspaceRoot?: string
    configPath?: string
    sessionId?: string
    agent?: any
    onSelectCommand?: (command: string) => void
    handleSubmit?: (text: string) => void
}

export function HelpMenu(props: HelpMenuProps) {
    const {
        onClose,
        setAuthMode,
        initialTab,
        helpInitialTab,
        cliVersion = '0.1.0',
        userEmail,
        currentEmail,
        decemberEmail,
        activeModel = 'gemini-3.7-flash',
        modelLabel,
        authMethod,
        selectedProvider,
        activeProvider,
        workspaceRoot,
        configPath = '~/.december/config.json',
        sessionId,
        agent,
        onSelectCommand,
        handleSubmit,
    } = props

    const startingTab: HelpTab = initialTab || helpInitialTab || 'general'
    const [tab, setTab] = useState<HelpTab>(startingTab)

    // Commands tab pagination & selection state
    const [cmdIndex, setCmdIndex] = useState(0)
    const [cmdWindowStart, setCmdWindowStart] = useState(0)

    // Shortcuts tab pagination & selection state
    const [shortcutIndex, setShortcutIndex] = useState(0)
    const [shortcutWindowStart, setShortcutWindowStart] = useState(0)

    const cwd = workspaceRoot || getCwd()
    const branch = useMemo(() => getGitBranch(cwd), [cwd])

    const commands = useMemo(() => {
        try {
            return getAllAvailableCommands(cwd)
        } catch {
            // Intentionally swallowed: fallback to empty command list
            return []
        }
    }, [cwd])

    const resolvedEmail = userEmail || currentEmail || decemberEmail
    const provider = selectedProvider || activeProvider || ''
    const billing = formatBillingLabel(
        authMethod,
        provider,
        activeModel,
        Boolean(resolvedEmail || authMethod)
    )
    const resolvedModelName = modelLabel || formatModelDisplayName(activeModel) || activeModel

    const accountLine = resolvedEmail ? `${resolvedEmail} (${billing})` : `Guest (${billing})`
    const activeSessionId = sessionId || agent?.sessionId || 'Active'

    const handleClose = () => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }

    useInput((input, key) => {
        // Exit
        if (key.escape || input === '\u001B' || input === '\x1B' || (key.ctrl && input === 'c')) {
            handleClose()
            return
        }

        // Tab navigation: left / right / Tab / Shift+Tab
        const isShiftTab = key.shift && (key.tab || input === '\t')
        const isTab = !key.shift && (key.tab || input === '\t')
        const isRight = key.rightArrow || input === '\u001B[C' || input === '\x1b[C' || isTab
        const isLeft = key.leftArrow || input === '\u001B[D' || input === '\x1b[D' || isShiftTab

        if (isLeft) {
            setTab((prev) => {
                const idx = TABS.indexOf(prev)
                const nextIdx = (idx - 1 + TABS.length) % TABS.length
                return TABS[nextIdx]!
            })
            return
        }

        if (isRight) {
            setTab((prev) => {
                const idx = TABS.indexOf(prev)
                const nextIdx = (idx + 1) % TABS.length
                return TABS[nextIdx]!
            })
            return
        }

        // Mouse wheel detection
        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (tab === 'commands') {
            if (key.upArrow || input === 'k' || isWheelUp) {
                setCmdIndex((prev) => {
                    const count = isWheelUp
                        ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                        : 1
                    const next = Math.max(0, prev - count)
                    if (next < cmdWindowStart) setCmdWindowStart(next)
                    return next
                })
                return
            }

            if (key.downArrow || input === 'j' || isWheelDown) {
                setCmdIndex((prev) => {
                    const count = isWheelDown
                        ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                        : 1
                    const next = Math.min(Math.max(0, commands.length - 1), prev + count)
                    if (next >= cmdWindowStart + WINDOW_SIZE) {
                        setCmdWindowStart(next - WINDOW_SIZE + 1)
                    }
                    return next
                })
                return
            }
        }

        if (tab === 'shortcuts') {
            if (key.upArrow || input === 'k' || isWheelUp) {
                setShortcutIndex((prev) => {
                    const count = isWheelUp
                        ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                        : 1
                    const next = Math.max(0, prev - count)
                    if (next < shortcutWindowStart) setShortcutWindowStart(next)
                    return next
                })
                return
            }

            if (key.downArrow || input === 'j' || isWheelDown) {
                setShortcutIndex((prev) => {
                    const count = isWheelDown
                        ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                        : 1
                    const next = Math.min(Math.max(0, SHORTCUTS.length - 1), prev + count)
                    if (next >= shortcutWindowStart + WINDOW_SIZE) {
                        setShortcutWindowStart(next - WINDOW_SIZE + 1)
                    }
                    return next
                })
                return
            }
        }
    })

    // Commands windowing
    const cmdWindowEnd = Math.min(cmdWindowStart + WINDOW_SIZE, commands.length)
    const visibleCmds = commands.slice(cmdWindowStart, cmdWindowEnd)
    const cmdItemsAbove = cmdWindowStart
    const cmdItemsBelow = commands.length - cmdWindowEnd
    const cmdHasOverflow = commands.length > WINDOW_SIZE

    let cmdStatusText = ''
    if (cmdHasOverflow) {
        if (cmdItemsAbove > 0 && cmdItemsBelow > 0) {
            cmdStatusText = `↑ ${cmdItemsAbove} more · ↓ ${cmdItemsBelow} more`
        } else if (cmdItemsAbove > 0) {
            cmdStatusText = `↑ ${cmdItemsAbove} more`
        } else if (cmdItemsBelow > 0) {
            cmdStatusText = `↓ ${cmdItemsBelow} more`
        }
    }

    // Shortcuts windowing
    const shortcutWindowEnd = Math.min(shortcutWindowStart + WINDOW_SIZE, SHORTCUTS.length)
    const visibleShortcuts = SHORTCUTS.slice(shortcutWindowStart, shortcutWindowEnd)
    const shortcutItemsAbove = shortcutWindowStart
    const shortcutItemsBelow = SHORTCUTS.length - shortcutWindowEnd
    const shortcutHasOverflow = SHORTCUTS.length > WINDOW_SIZE

    let shortcutStatusText = ''
    if (shortcutHasOverflow) {
        if (shortcutItemsAbove > 0 && shortcutItemsBelow > 0) {
            shortcutStatusText = `↑ ${shortcutItemsAbove} more · ↓ ${shortcutItemsBelow} more`
        } else if (shortcutItemsAbove > 0) {
            shortcutStatusText = `↑ ${shortcutItemsAbove} more`
        } else if (shortcutItemsBelow > 0) {
            shortcutStatusText = `↓ ${shortcutItemsBelow} more`
        }
    }

    const infoRows = [
        { label: 'Version', value: `v${cliVersion.replace(/^v/, '')}` },
        { label: 'Account', value: accountLine },
        { label: 'Active Model', value: resolvedModelName },
        { label: 'Workspace', value: `${cwd}${branch ? ` (${branch})` : ''}` },
        { label: 'Project Config', value: configPath },
        { label: 'Session', value: activeSessionId },
    ]

    return (
        <Box flexDirection="column">
            {/* Top Navigation Bar */}
            <Box flexDirection="row" gap={2} marginBottom={1}>
                <Box gap={1}>
                    {TABS.map((t) => {
                        const isCurrent = t === tab
                        return (
                            <Text
                                key={t}
                                color={isCurrent ? THEME.colors.brand : THEME.colors.muted}
                                bold={isCurrent}
                            >
                                {isCurrent ? `[${t}]` : ` ${t} `}
                            </Text>
                        )
                    })}
                </Box>

                <Text color={THEME.colors.subtle}>(←/→ or tab to cycle)</Text>
            </Box>

            {/* Tab Body */}
            <Box flexDirection="column">
                {tab === 'general' && (
                    <Box flexDirection="column" gap={1}>
                        <Box flexDirection="column">
                            <Text color={THEME.colors.text} wrap="wrap">
                                December is a (so much) better coding agent. It helps you build
                                faster by writing code, fixing bugs, and running commands directly
                                in your terminal or alongside your favorite IDE.
                            </Text>
                        </Box>

                        <Box flexDirection="column" marginTop={0}>
                            {infoRows.map((row) => (
                                <Box key={row.label} flexDirection="row">
                                    <Box width={16}>
                                        <Text color={THEME.colors.muted}>{row.label}:</Text>
                                    </Box>
                                    <Text color={THEME.colors.text}>{row.value}</Text>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {tab === 'commands' && (
                    <Box flexDirection="column">
                        <Box marginBottom={0}>
                            <Text bold color={THEME.colors.text}>
                                Available Commands
                            </Text>
                        </Box>

                        {visibleCmds.map((cmd, relIdx) => {
                            const absIdx = cmdWindowStart + relIdx
                            const isSelected = absIdx === cmdIndex
                            return (
                                <Box key={cmd.name} flexDirection="row">
                                    <Box width={2}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.muted
                                            }
                                        >
                                            {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                        </Text>
                                    </Box>
                                    <Box width={CMD_COL_WIDTH} flexShrink={0} marginRight={2}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.muted
                                            }
                                            bold={false}
                                            wrap="truncate-end"
                                        >
                                            /{cmd.name}
                                        </Text>
                                    </Box>
                                    <Box flexShrink={1}>
                                        <Text color={THEME.colors.muted} wrap="truncate-end">
                                            {cmd.description}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}

                        {cmdHasOverflow && cmdStatusText && (
                            <Box paddingLeft={2}>
                                <Text color={THEME.colors.muted}>{cmdStatusText}</Text>
                            </Box>
                        )}
                    </Box>
                )}

                {tab === 'shortcuts' && (
                    <Box flexDirection="column">
                        <Box marginBottom={0}>
                            <Text bold color={THEME.colors.text}>
                                Keyboard Shortcuts
                            </Text>
                        </Box>

                        {visibleShortcuts.map((cmd, relIdx) => {
                            const absIdx = shortcutWindowStart + relIdx
                            const isSelected = absIdx === shortcutIndex
                            return (
                                <Box key={cmd.key} flexDirection="row">
                                    <Box width={2}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.muted
                                            }
                                        >
                                            {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                        </Text>
                                    </Box>
                                    <Box width={SHORTCUT_COL_WIDTH} flexShrink={0} marginRight={2}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.muted
                                            }
                                            bold={false}
                                            wrap="truncate-end"
                                        >
                                            {cmd.key}
                                        </Text>
                                    </Box>
                                    <Box flexShrink={1}>
                                        <Text color={THEME.colors.muted} wrap="truncate-end">
                                            {cmd.desc}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}

                        {shortcutHasOverflow && shortcutStatusText && (
                            <Box paddingLeft={2}>
                                <Text color={THEME.colors.muted}>{shortcutStatusText}</Text>
                            </Box>
                        )}
                    </Box>
                )}
            </Box>

            {/* Footer */}
            <MenuFooter
                items={[
                    ...(tab === 'general' ? [] : [{ key: '↑/↓', label: 'Navigate' }]),
                    { key: '←/→', label: 'Switch View' },
                    { key: 'esc', label: 'Close' },
                ]}
            />
        </Box>
    )
}
