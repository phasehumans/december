import { homedir } from 'node:os'

import { useRenderer } from '@opentui/react'
import { useRef, useCallback, useEffect } from 'react'

import { INPUT_PLACEHOLDER } from '../constants'
import { useDialog } from '../providers/dialog'
import { useKeyboardLayer } from '../providers/keyboard-layer'
import { useTheme } from '../providers/theme'
import { useToast } from '../providers/toast'

import { CommandMenu } from './command-menu'
import { useCommandMenu } from './command-menu/use-command-menu'
import { StatusBar } from './status-bar'

import type { Command } from './command-menu/types'
import type { TextareaRenderable } from '@opentui/core'
import type { KeyBinding } from '@opentui/core'

type Props = {
    onSubmit: (text: string) => void
    disabled?: boolean
    loading?: boolean
}

function shortCwd(): string {
    const cwd = process.cwd()
    const home = homedir()
    return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
}

export const TEXTAREA_KEY_BINDINGS: KeyBinding[] = [
    { name: 'return', action: 'submit' },
    { name: 'enter', action: 'submit' },
    { name: 'return', shift: true, action: 'newline' },
    { name: 'enter', shift: true, action: 'newline' },
]

export function InputBar({ onSubmit, disabled = false, loading = false }: Props) {
    const textareaRef = useRef<TextareaRenderable>(null)
    const onSubmitRef = useRef<() => void>(() => {})
    const renderer = useRenderer()
    const toast = useToast()
    const dialog = useDialog()
    const { colors } = useTheme()
    const { isTopLayer, setResponder } = useKeyboardLayer()

    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        scrollRef,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,
    } = useCommandMenu()

    const handleTextareaContentChange = useCallback(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        handleContentChange(textarea.plainText)
    }, [])

    const handleSubmit = useCallback(() => {
        if (disabled) return

        const textarea = textareaRef.current
        if (!textarea) return

        const text = textarea.plainText.trim()
        if (text.length === 0) return

        onSubmit(text)
        textarea.setText('')
    }, [disabled, onSubmit])

    const handleCommand = useCallback(
        (command: Command | undefined) => {
            const textarea = textareaRef.current
            if (!textarea || !command) return

            textarea.setText('')

            if (command.action) {
                command.action({
                    exit: () => renderer.destroy(),
                    toast,
                    dialog,
                })
            } else {
                textarea.insertText(command.value + ' ')
            }
        },
        [renderer, toast, dialog]
    )

    const handleCommandExecute = useCallback(
        (index: number) => {
            const command = resolveCommand(index)
            handleCommand(command)
        },
        [resolveCommand, handleCommand]
    )

    // Wire up textarea submit handler once so it always reads the latest state.
    useEffect(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        textarea.onSubmit = () => {
            onSubmitRef.current()
        }
    }, [])

    onSubmitRef.current = () => {
        if (disabled) return

        if (showCommandMenu) {
            const command = resolveCommand(selectedIndex)
            handleCommand(command)
            return
        }

        handleSubmit()
    }

    // Register the base layer responder for ctrl+c dismissal
    useEffect(() => {
        setResponder('base', () => {
            if (disabled) return false

            const textarea = textareaRef.current
            if (textarea && textarea.plainText.length > 0) {
                textarea.setText('')
                return true
            }
            return false
        })

        return () => setResponder('base', null)
    }, [disabled, setResponder])

    return (
        <box width="100%" position="relative" gap={1}>
            {showCommandMenu && (
                <box
                    position="absolute"
                    bottom="100%"
                    left={0}
                    width="100%"
                    backgroundColor={colors.surface}
                    zIndex={10}
                >
                    <CommandMenu
                        query={commandQuery}
                        selectedIndex={selectedIndex}
                        scrollRef={scrollRef}
                        onSelect={setSelectedIndex}
                        onExecute={handleCommandExecute}
                    />
                </box>
            )}

            <box
                border
                borderStyle="rounded"
                borderColor={disabled ? colors.dimSeparator : colors.primary}
                backgroundColor={colors.surface}
                bottomTitle={` ${shortCwd()} `}
                bottomTitleAlignment="left"
                paddingX={1}
                width="100%"
                flexDirection="row"
                gap={1}
            >
                <text fg={disabled ? colors.dimSeparator : colors.primary}>{'>'}</text>
                <box flexGrow={1}>
                    <textarea
                        ref={textareaRef}
                        focused={!disabled && (isTopLayer('base') || isTopLayer('command'))}
                        keyBindings={TEXTAREA_KEY_BINDINGS}
                        onContentChange={handleTextareaContentChange}
                        placeholder={INPUT_PLACEHOLDER}
                    />
                </box>
            </box>

            <StatusBar loading={loading} />
        </box>
    )
}
