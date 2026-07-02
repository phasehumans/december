import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { useState, useCallback } from 'react'

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
}

export function InputBar({
    onSubmit,
    disabled = false,
    placeholder = 'Ask December to build features, fix bugs, or work on your code...',
    activeModel = 'unknown',
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

    const handleChange = useCallback(
        (newValue: string) => {
            if (disabled) return
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

            // Forward auth commands to Chat component
            if (
                command.value === '/login' ||
                command.value === '/logout' ||
                command.value === '/exit' ||
                command.value === '/model'
            ) {
                onSubmit(command.value)
                return
            }

            if (command.action) {
                command.action({
                    exit: () => process.exit(0),
                    toast,
                    dialog,
                })
            }
        },
        [toast, dialog, handleContentChange, onSubmit]
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
            <Text color="#555555">{sep}</Text>

            {/* Prompt */}
            <Box>
                <Text color={disabled ? '#555555' : 'white'}>{`❭ `}</Text>
                <TextInput
                    value={value}
                    onChange={handleChange}
                    onSubmit={handleSubmit}
                    placeholder={placeholder}
                    focus={!disabled && !dialog.isOpen}
                />
            </Box>

            {/* Bottom separator */}
            <Text color="#555555">{sep}</Text>

            {/* Status row — model left, december studio right */}
            {!showCommandMenu && (
                <Box width={innerWidth} justifyContent="space-between">
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
                                    ●
                                </Text>
                                <Text color="gray">{toast.currentToast.message}</Text>
                            </Box>
                        )}
                    </Box>
                    <Box gap={1}>
                        <Text color="gray">december studio</Text>
                        <Text color="gray">↗</Text>
                    </Box>
                </Box>
            )}

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
