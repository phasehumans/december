import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useState, useCallback, useRef } from 'react'

import { useTerminalColumns } from '../hooks/use-terminal-columns'
import { useDialog, InlineDialog } from '../providers/dialog'
import { useToast } from '../providers/toast'

import { CommandMenu } from './command-menu'
import { useCommandMenu } from './command-menu/use-command-menu'
// ModelSelector removed in favor of passing activeModel as prop

import type { Command } from './command-menu/types'

type Props = {
    onSubmit: (text: string) => void
    disabled?: boolean
    placeholder?: string
    activeModel?: string
    authUI?: React.ReactNode
    agent?: any
    resetChat?: () => void
    planMode?: boolean
    grillMode?: boolean
    customInputMode?: boolean
}

export function InputBar({
    onSubmit,
    disabled = false,
    placeholder = 'Ask December to build...',
    activeModel = 'unknown',
    authUI,
    agent,
    resetChat,
    planMode = false,
    grillMode = false,
    customInputMode = false,
}: Props) {
    const [value, setValue] = useState('')
    const cols = useTerminalColumns()
    const toast = useToast()
    const dialog = useDialog()

    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        windowStart,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,
    } = useCommandMenu()

    const isCtrlW = useRef(false)
    useInput((input, key) => {
        if (key.ctrl && input === 'w') {
            isCtrlW.current = true
            setValue((prev) => {
                const match = prev.match(/(\s*\S+\s*)$/)
                const next = match ? prev.slice(0, -match[0].length) : prev
                handleContentChange(next)
                return next
            })
        }
        if ((key.backspace || key.delete) && value.length === 0 && grillMode) {
            onSubmit('/grill-me')
        }
        if ((key.backspace || key.delete) && value.length === 0 && planMode) {
            onSubmit('/plan')
        }
    })

    const handleChange = useCallback(
        (newValue: string) => {
            if (disabled) return
            if (isCtrlW.current) {
                isCtrlW.current = false
                return
            }
            setValue(newValue)
            handleContentChange(newValue)
        },
        [disabled, handleContentChange]
    )

    const handleCommand = useCallback(
        (command: Command | undefined) => {
            if (!command) return

            setValue('')
            handleContentChange('')

            // Autocomplete these commands instead of submitting
            if (command.value === '/plan' || command.value === '/grill-me') {
                const next = command.value + ' '
                setValue(next)
                handleContentChange(next)
                return
            }

            // Forward auth commands to Chat component
            if (
                command.value === '/login' ||
                command.value === '/logout' ||
                command.value === '/exit' ||
                command.value === '/model' ||
                command.value === '/resume' ||
                command.value === '/settings' ||
                command.value === '/context' ||
                command.value === '/hooks' ||
                command.value === '/tasks' ||
                command.value === '/usage'
            ) {
                onSubmit(command.value)
                return
            }

            if (command.action) {
                command.action({
                    exit: () => process.exit(0),
                    toast,
                    dialog,
                    agent,
                    resetChat,
                })
            }
        },
        [toast, dialog, agent, resetChat, handleContentChange, onSubmit]
    )

    const handleSubmit = useCallback(
        (text: string) => {
            if (disabled) return
            if (showCommandMenu) {
                const command = resolveCommand(selectedIndex)
                handleCommand(command)
                return
            }
            const trimmed = text.trim()
            if (trimmed.length === 0) return
            onSubmit(trimmed)
            setValue('')
            handleContentChange('')
        },
        [
            disabled,
            showCommandMenu,
            resolveCommand,
            selectedIndex,
            handleCommand,
            onSubmit,
            handleContentChange,
        ]
    )

    const innerWidth = Math.max(8, cols - 4)
    const sep = '─'.repeat(innerWidth)

    return (
        <Box flexDirection="column" paddingX={2}>
            {/* Inline dialog — shown on right above prompt when open */}
            {dialog.isOpen && dialog.currentDialog && (
                <Box justifyContent="flex-end">
                    <InlineDialog config={dialog.currentDialog} close={dialog.close} />
                </Box>
            )}
            {/* Top separator */}
            <Box overflow="hidden" height={1} width="100%">
                <Text color="#555555" wrap="truncate">
                    {sep}
                </Text>
            </Box>

            {/* Content: Prompt */}
            <Box>
                <Text color={disabled ? '#555555' : '#89B4F8'}>{`❭ `}</Text>
                {planMode && <Text color="#89B4F8">/plan </Text>}
                {grillMode && <Text color="#89B4F8">/grill-me </Text>}
                {(!authUI || customInputMode) && (
                    <TextInput
                        value={value}
                        onChange={handleChange}
                        onSubmit={handleSubmit}
                        placeholder={
                            customInputMode
                                ? 'Type your custom answer...'
                                : planMode
                                  ? ''
                                  : grillMode
                                    ? ''
                                    : placeholder
                        }
                        focus={!disabled && !dialog.isOpen}
                    />
                )}
            </Box>

            {/* Bottom separator */}
            <Box overflow="hidden" height={1} width="100%">
                <Text color="#555555" wrap="truncate">
                    {sep}
                </Text>
            </Box>

            {/* Status row — model left, december studio right */}
            {!showCommandMenu && !authUI && (
                <Box width="100%" justifyContent="space-between">
                    <Box gap={2} alignItems="center">
                        <Text color="#AAAAAA">{activeModel}</Text>
                        {toast.currentToast && (
                            <Box gap={1}>
                                <Text
                                    color={
                                        toast.currentToast.variant === 'success'
                                            ? '#6EE7B7'
                                            : toast.currentToast.variant === 'error'
                                              ? '#FCA5A5'
                                              : 'gray'
                                    }
                                >
                                    {toast.currentToast.message}
                                </Text>
                            </Box>
                        )}
                    </Box>
                    <Box gap={0}>
                        <Text color="#AAAAAA">? for shortcuts</Text>
                    </Box>
                </Box>
            )}

            {/* Auth UI */}
            {authUI && <Box paddingBottom={1}>{authUI}</Box>}

            {/* Command dropdown */}
            {showCommandMenu && (
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
            )}
        </Box>
    )
}
