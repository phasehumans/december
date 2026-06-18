import { Box, Text, useStdout } from 'ink'
import TextInput from 'ink-text-input'
import { useState, useCallback } from 'react'

import { useDialog } from '../providers/dialog'
import { useToast } from '../providers/toast'

import { CommandMenu } from './command-menu'
import { useCommandMenu } from './command-menu/use-command-menu'
import { ModelSelector } from './model-selector'

import type { Command } from './command-menu/types'

type Props = {
    onSubmit: (text: string) => void
    disabled?: boolean
    placeholder?: string
}

export function InputBar({
    onSubmit,
    disabled = false,
    placeholder = 'Ask December to build features, fix bugs, or work on your code...',
}: Props) {
    const [value, setValue] = useState('')
    const { stdout } = useStdout()
    const cols = stdout?.columns ?? 80
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
            if (command.action) {
                command.action({
                    exit: () => process.exit(0),
                    toast,
                    dialog,
                })
            }
        },
        [toast, dialog, handleContentChange]
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

    // Box fills available width with 2-char padding on each side
    const innerWidth = Math.max(20, cols - 4)
    // Border characters
    const topBorder = '┌' + '─'.repeat(innerWidth) + '┐'
    const bottomBorder = '└' + '─'.repeat(innerWidth) + '┘'

    return (
        <Box flexDirection="column" paddingX={2} paddingTop={1}>
            {/* ── Top border ── */}
            <Text color="gray">{topBorder}</Text>

            {/* ── Empty padding row ── */}
            <Box>
                <Text color="gray">│</Text>
                <Box width={innerWidth}>
                    <Text> </Text>
                </Box>
                <Text color="gray">│</Text>
            </Box>

            {/* ── Prompt row ── */}
            <Box>
                <Text color="gray">│</Text>
                <Text color={disabled ? 'gray' : 'white'}> {'>'} </Text>
                <Box width={innerWidth - 3} flexGrow={1}>
                    <TextInput
                        value={value}
                        onChange={handleChange}
                        onSubmit={handleSubmit}
                        placeholder={placeholder}
                        focus={!disabled && !dialog.isOpen}
                    />
                </Box>
                <Text color="gray">│</Text>
            </Box>

            {/* ── Empty padding row ── */}
            <Box>
                <Text color="gray">│</Text>
                <Box width={innerWidth}>
                    <Text> </Text>
                </Box>
                <Text color="gray">│</Text>
            </Box>

            {/* ── Bottom border ── */}
            <Text color="gray">{bottomBorder}</Text>

            {/* ── Status row: only shown when dropdown is NOT open ── */}
            {!showCommandMenu && (
                <Box width={cols - 4} justifyContent="space-between" marginTop={1}>
                    <Text color="gray">Use /clear to start a fresh conversation</Text>
                    <ModelSelector />
                </Box>
            )}

            {/* ── Command dropdown (below box) ── */}
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
