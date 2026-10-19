import { useInput } from 'ink'
import { useState, useMemo, useCallback, useRef } from 'react'

import { useKeyboardLayer } from '../../providers/keyboard-layer'
import { scoreAndSortFiles, type ScoredFile } from '../../utils/fuzzy'

import { FILE_WINDOW_SIZE } from './index'

export type UseFileMenuOptions = {
    workspaceFiles: string[]
    recentFiles?: Set<string>
    onAutocomplete?: (completedText: string) => void
    disabled?: boolean
}

export type UseFileMenuReturn = {
    showFileMenu: boolean
    fileQuery: string
    selectedIndex: number
    windowStart: number
    filteredFiles: ScoredFile[]
    handleContentChange: (text: string) => void
    resolveFile: (index: number) => ScoredFile | undefined
    setSelectedIndex: (index: number) => void
    moveSelection: (direction: 'up' | 'down') => void
    close: () => void
    autocompleteSelected: (currentText?: string) => string | null
}

export type FileQueryMatch = {
    type: 'at' | 'open'
    query: string
}

export function getFileQueryMatch(text: string): FileQueryMatch | null {
    const openMatch = text.match(/^\/open\s+(\S*)$/)
    if (openMatch) {
        const raw = openMatch[1] || ''
        return { type: 'open', query: raw.startsWith('@') ? raw.slice(1) : raw }
    }
    const atMatch = text.match(/@(\S*)$/)
    if (atMatch) {
        return { type: 'at', query: atMatch[1] || '' }
    }
    return null
}

export function useFileMenu(options: UseFileMenuOptions): UseFileMenuReturn {
    const { workspaceFiles, recentFiles, onAutocomplete, disabled = false } = options

    const [textValue, setTextValue] = useState('')
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [windowStart, setWindowStart] = useState(0)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const { push, pop } = useKeyboardLayer()

    const fileMatch = getFileQueryMatch(textValue)
    const fileQuery = fileMatch ? fileMatch.query : ''

    const filteredFiles = useMemo(() => {
        if (!showFileMenu || workspaceFiles.length === 0) return []
        return scoreAndSortFiles(workspaceFiles, fileQuery, recentFiles)
    }, [showFileMenu, workspaceFiles, fileQuery, recentFiles])

    const close = useCallback(() => {
        setShowFileMenu(false)
        setSelectedIndex(0)
        setWindowStart(0)
        pop('file-menu')
    }, [pop])

    const handleContentChange = useCallback(
        (text: string) => {
            setTextValue(text)
            setSelectedIndex(0)
            setWindowStart(0)

            const match = getFileQueryMatch(text)
            if (match !== null && !disabled) {
                setShowFileMenu(true)
                push('file-menu', () => {
                    close()
                    return true
                })
            } else {
                close()
            }
        },
        [push, close, disabled]
    )

    const resolveFile = useCallback(
        (index: number): ScoredFile | undefined => {
            return filteredFiles[index]
        },
        [filteredFiles]
    )

    const moveSelection = useCallback(
        (direction: 'up' | 'down') => {
            if (!showFileMenu || filteredFiles.length === 0) return

            setSelectedIndex((prev) => {
                const maxIdx = filteredFiles.length - 1
                const next = direction === 'up' ? Math.max(0, prev - 1) : Math.min(maxIdx, prev + 1)

                // Scroll window to keep selected item visible
                setWindowStart((ws) => {
                    if (next < ws) return next
                    if (next >= ws + FILE_WINDOW_SIZE) return next - FILE_WINDOW_SIZE + 1
                    return ws
                })

                return next
            })
        },
        [showFileMenu, filteredFiles.length]
    )

    const autocompleteSelected = useCallback(
        (currentText?: string): string | null => {
            const file = filteredFiles[selectedIndex]
            if (!file) return null

            const base = currentText ?? textValue
            const match = getFileQueryMatch(base)
            if (!match) return null

            let nextVal: string
            if (match.type === 'open') {
                nextVal = `/open ${file.path}`
            } else {
                nextVal = base.replace(/@\S*$/, `@${file.path} `)
            }

            close()
            return nextVal
        },
        [filteredFiles, selectedIndex, textValue, close]
    )

    const stateRef = useRef({
        showFileMenu,
        filteredFiles,
        selectedIndex,
        onAutocomplete,
        close,
        moveSelection,
        autocompleteSelected,
    })
    stateRef.current = {
        showFileMenu,
        filteredFiles,
        selectedIndex,
        onAutocomplete,
        close,
        moveSelection,
        autocompleteSelected,
    }

    useInput((input, key) => {
        const state = stateRef.current
        if (!state.showFileMenu) return

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.escape) {
            state.close()
        } else if (key.upArrow || isWheelUp) {
            state.moveSelection('up')
        } else if (key.downArrow || isWheelDown) {
            state.moveSelection('down')
        } else if (key.tab || input === '\t') {
            const nextVal = state.autocompleteSelected()
            if (nextVal && state.onAutocomplete) {
                state.onAutocomplete(nextVal)
            }
        }
    })

    return {
        showFileMenu,
        fileQuery,
        selectedIndex,
        windowStart,
        filteredFiles,
        handleContentChange,
        resolveFile,
        setSelectedIndex,
        moveSelection,
        close,
        autocompleteSelected,
    }
}
