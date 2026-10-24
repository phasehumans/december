import { Box, Text, useInput } from 'ink'
import React, { useState, useMemo, useRef } from 'react'

import { useTerminalColumns } from '../../hooks/use-terminal-columns'
import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface RewindTurnItem {
    turnIndex: number
    commitHash: string
    prompt?: string
    timestamp: number
    touchedFiles?: string[]
}

export interface RewindSelectMenuProps {
    rewindItems?: RewindTurnItem[]
    onSelectTurn?: (turnIndex: number) => void
    setAuthMode?: (mode: any) => void
    onClose?: () => void
}

export function RewindSelectMenu(props: RewindSelectMenuProps) {
    const { rewindItems = [], onSelectTurn, setAuthMode, onClose } = props
    const [selectedIndex, setSelectedIndex] = useState(0)
    const columns = useTerminalColumns()

    // Reverse order so newest turn is at the top
    const items = useMemo(() => {
        return [...rewindItems].sort((a, b) => b.turnIndex - a.turnIndex)
    }, [rewindItems])

    const selectedIndexRef = useRef(selectedIndex)
    selectedIndexRef.current = selectedIndex

    const itemsRef = useRef(items)
    itemsRef.current = items

    const timeAgo = (timestamp: number) => {
        if (!timestamp) return ''
        const seconds = Math.floor((Date.now() - timestamp) / 1000)
        if (seconds < 60) return `${Math.max(0, seconds)}s ago`
        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h ago`
        const days = Math.floor(hours / 24)
        return `${days}d ago`
    }

    useInput((input, key) => {
        if (key.escape) {
            if (onClose) {
                onClose()
            } else if (setAuthMode) {
                setAuthMode('none')
            }
            return
        }

        if (itemsRef.current.length === 0) return

        if (key.upArrow || input === 'k') {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : itemsRef.current.length - 1))
            return
        }

        if (key.downArrow || input === 'j') {
            setSelectedIndex((prev) => (prev < itemsRef.current.length - 1 ? prev + 1 : 0))
            return
        }

        if (key.return) {
            const currentSelected = itemsRef.current[selectedIndexRef.current]
            if (currentSelected && onSelectTurn) {
                onSelectTurn(currentSelected.turnIndex)
            }
        }
    })

    const footerItems = [
        { key: '↑/↓', label: 'navigate' },
        { key: 'enter', label: 'rewind to turn' },
        { key: 'esc', label: 'close' },
    ]

    return (
        <Box
            flexDirection="column"
            borderStyle="single"
            borderColor={THEME.colors.brand}
            paddingX={1}
            paddingY={1}
            width={columns > 0 ? Math.min(columns, 90) : 80}
        >
            <Box flexDirection="column" marginBottom={1}>
                <Text bold color={THEME.colors.brand}>
                    Rewind Workspace & Conversation Timeline
                </Text>
                <Text color={THEME.colors.muted}>
                    Select a previous turn checkpoint to restore filesystem files and rewind chat
                    history.
                </Text>
            </Box>

            {items.length === 0 ? (
                <Box paddingY={1}>
                    <Text color={THEME.colors.muted}>
                        No turn snapshots recorded in this session.
                    </Text>
                </Box>
            ) : (
                <Box flexDirection="column">
                    {items.map((item, idx) => {
                        const isSelected = idx === selectedIndex
                        const filesCount = item.touchedFiles?.length || 0
                        const filesTag =
                            filesCount > 0
                                ? ` (${filesCount} file${filesCount === 1 ? '' : 's'})`
                                : ''
                        const preview = item.prompt
                            ? item.prompt.replace(/\s+/g, ' ').trim()
                            : 'Turn snapshot'
                        const truncatedPreview =
                            preview.length > 45 ? `${preview.slice(0, 45)}...` : preview

                        return (
                            <Box key={item.turnIndex} paddingY={0}>
                                <Box width={3}>
                                    <Text
                                        color={isSelected ? THEME.colors.brand : THEME.colors.muted}
                                    >
                                        {isSelected ? '❯' : ' '}
                                    </Text>
                                </Box>
                                <Box width={10}>
                                    <Text
                                        bold={isSelected}
                                        color={isSelected ? THEME.colors.brand : undefined}
                                    >
                                        Turn {item.turnIndex}
                                    </Text>
                                </Box>
                                <Box width={10}>
                                    <Text color={THEME.colors.muted}>
                                        {item.commitHash ? item.commitHash.slice(0, 7) : ''}
                                    </Text>
                                </Box>
                                <Box width={10}>
                                    <Text color={THEME.colors.muted}>
                                        {timeAgo(item.timestamp)}
                                    </Text>
                                </Box>
                                <Box flexGrow={1}>
                                    <Text
                                        bold={isSelected}
                                        color={isSelected ? THEME.colors.text : THEME.colors.muted}
                                    >
                                        {truncatedPreview}
                                    </Text>
                                    {filesTag && <Text color={THEME.colors.muted}>{filesTag}</Text>}
                                </Box>
                            </Box>
                        )
                    })}
                </Box>
            )}

            <MenuFooter items={footerItems} />
        </Box>
    )
}
