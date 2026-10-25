import { getModelContextWindow } from '@december/providers'
import { getWorkspaceIgnores } from '@december/shared'
import fg from 'fast-glob'
import { Box, Text, useInput } from 'ink'
import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react'

import { useTerminalColumns } from '../hooks/use-terminal-columns'
import { useToast } from '../providers/toast'
import { THEME } from '../theme'
import { fetchGitStatusFiles } from '../utils/diff'
import { expandPastes } from '../utils/paste-manager'
import { defaultPromptHistory } from '../utils/prompt-history'

import { CommandMenu } from './command-menu'
import { useCommandMenu } from './command-menu/use-command-menu'
import { FileMenu } from './file-menu'
import { useFileMenu } from './file-menu/use-file-menu'
import { BtwOverlay } from './menus/btw-overlay'
import { HelpMenu } from './menus/help-menu'
import { TextArea } from './text-area'

import type { BtwState } from '../types'
import type { Command } from './command-menu/types'
import type { TaskItem } from './menus/tasks-mode-menu'

type Props = {
    onSubmit: (text: string, options?: { returnQuery?: string }) => void
    disabled?: boolean
    placeholder?: string
    activeModel?: string
    modelLabel?: string
    authMethod?: 'byok' | 'december' | 'env' | 'subscription'
    isAuthenticated?: boolean
    tasks?: TaskItem[]
    hasBothAuth?: boolean
    authUI?: React.ReactNode
    agent?: any
    resetChat?: () => void
    onUpdateSuccess?: () => Promise<void>
    planMode?: boolean
    grillMode?: boolean
    planRefineMode?: boolean
    customInputMode?: boolean
    planWorkflowPhase?: 'idle' | 'grilling' | 'reviewing' | 'refining' | 'executing'
    interactivePlanGoalMode?: boolean
    workflowUI?: React.ReactNode
    onInterrupt?: () => void
    onCopy?: () => void
    contextTokens?: number
    showExitConfirm?: boolean
    toasts?: { id: string; message: string; variant?: string }[]
    queuedPrompts?: string[]
    mcpServersCount?: number
    onScrollUp?: (delta?: number) => void
    onScrollDown?: (delta?: number) => void
    onStartVoice?: (callbacks: {
        onTranscript: (text: string, isFinal: boolean) => void
        onError: (err: Error) => void
    }) => Promise<{ stop: () => Promise<string>; cancel: () => void } | null>
    onExit?: () => void
    btwState?: BtwState | null
    onDismissBtw?: () => void
    cliVersion?: string
    userEmail?: string
    selectedProvider?: string
    prefillPrompt?: string | null
    onClearPrefillPrompt?: () => void
}

function formatTokenCount(n: number): string {
    if (n >= 1_000_000) {
        const val = n / 1_000_000
        return `${Number.isInteger(val) ? val : val.toFixed(1).replace(/\.0$/, '')}M`
    }
    if (n >= 1_000) {
        const val = n / 1_000
        return `${Number.isInteger(val) ? val : val.toFixed(1).replace(/\.0$/, '')}k`
    }
    return n.toString()
}

export const InputBar = React.memo(function InputBar({
    onSubmit,
    disabled = false,
    placeholder = 'Ask December to build features, fix bugs, or work on your code...',
    activeModel = 'unknown',
    modelLabel,
    authMethod,
    isAuthenticated = true,
    hasBothAuth = false,
    authUI,
    workflowUI,
    agent,
    resetChat,
    onUpdateSuccess,
    planMode = false,
    grillMode = false,
    planRefineMode = false,
    customInputMode = false,
    planWorkflowPhase,
    interactivePlanGoalMode = false,
    onInterrupt,
    onCopy,
    contextTokens,
    showExitConfirm = false,
    toasts,
    queuedPrompts,
    tasks,
    mcpServersCount,
    onScrollUp,
    onScrollDown,
    onStartVoice,
    onExit,
    btwState,
    onDismissBtw,
    cliVersion,
    userEmail,
    selectedProvider,
    prefillPrompt,
    onClearPrefillPrompt,
}: Props) {
    const [value, setValue] = useState('')
    const [isVoiceActive, setIsVoiceActive] = useState(false)
    const [isTranscribing, setIsTranscribing] = useState(false)
    const voiceSessionRef = useRef<{
        stop: () => Promise<string>
        cancel: () => void
    } | null>(null)
    const toast = useToast()
    const columns = useTerminalColumns()

    const [recentFiles, setRecentFiles] = useState<Set<string>>(() => new Set())
    const [allWorkspaceFiles, setAllWorkspaceFiles] = useState<string[]>([])

    useEffect(() => {
        if (prefillPrompt) {
            setValue(prefillPrompt)
            handleContentChangeRef.current(prefillPrompt)
            if (onClearPrefillPrompt) {
                onClearPrefillPrompt()
            }
        }
    }, [prefillPrompt, onClearPrefillPrompt])

    const activeToast =
        toasts && toasts.length > 0
            ? toasts[toasts.length - 1]
            : toast.currentToast
              ? { message: toast.currentToast.message, variant: toast.currentToast.variant }
              : null

    const handleContentChangeRef = useRef<(text: string) => void>(() => {})

    const handleStopVoice = useCallback(
        async (sendPrompt = false) => {
            const session = voiceSessionRef.current
            if (!session) {
                setIsVoiceActive(false)
                setIsTranscribing(false)
                return
            }

            voiceSessionRef.current = null
            setIsVoiceActive(false)

            if (sendPrompt) {
                setIsTranscribing(true)
                try {
                    const finalTranscript = await session.stop()
                    const promptToSend = (finalTranscript || value).trim()
                    setValue('')
                    handleContentChangeRef.current('')
                    if (promptToSend) {
                        onSubmit(promptToSend)
                    }
                } finally {
                    setIsTranscribing(false)
                }
            } else {
                session.cancel()
                setValue('')
                handleContentChangeRef.current('')
                setIsTranscribing(false)
            }
        },
        [onSubmit, value]
    )

    const handleStartVoice = useCallback(async () => {
        if (!onStartVoice) {
            onSubmit('/voice')
            return
        }

        setIsVoiceActive(true)
        setValue('')
        handleContentChangeRef.current('')
        setIsTranscribing(false)

        try {
            const session = await onStartVoice({
                onTranscript: (text) => {
                    setValue(text)
                    handleContentChangeRef.current(text)
                },
                onError: (err) => {
                    setIsVoiceActive(false)
                    setIsTranscribing(false)
                    voiceSessionRef.current = null
                    toast.show({
                        variant: 'error',
                        message: err.message || 'Voice dictation error.',
                    })
                },
            })

            if (!session) {
                setIsVoiceActive(false)
                setIsTranscribing(false)
                return
            }

            voiceSessionRef.current = session
        } catch {
            setIsVoiceActive(false)
            setIsTranscribing(false)
        }
    }, [onStartVoice, onSubmit, toast])

    const handleAutocompleteCommand = useCallback((completedText: string) => {
        setValue(completedText)
        handleContentChangeRef.current(completedText)
    }, [])

    const handleAutocompleteFile = useCallback((completedText: string) => {
        setValue(completedText)
        handleContentChangeRef.current(completedText)
    }, [])

    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        windowStart,
        handleContentChange: handleCommandContentChange,
        resolveCommand,
        setSelectedIndex,
    } = useCommandMenu({ onAutocomplete: handleAutocompleteCommand })

    const [showShortcutsMenu, setShowShortcutsMenu] = useState(false)

    const fileMenu = useFileMenu({
        workspaceFiles: allWorkspaceFiles,
        recentFiles,
        onAutocomplete: handleAutocompleteFile,
        disabled: disabled || showCommandMenu || showShortcutsMenu,
    })

    const handleContentChange = useCallback(
        (text: string) => {
            handleCommandContentChange(text)
            fileMenu.handleContentChange(text)
        },
        [handleCommandContentChange, fileMenu.handleContentChange]
    )

    handleContentChangeRef.current = handleContentChange

    // Check for @filename mention query or /open file query
    const hasFileTrigger = Boolean(value.match(/@(\S*)$/) || value.match(/^\/open\s+(\S*)$/))

    // Load workspace files and git status lazily and asynchronously ONLY when user types @ or /open
    useEffect(() => {
        if (!hasFileTrigger || allWorkspaceFiles.length > 0) return

        let isMounted = true
        try {
            const ignores = getWorkspaceIgnores()
            fg(['**/*'], {
                dot: true,
                ignore: ignores,
                onlyFiles: true,
                suppressErrors: true,
            })
                .then((files) => {
                    if (isMounted) {
                        setAllWorkspaceFiles(files)
                    }
                })
                .catch(() => {
                    // Intentionally swallowed: fallback to empty workspace files on error
                    if (isMounted) {
                        setAllWorkspaceFiles([])
                    }
                })

            fetchGitStatusFiles()
                .then((diffEntries) => {
                    if (isMounted && diffEntries.length > 0) {
                        setRecentFiles(new Set(diffEntries.map((e) => e.path)))
                    }
                })
                .catch(() => {
                    // Intentionally swallowed: fallback to empty recent files on error
                })
        } catch {
            // Intentionally swallowed: ignore file listing errors
            setAllWorkspaceFiles([])
        }

        return () => {
            isMounted = false
        }
    }, [hasFileTrigger, allWorkspaceFiles.length])

    const maxTokens = useMemo(
        () => getModelContextWindow(activeModel || 'gemini-3.7-flash') || 1_000_000,
        [activeModel]
    )
    const tokens = contextTokens ?? 0
    const contextPct = maxTokens > 0 ? Math.round((tokens / maxTokens) * 100) : 0
    const contextLabel = `${formatTokenCount(tokens)} / ${formatTokenCount(maxTokens)} (${contextPct}%)`
    const contextColor =
        contextPct >= 90
            ? THEME.colors.error
            : contextPct >= 70
              ? THEME.colors.warning
              : THEME.colors.muted

    const runningTasksCount = tasks ? tasks.filter((t) => t.status === 'running').length : 0
    const totalTasksCount = tasks ? tasks.length : 0
    const connectedMcpServers = agent?.mcpClientManager?.getConnectedServers?.() || []
    const mcpCount = mcpServersCount ?? connectedMcpServers.length

    const stateRef = useRef({
        value,
        handleContentChange,
        grillMode,
        onSubmit,
        onCopy,
        isVoiceActive,
        isTranscribing,
        handleStopVoice,
    })
    stateRef.current = {
        value,
        handleContentChange,
        grillMode,
        onSubmit,
        onCopy,
        isVoiceActive,
        isTranscribing,
        handleStopVoice,
    }

    const isCtrlW = useRef(false)
    useInput(
        (input, key) => {
            if (disabled) return

            const state = stateRef.current
            if (key.escape) {
                if (btwState && onDismissBtw) {
                    onDismissBtw()
                    return
                }
                if (state.isVoiceActive || state.isTranscribing || voiceSessionRef.current) {
                    state.handleStopVoice(false)
                    return
                }
                if (fileMenu.showFileMenu) {
                    fileMenu.close()
                    return
                }
                if (state.value.length > 0) {
                    setValue('')
                    state.handleContentChange('')
                    return
                }
            }

            if (key.ctrl && input === 'w') {
                isCtrlW.current = true
                setValue((prev) => {
                    const match = prev.match(/(\s*\S+\s*)$/)
                    const next = match ? prev.slice(0, -match[0].length) : prev
                    state.handleContentChange(next)
                    return next
                })
            }
            if ((key.backspace || key.delete) && state.value.length === 0 && state.grillMode) {
                state.onSubmit('/grill-me')
            }
            if (key.ctrl && input === 'y') {
                if (state.onCopy) state.onCopy()
                return
            }
        },
        { isActive: !disabled }
    )

    const handleChange = useCallback(
        (newValue: string) => {
            if (disabled) return
            if (isCtrlW.current) {
                isCtrlW.current = false
                return
            }
            if (newValue === '?') {
                setShowShortcutsMenu(true)
                setValue('?')
                return
            } else if (showShortcutsMenu) {
                setShowShortcutsMenu(false)
            }
            setValue(newValue)
            handleContentChange(newValue)
        },
        [disabled, handleContentChange, showShortcutsMenu]
    )

    const handleHistoryUp = useCallback(() => {
        const prev = defaultPromptHistory.getPrevious(value)
        if (prev !== value) {
            setValue(prev)
            handleContentChange(prev)
        }
    }, [value, handleContentChange])

    const handleHistoryDown = useCallback(() => {
        const next = defaultPromptHistory.getNext()
        if (next !== value) {
            setValue(next)
            handleContentChange(next)
        }
    }, [value, handleContentChange])

    const handleCommand = useCallback(
        (command: Command | undefined) => {
            if (!command) return

            const currentValue = value.trim()
            const isExactMatch =
                currentValue.toLowerCase() === command.value.toLowerCase() ||
                currentValue.toLowerCase() === `/${command.name.toLowerCase()}`

            const hasArguments =
                currentValue.length > command.value.length &&
                currentValue.toLowerCase().startsWith(command.value.toLowerCase() + ' ')

            // If the user typed only a partial prefix and selected the command from the menu,
            // autofill the command name with a trailing space on first Enter so they can type extra prompt arguments.
            if (!isExactMatch && !hasArguments) {
                const autofillValue = `${command.value} `
                setValue(autofillValue)
                handleContentChange(autofillValue)
                return
            }

            setValue('')
            handleContentChange('')

            // Forward chat & session commands and custom commands to chat component
            const forwardCommands = [
                '/grill',
                '/grill-me',
                '/login',
                '/exit',
                '/model',
                '/plan',
                '/resume',
                '/settings',
                '/switch',
                '/skills',
                '/skill',
                '/memory',
                '/rules',
                '/context',
                '/tasks',
                '/usage',
                '/feedback',
                '/update',
                '/new',
                '/clear',
                '/fork',
                '/copy',
                '/help',
                '/shortcuts',
                '/docs',
                '/changelog',
                '/diff',
                '/open',
                '/codesearch',
                '/effort',
            ]

            if (command.value === '/voice') {
                setValue('')
                handleContentChange('')
                handleStartVoice()
                return
            }

            if (forwardCommands.includes(command.value) || !command.action) {
                if (hasArguments) {
                    onSubmit(currentValue)
                } else {
                    onSubmit(command.value)
                }
                return
            }

            if (command.action) {
                command.action({
                    exit: () => {
                        if (onExit) {
                            onExit()
                        } else {
                            process.exit(0)
                        }
                    },
                    toast,
                    agent,
                    resetChat,
                    onUpdateSuccess,
                })
            }
        },
        [
            onExit,
            toast,
            agent,
            resetChat,
            onUpdateSuccess,
            handleContentChange,
            onSubmit,
            value,
            handleStartVoice,
        ]
    )

    const handleSubmit = useCallback(
        async (text: string) => {
            if (disabled) return
            if (isVoiceActive || isTranscribing) {
                await handleStopVoice(true)
                return
            }
            if (showCommandMenu) {
                const command = resolveCommand(selectedIndex)
                handleCommand(command)
                return
            }
            if (showShortcutsMenu) {
                return
            }
            if (fileMenu.showFileMenu && fileMenu.filteredFiles.length > 0) {
                const isOpenCommand = /^\/open\s+/.test(value)
                const completedText = fileMenu.autocompleteSelected(value)
                if (completedText) {
                    if (isOpenCommand) {
                        const previousQuery = value
                        setValue('')
                        handleContentChange('')
                        onSubmit(completedText.trim(), { returnQuery: previousQuery })
                        return
                    }
                    setValue(completedText)
                    handleContentChange(completedText)
                }
                return
            }
            const rawTrimmed = text.trim()
            if (rawTrimmed.length === 0) return

            if (rawTrimmed === '/voice') {
                setValue('')
                handleContentChange('')
                handleStartVoice()
                return
            }

            const trimmed = expandPastes(rawTrimmed)
            defaultPromptHistory.append(trimmed)
            defaultPromptHistory.resetCursor()
            setValue('')
            handleContentChange('')

            // Forward slash commands and shell escapes directly without @ context expansion
            if (trimmed.startsWith('/') || trimmed.startsWith('!')) {
                onSubmit(trimmed)
                return
            }

            // Expand @ file mentions into rich context blocks
            try {
                const { resolveContextMentions } = await import('@december/shared')
                const resolved = await resolveContextMentions(trimmed)
                onSubmit(resolved.expandedPrompt)
            } catch {
                // Intentionally swallowed: fallback to unexpanded text on resolution error
                onSubmit(trimmed)
            }
        },
        [
            disabled,
            showCommandMenu,
            showShortcutsMenu,
            fileMenu,
            value,
            resolveCommand,
            selectedIndex,
            handleCommand,
            onSubmit,
            handleContentChange,
            handleStartVoice,
            handleStopVoice,
            isTranscribing,
            isVoiceActive,
        ]
    )

    const paddingLeft = THEME.padding.paddingLeft ?? THEME.padding.paddingX
    const paddingRight = THEME.padding.paddingRight ?? 4
    const sepWidth = Math.max(10, columns - paddingLeft - paddingRight)
    const sep = '─'.repeat(sepWidth)

    const isOverlayActive = Boolean(authUI || workflowUI) && !customInputMode

    const activeModeTag =
        planWorkflowPhase === 'grilling' || grillMode
            ? '[GRILL]'
            : planWorkflowPhase === 'executing'
              ? '[EXEC]'
              : planWorkflowPhase === 'reviewing' ||
                  planWorkflowPhase === 'refining' ||
                  planRefineMode ||
                  planMode ||
                  interactivePlanGoalMode
                ? '[PLAN]'
                : null

    return (
        <Box
            flexDirection="column"
            paddingLeft={paddingLeft}
            paddingRight={paddingRight}
            marginTop={1}
        >
            {/* queued prompts indicator */}
            {queuedPrompts && queuedPrompts.length > 0 && (
                <Box width="100%" marginBottom={0}>
                    <Text color={THEME.colors.brand}>
                        {`Queued (${queuedPrompts.length}): "${queuedPrompts[0]}"`}
                        {queuedPrompts.length > 1 ? ` (+${queuedPrompts.length - 1} more)` : ''}
                    </Text>
                </Box>
            )}

            {/* file mention dropdown */}
            {fileMenu.showFileMenu && (
                <Box marginBottom={0}>
                    <FileMenu
                        files={fileMenu.filteredFiles}
                        selectedIndex={fileMenu.selectedIndex}
                        windowStart={fileMenu.windowStart}
                    />
                </Box>
            )}

            {/* auth ui & workflow ui */}
            {(workflowUI || authUI) && <Box paddingBottom={1}>{workflowUI || authUI}</Box>}

            {/* command dropdown */}
            {showCommandMenu && (
                <Box>
                    <CommandMenu
                        query={commandQuery}
                        selectedIndex={selectedIndex}
                        windowStart={windowStart}
                        totalFiltered={0}
                        onSelect={setSelectedIndex}
                        onExecute={(index) => {
                            const command = resolveCommand(index)
                            handleCommand(command)
                        }}
                    />
                </Box>
            )}

            {/* shortcuts dropdown */}
            {showShortcutsMenu && (
                <Box>
                    <HelpMenu
                        initialTab="shortcuts"
                        onClose={() => {
                            setShowShortcutsMenu(false)
                            setValue('')
                        }}
                        onSelectCommand={(cmd) => {
                            setShowShortcutsMenu(false)
                            setValue('')
                            handleSubmit(cmd)
                        }}
                        cliVersion={cliVersion}
                        userEmail={userEmail}
                        activeModel={activeModel}
                        modelLabel={modelLabel}
                        authMethod={authMethod}
                        selectedProvider={selectedProvider}
                        agent={agent}
                    />
                </Box>
            )}

            {/* btw overlay */}
            {btwState && (
                <Box marginBottom={1}>
                    <BtwOverlay
                        {...btwState}
                        onClose={onDismissBtw || (() => {})}
                        onCopy={() => {
                            toast.show({
                                variant: 'success',
                                message: 'Copied answer to clipboard.',
                            })
                        }}
                    />
                </Box>
            )}

            {!isOverlayActive && (
                <>
                    {/* top separator */}
                    <Box overflow="hidden" height={1} width="100%">
                        <Text color={THEME.colors.border} wrap="truncate">
                            {sep}
                        </Text>
                    </Box>

                    {/* content: prompt */}
                    <Box width="100%" flexDirection="row">
                        <Box flexShrink={0}>
                            <Text
                                color={disabled ? THEME.colors.muted : THEME.colors.brand}
                            >{`${THEME.glyphs.prompt} `}</Text>
                        </Box>
                        {grillMode && (
                            <Box flexShrink={0}>
                                <Text color={THEME.colors.brand}>/grill-me </Text>
                            </Box>
                        )}
                        {planRefineMode && (
                            <Box flexShrink={0}>
                                <Text color={THEME.colors.brand}>[Refine Plan] </Text>
                            </Box>
                        )}
                        {interactivePlanGoalMode && (
                            <Box flexShrink={0}>
                                <Text color={THEME.colors.brand}>[Plan Goal] </Text>
                            </Box>
                        )}
                        <Box flexGrow={1} flexShrink={1}>
                            <TextArea
                                value={value}
                                onChange={handleChange}
                                onSubmit={handleSubmit}
                                onHistoryUp={handleHistoryUp}
                                onHistoryDown={handleHistoryDown}
                                onScrollUp={onScrollUp}
                                onScrollDown={onScrollDown}
                                placeholder={
                                    isTranscribing
                                        ? 'Transcribing speech...'
                                        : isVoiceActive
                                          ? 'Listening...'
                                          : grillMode
                                            ? ''
                                            : planRefineMode
                                              ? 'Enter feedback to refine plan (or Esc to cancel)...'
                                              : interactivePlanGoalMode
                                                ? 'Enter your goal (e.g. add dark mode) or Esc to cancel...'
                                                : placeholder
                                }
                                placeholderColor={isVoiceActive ? THEME.colors.brand : undefined}
                                focus={!disabled}
                                disableHistoryNav={
                                    showCommandMenu ||
                                    fileMenu.showFileMenu ||
                                    showShortcutsMenu ||
                                    Boolean(btwState)
                                }
                            />
                        </Box>
                    </Box>

                    {/* bottom separator */}
                    <Box overflow="hidden" height={1} width="100%">
                        <Text color={THEME.colors.border} wrap="truncate">
                            {sep}
                        </Text>
                    </Box>

                    {/* status row - clean & minimal: <model> (<authMethod>)                  <tokens> / <max> (<pct>%) */}
                    {showExitConfirm ? (
                        <Box
                            width="100%"
                            justifyContent="space-between"
                            height={1}
                            overflow="hidden"
                        >
                            <Box gap={2} alignItems="center" flexShrink={1}>
                                <Box gap={1} flexShrink={1}>
                                    {activeToast ? (
                                        <Text
                                            wrap="truncate"
                                            color={
                                                activeToast.variant === 'success'
                                                    ? THEME.colors.success
                                                    : activeToast.variant === 'error'
                                                      ? THEME.colors.error
                                                      : THEME.colors.muted
                                            }
                                        >
                                            · {activeToast.message.replace(/\s+/g, ' ').trim()}
                                        </Text>
                                    ) : (
                                        <Text color={THEME.colors.muted} wrap="truncate">
                                            · Press Ctrl+C again to exit
                                        </Text>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    ) : (
                        <Box
                            width="100%"
                            justifyContent="space-between"
                            height={1}
                            overflow="hidden"
                        >
                            <Box gap={2} alignItems="center" flexShrink={1}>
                                <Box gap={1} flexShrink={1}>
                                    <Text color={THEME.colors.muted} wrap="truncate">
                                        {activeModeTag ? (
                                            <Text color={THEME.colors.brand} bold>
                                                {activeModeTag}{' '}
                                            </Text>
                                        ) : null}
                                        {!isAuthenticated
                                            ? 'Not connected (run /login)'
                                            : modelLabel || activeModel}
                                    </Text>
                                    {totalTasksCount > 0 && (
                                        <Text
                                            wrap="truncate"
                                            color={
                                                runningTasksCount > 0
                                                    ? THEME.colors.warning
                                                    : THEME.colors.muted
                                            }
                                        >
                                            ·{' '}
                                            {runningTasksCount > 0
                                                ? `${runningTasksCount} running`
                                                : `${totalTasksCount} tasks`}{' '}
                                            (Ctrl+T)
                                        </Text>
                                    )}
                                    {mcpCount > 0 && (
                                        <Text wrap="truncate" color={THEME.colors.muted}>
                                            · {mcpCount} MCP
                                        </Text>
                                    )}
                                    {activeToast && (
                                        <Text
                                            wrap="truncate"
                                            color={
                                                activeToast.variant === 'success'
                                                    ? THEME.colors.success
                                                    : activeToast.variant === 'error'
                                                      ? THEME.colors.error
                                                      : THEME.colors.muted
                                            }
                                        >
                                            · {activeToast.message.replace(/\s+/g, ' ').trim()}
                                        </Text>
                                    )}
                                </Box>
                            </Box>
                            <Box gap={0} flexShrink={0} marginLeft={2}>
                                <Text color={contextColor} wrap="truncate">
                                    {contextLabel}
                                </Text>
                            </Box>
                        </Box>
                    )}
                </>
            )}
        </Box>
    )
})
