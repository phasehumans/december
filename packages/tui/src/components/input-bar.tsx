import { useState, useRef, useCallback, useEffect } from 'react'
import type { TextareaRenderable } from '@opentui/core'
import { useRenderer } from '@opentui/react'
import type { KeyBinding } from '@opentui/core'
import { EmptyBorder } from './border'
import { StatusBar } from './status-bar'
import { CommandMenu } from './command-menu'
import type { Command } from './command-menu/command.types'
import { useCommandMenu } from './command-menu/use-command-menu'

type Props = {
    onSubmit: (text: string) => void
    disabled?: boolean
}

export const TEXT_AREA_KEYBINDINGS: KeyBinding[] = [
    { name: 'return', action: 'submit' },
    { name: 'enter', action: 'submit' },
    { name: 'return', shift: true, action: 'newline' },
    { name: 'enter', shift: true, action: 'newline' },
]

export function InputBar({ onSubmit, disabled = false }: Props) {
    const textareaRef = useRef<TextareaRenderable>(null)
    const onSubmitRef = useRef<() => void>(() => {})
    const renderer = useRenderer()

    const {
        showCommandMenu,
        commandQuery,
        selectedIndex,
        scrollRef,
        handleContentChange,
        resolveCommand,
        setSelectedIndex,
    } = useCommandMenu()

    const handleCommandExecute = useCallback((index: number) => {
        const command = resolveCommand(index)
        handleCommand(command)
    }, [])

    const handleTextAreaContentChange = useCallback(() => {
        const textarea = textareaRef.current
        if (!textarea) return

        handleContentChange(textarea.plainText)
    }, [])

    const handleSubmit = useCallback(() => {
        if (!disabled) return

        const textarea = textareaRef.current
        if (!textarea) return

        const text = textarea.plainText.trim()

        if (text.length === 0) return

        onSubmit(text)
        textarea.setText('')
    }, [onSubmit, disabled])

    const handleCommand = useCallback(
        (command: Command | undefined) => {
            const textarea = textareaRef.current
            if (!command || !textarea) return

            textarea.setText('')

            if (command.action) {
                command.action({
                    exit: () => renderer.destroy(),
                })
            } else {
                textarea.insertText(command.value + ' ')
            }
        },
        [renderer]
    )

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

    return (
        <box width="100%" alignItems="center">
            <box
                border={['left']}
                borderColor="cyan"
                customBorderChars={{
                    ...EmptyBorder,
                    vertical: '┃',
                    bottomLeft: '╹',
                }}
                width="100%"
            >
                <box
                    position="relative"
                    justifyContent="center"
                    paddingX={2}
                    paddingY={1}
                    backgroundColor="#1A1A24"
                    width="100%"
                    gap={1}
                >
                    {showCommandMenu && (
                        <box
                            position="absolute"
                            bottom="100%"
                            left={0}
                            width="100%"
                            backgroundColor="#1A1A24"
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
                    <textarea
                        ref={textareaRef}
                        focused={!disabled}
                        keyBindings={TEXT_AREA_KEYBINDINGS}
                        onContentChange={handleTextAreaContentChange}
                        placeholder={'Ask December to do something... (e.g. "/help")'}
                    />
                    <StatusBar />
                </box>
            </box>
        </box>
    )
}
