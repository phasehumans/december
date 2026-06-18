import { useApp, useInput } from 'ink'
import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

type Responder = () => boolean

type KeyboardLayerContextValue = {
    push: (id: string, responder?: Responder) => void
    pop: (id: string) => void
    isTopLayer: (id: string) => boolean
    setResponder: (id: string, responder: Responder | null) => void
}

const KeyboardLayerContext = createContext<KeyboardLayerContextValue | null>(null)

export function KeyboardLayerProvider({ children }: { children: React.ReactNode }) {
    const [stack, setStack] = useState<string[]>(['base'])
    const stackRef = useRef(stack)
    stackRef.current = stack

    // Exit confirmation — first Ctrl+C shows warning, second exits
    const [exitPending, setExitPending] = useState(false)
    const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const responders = useRef<Map<string, Responder>>(new Map())
    const { exit } = useApp()

    const push = useCallback((id: string, responder?: Responder) => {
        if (responder) responders.current.set(id, responder)
        setStack((prev) => (prev.includes(id) ? prev : [...prev, id]))
    }, [])

    const pop = useCallback((id: string) => {
        responders.current.delete(id)
        setStack((prev) => prev.filter((layer) => layer !== id))
    }, [])

    const isTopLayer = useCallback(
        (id: string) => stack.length === 0 || stack[stack.length - 1] === id,
        [stack]
    )

    const setResponder = useCallback((id: string, responder: Responder | null) => {
        if (responder) responders.current.set(id, responder)
        else responders.current.delete(id)
    }, [])

    useInput((_input, key) => {
        if (!(key.ctrl && _input === 'c')) return

        // Walk responder chain first — any modal/overlay can intercept
        const currentStack = stackRef.current
        for (let i = currentStack.length - 1; i >= 0; i--) {
            const layerId = currentStack[i]!
            const responder = responders.current.get(layerId)
            if (responder && responder()) return
        }

        // No responder handled it — double-tap to exit
        if (exitPending) {
            if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
            exit()
            return
        }

        setExitPending(true)
        exitTimerRef.current = setTimeout(() => {
            setExitPending(false)
        }, 2000) // reset after 2 s if they don't press again
    })

    return (
        <KeyboardLayerContext.Provider value={{ push, pop, isTopLayer, setResponder }}>
            {/* "Press Ctrl+C again to exit" toast — shown inline at top */}
            {exitPending && <ExitHint />}
            {children}
        </KeyboardLayerContext.Provider>
    )
}

// Rendered inline when exit is pending
import { Box, Text } from 'ink'
function ExitHint() {
    return (
        <Box paddingX={2} paddingY={0}>
            <Text color="gray">Press </Text>
            <Text color="white" bold>
                Ctrl+C
            </Text>
            <Text color="gray"> again to exit</Text>
        </Box>
    )
}

export function useKeyboardLayer() {
    const context = useContext(KeyboardLayerContext)
    if (!context) {
        throw new Error('useKeyboardLayer must be used within a KeyboardLayerProvider')
    }
    return context
}
