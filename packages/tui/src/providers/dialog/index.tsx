import { Box, Text, useInput } from 'ink'
import { createContext, useContext, useState, useCallback } from 'react'

import { useTerminalColumns } from '../../hooks/use-terminal-columns'

import { useKeyboardLayer } from '../keyboard-layer'

import type { DialogConfig } from './types'
import type { ReactNode } from 'react'

export type DialogContextValue = {
    open: (config: DialogConfig) => void
    close: () => void
    isOpen: boolean
    currentDialog: DialogConfig | null
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function useDialog(): DialogContextValue {
    const value = useContext(DialogContext)
    if (!value) throw new Error('useDialog must be used within a DialogProvider')
    return value
}

type DialogProviderProps = {
    children: ReactNode
}

export function DialogProvider({ children }: DialogProviderProps) {
    const [currentDialog, setCurrentDialog] = useState<DialogConfig | null>(null)
    const { push, pop } = useKeyboardLayer()

    const close = useCallback(() => {
        setCurrentDialog(null)
        pop('dialog')
    }, [pop])

    const open = useCallback(
        (config: DialogConfig) => {
            setCurrentDialog(config)
            push('dialog', () => {
                close()
                return true
            })
        },
        [push, close]
    )

    const value: DialogContextValue = { open, close, isOpen: currentDialog !== null, currentDialog }

    // Dialog always renders alongside children — never replaces the screen
    return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

// Inline dialog panel — rendered beside the input area, above the prompt
type InlineDialogProps = {
    config: DialogConfig
    close: () => void
}

export function InlineDialog({ config, close }: InlineDialogProps) {
    const { isTopLayer } = useKeyboardLayer()
    const cols = useTerminalColumns()
    // Panel sits on the right half of the terminal
    const panelWidth = Math.floor(cols * 0.45)

    useInput((_input, key) => {
        if (!isTopLayer('dialog')) return
        if (key.escape) close()
    })

    return (
        <Box
            flexDirection="column"
            width={panelWidth}
            borderStyle="single"
            borderColor="#444444"
            paddingX={1}
            paddingY={0}
            alignSelf="flex-end"
        >
            <Box justifyContent="space-between" marginBottom={1}>
                <Text bold color="white">
                    {config.title}
                </Text>
                <Text color="gray">esc to close</Text>
            </Box>
            {config.children}
        </Box>
    )
}
