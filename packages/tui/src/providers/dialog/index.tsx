import { Box, Text, useInput } from 'ink'
import { createContext, useContext, useState, useCallback } from 'react'

import { useKeyboardLayer } from '../keyboard-layer'

import type { DialogConfig } from './types'
import type { ReactNode } from 'react'

export type DialogContextValue = {
    open: (config: DialogConfig) => void
    close: () => void
    isOpen: boolean
}

const DialogContext = createContext<DialogContextValue | null>(null)

export function useDialog(): DialogContextValue {
    const value = useContext(DialogContext)
    if (!value) {
        throw new Error('useDialog must be used within a DialogProvider')
    }
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

    const value: DialogContextValue = {
        open,
        close,
        isOpen: currentDialog !== null,
    }

    return (
        <DialogContext.Provider value={value}>
            {currentDialog ? <Dialog config={currentDialog} close={close} /> : children}
        </DialogContext.Provider>
    )
}

type DialogProps = {
    config: DialogConfig
    close: () => void
}

function Dialog({ config, close }: DialogProps) {
    const { isTopLayer } = useKeyboardLayer()

    useInput((_input, key) => {
        if (!isTopLayer('dialog')) return

        if (key.escape) {
            close()
        }
    })

    return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
            <Box marginBottom={1} justifyContent="space-between">
                <Text bold>{config.title}</Text>
                <Text dimColor>esc to close</Text>
            </Box>
            {config.children}
        </Box>
    )
}
