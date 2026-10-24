import { Box, Text, useInput } from 'ink'
import React, { useState, useRef } from 'react'

import { useTerminalColumns } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

import type { CodeSearchResultItem } from '../../types'

export interface CodeSearchMenuProps {
    codeSearchQuery?: string
    codeSearchResults?: CodeSearchResultItem[]
    onOpenCodeSearchResult?: (item: CodeSearchResultItem) => void
    onInsertCodeSearchResult?: (item: CodeSearchResultItem) => void
    setAuthMode?: (mode: any) => void
    onClose?: () => void
}

const WINDOW_SIZE = 6

export function CodeSearchMenu({
    codeSearchQuery = '',
    codeSearchResults = [],
    onOpenCodeSearchResult,
    onInsertCodeSearchResult,
    setAuthMode,
    onClose,
}: CodeSearchMenuProps) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [windowStart, setWindowStart] = useState(0)
    const terminalColumns = useTerminalColumns()
    const columns = terminalColumns > 0 ? terminalColumns : 80

    const results = codeSearchResults
    const totalItems = results.length

    const selectedIndexRef = useRef(selectedIndex)
    selectedIndexRef.current = selectedIndex

    const resultsRef = useRef(results)
    resultsRef.current = results

    const handleClose = () => {
        if (onClose) {
            onClose()
        } else if (setAuthMode) {
            setAuthMode('none')
        }
    }

    useInput((input, key) => {
        if (key.escape) {
            handleClose()
            return
        }

        if (totalItems === 0) return

        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            const count = isWheelUp
                ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                : 1
            setSelectedIndex((prev) => {
                const next = Math.max(0, prev - count)
                if (next < windowStart) {
                    setWindowStart(next)
                }
                return next
            })
            return
        }

        if (key.downArrow || input === 'j' || isWheelDown) {
            const count = isWheelDown
                ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                : 1
            setSelectedIndex((prev) => {
                const next = Math.min(totalItems - 1, prev + count)
                if (next >= windowStart + WINDOW_SIZE) {
                    setWindowStart(Math.max(0, next - WINDOW_SIZE + 1))
                }
                return next
            })
            return
        }

        if (key.return) {
            const currentItem = resultsRef.current[selectedIndexRef.current]
            if (currentItem && onOpenCodeSearchResult) {
                onOpenCodeSearchResult(currentItem)
            } else {
                handleClose()
            }
            return
        }

        if (key.tab || input === 'c') {
            const currentItem = resultsRef.current[selectedIndexRef.current]
            if (currentItem && onInsertCodeSearchResult) {
                onInsertCodeSearchResult(currentItem)
            }
            handleClose()
            return
        }
    })

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, totalItems)
    const visibleItems = results.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = totalItems - windowEnd
    const hasOverflow = totalItems > WINDOW_SIZE

    let statusText = ''
    if (hasOverflow) {
        if (itemsAbove > 0 && itemsBelow > 0) {
            statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
        } else if (itemsAbove > 0) {
            statusText = `↑ ${itemsAbove} more`
        } else if (itemsBelow > 0) {
            statusText = `↓ ${itemsBelow} more`
        }
    }

    const footerItems =
        totalItems > 0
            ? [
                  { key: '↑/↓', label: 'navigate' },
                  { key: 'enter', label: 'view file' },
                  { key: 'tab', label: 'insert @file:line' },
                  { key: 'esc', label: 'dismiss' },
              ]
            : [{ key: 'esc', label: 'dismiss' }]

    const fileColWidth = Math.min(40, Math.max(28, Math.floor(columns * 0.38)))

    return (
        <Box flexDirection="column" width="100%">
            {/* Header */}
            <Box justifyContent="space-between" width="100%" marginBottom={1}>
                <Box gap={1}>
                    <Text bold color={THEME.colors.text}>
                        Code Search
                    </Text>
                    {codeSearchQuery ? (
                        <Text color={THEME.colors.muted}>
                            · "{codeSearchQuery}" ({totalItems} match{totalItems === 1 ? '' : 'es'})
                        </Text>
                    ) : null}
                </Box>
                {totalItems > 0 && (
                    <Text color={THEME.colors.muted}>
                        {selectedIndex + 1}/{totalItems}
                    </Text>
                )}
            </Box>

            {/* Compact Diff-style Search Results List */}
            <Box flexDirection="column" width="100%" marginY={1}>
                {totalItems === 0 ? (
                    <Text color={THEME.colors.dim}>No matches found in workspace.</Text>
                ) : (
                    <>
                        {visibleItems.map((item, relIdx) => {
                            const absIdx = windowStart + relIdx
                            const isSelected = absIdx === selectedIndex
                            return (
                                <Box
                                    key={`${item.file}:${item.line}:${absIdx}`}
                                    flexDirection="row"
                                    width="100%"
                                >
                                    <Box width={2} flexShrink={0}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.dim
                                            }
                                        >
                                            {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                        </Text>
                                    </Box>
                                    <Box width={fileColWidth} flexShrink={0} marginRight={2}>
                                        <Text
                                            bold={isSelected}
                                            color={
                                                isSelected ? THEME.colors.brand : THEME.colors.text
                                            }
                                            wrap="truncate-end"
                                        >
                                            {item.file}:{item.line}
                                        </Text>
                                    </Box>
                                    <Box flexGrow={1} flexShrink={1}>
                                        <Text
                                            color={
                                                isSelected ? THEME.colors.text : THEME.colors.dim
                                            }
                                            wrap="truncate-end"
                                        >
                                            {item.content.trim()}
                                        </Text>
                                    </Box>
                                </Box>
                            )
                        })}
                        {hasOverflow && statusText && (
                            <Box paddingLeft={2} marginTop={1}>
                                <Text color={THEME.colors.muted}>{statusText}</Text>
                            </Box>
                        )}
                    </>
                )}
            </Box>

            {/* Branded Footer */}
            <MenuFooter items={footerItems} />
        </Box>
    )
}
