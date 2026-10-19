import { Box, Static } from 'ink'
import React from 'react'

import { useTerminalColumns } from '../hooks/use-terminal-columns'

import { Header } from './header'
import { BotMessage } from './messages/bot-message'
import { ErrorMessage } from './messages/error-message'
import { UserMessage } from './messages/user-message'
import { useScrollViewport } from './scroll-viewport'

import type { ReleaseAnnouncement } from '../constants/announcements'
import type { Message } from '../types'

export interface MessageItemProps {
    msg: Message
    index: number
    prevRole?: string | null
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
    expandCommands?: boolean
    announcement?: ReleaseAnnouncement | null
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
    isAuthenticated?: boolean
    onHeightMeasured?: (key: string, height: number) => void
}

function estimateMessageHeight(msg: Message, columns: number): number {
    if (msg.role === 'header') {
        return 7
    }
    if (msg.role === 'user') {
        const text = msg.displayText || msg.text || ''
        const lines = text.split(/\r?\n/)
        let total = 0
        const cols = Math.max(20, columns - 10)
        for (const line of lines) {
            total += Math.max(1, Math.ceil(line.length / cols))
        }
        return Math.max(2, total + 1)
    }
    if (msg.role === 'error') {
        let rows = 2
        if (msg.cause) rows += 1
        if (msg.hint) rows += 1
        return rows
    }
    if (msg.blocks && msg.blocks.length > 0) {
        let total = 0
        const cols = Math.max(20, columns - 10)
        for (const b of msg.blocks) {
            if (b.type === 'text') {
                const lines = (b.content || '').split(/\r?\n/)
                for (const line of lines) {
                    total += Math.max(1, Math.ceil(line.length / cols))
                }
            } else if (b.type === 'command') {
                total += 2
            } else if (b.type === 'tool_use') {
                total += 4
            } else if (b.type === 'diff') {
                total += 6
            } else {
                total += 2
            }
        }
        return Math.max(3, total + 1)
    }
    return 3
}

export const MessageItem = React.memo(
    function MessageItem({
        msg,
        index,
        prevRole,
        cliVersion,
        latestVersion,
        userEmail,
        expandCommands,
        announcement,
        activeModel,
        modelLabel,
        authMethod,
        selectedProvider,
        isAuthenticated,
        onHeightMeasured,
    }: MessageItemProps) {
        const itemKey = msg.id != null ? `${msg.id}` : `msg-idx-${index}`

        const onRef = React.useCallback(
            (node: any) => {
                if (node?.yogaNode && onHeightMeasured) {
                    const h = node.yogaNode.getComputedHeight()
                    if (h > 0) {
                        onHeightMeasured(itemKey, h)
                    }
                }
            },
            [itemKey, onHeightMeasured]
        )

        let content: React.ReactNode
        if (msg.role === 'header') {
            content = (
                <Header
                    cliVersion={cliVersion}
                    latestVersion={latestVersion}
                    userEmail={userEmail}
                    announcement={announcement}
                    activeModel={activeModel}
                    modelLabel={modelLabel}
                    authMethod={authMethod}
                    selectedProvider={selectedProvider}
                    isAuthenticated={isAuthenticated}
                />
            )
        } else if (msg.role === 'user') {
            content = <UserMessage message={msg.displayText || msg.text || ''} />
        } else if (msg.role === 'error') {
            const hasTopMargin = prevRole !== 'user'
            content = (
                <ErrorMessage
                    message={msg.text ?? ''}
                    cause={msg.cause}
                    hint={msg.hint}
                    hasTopMargin={hasTopMargin}
                />
            )
        } else {
            const hasTopMargin = prevRole === 'header'
            content = (
                <BotMessage
                    blocks={msg.blocks ?? []}
                    usage={msg.usage}
                    expandCommands={expandCommands}
                    hasTopMargin={hasTopMargin}
                />
            )
        }

        return (
            <Box ref={onRef} flexDirection="column" width="100%">
                {content}
            </Box>
        )
    },
    (prev, next) => {
        if (prev.msg !== next.msg) return false
        if (prev.prevRole !== next.prevRole) return false
        if (prev.expandCommands !== next.expandCommands) return false
        if (prev.cliVersion !== next.cliVersion) return false
        if (prev.latestVersion !== next.latestVersion) return false
        if (prev.userEmail !== next.userEmail) return false
        if (prev.announcement !== next.announcement) return false
        if (prev.isAuthenticated !== next.isAuthenticated) return false
        if (prev.activeModel !== next.activeModel) return false
        if (prev.modelLabel !== next.modelLabel) return false
        if (prev.authMethod !== next.authMethod) return false
        if (prev.selectedProvider !== next.selectedProvider) return false
        return true
    }
)

const OVERSCAN_ROWS = 25

export const MessageList = React.memo(function MessageList({
    staticKey,
    staticMessages,
    activeMessages,
    isAuthenticated,
    cliVersion,
    latestVersion,
    userEmail,
    expandCommands,
    fullscreen = true,
    announcement,
    isReadingMode = false,
    activeModel,
    modelLabel,
    authMethod,
    selectedProvider,
}: {
    staticKey: number
    staticMessages: Message[]
    activeMessages: Message[]
    isAuthenticated: boolean
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
    expandCommands?: boolean
    fullscreen?: boolean
    announcement?: ReleaseAnnouncement | null
    isReadingMode?: boolean
    activeModel?: string
    modelLabel?: string
    authMethod?: string
    selectedProvider?: string
}) {
    const columns = useTerminalColumns()
    const scrollViewport = useScrollViewport()
    const heightCacheRef = React.useRef<Map<string, number>>(new Map())

    const handleHeightMeasured = React.useCallback((key: string, measuredHeight: number) => {
        if (measuredHeight > 0) {
            const prev = heightCacheRef.current.get(key)
            if (prev !== measuredHeight) {
                heightCacheRef.current.set(key, measuredHeight)
            }
        }
    }, [])

    if (fullscreen) {
        const allMessages = [...staticMessages, ...activeMessages]
        const terminalRows =
            typeof process !== 'undefined' && process.stdout?.rows
                ? Math.max(1, process.stdout.rows - 6)
                : 24

        const viewportHeight = scrollViewport?.viewportHeight || terminalRows
        const scrollTop = scrollViewport?.scrollTop ?? 0
        const effectiveReadingMode = isReadingMode || Boolean(scrollViewport?.isReadingMode)

        const shouldWindow = allMessages.length > 5

        let startIndex = 0
        let endIndex = allMessages.length
        let topSpacer = 0
        let bottomSpacer = 0

        if (shouldWindow) {
            const heights = allMessages.map((msg, i) => {
                const key = msg.id != null ? `${msg.id}` : `msg-idx-${i}`
                const cached = heightCacheRef.current.get(key)
                if (cached !== undefined && cached > 0) return cached
                return estimateMessageHeight(msg, columns)
            })

            const offsets = new Array(allMessages.length + 1)
            offsets[0] = 0
            for (let i = 0; i < allMessages.length; i++) {
                offsets[i + 1] = offsets[i] + (heights[i] || 4)
            }
            const totalHeight = offsets[allMessages.length]

            let windowTop: number
            let windowBottom: number

            if (effectiveReadingMode) {
                if (scrollViewport) {
                    windowTop = Math.max(0, scrollTop - OVERSCAN_ROWS)
                    windowBottom = scrollTop + viewportHeight + OVERSCAN_ROWS
                } else {
                    windowTop = 0
                    windowBottom = totalHeight
                }
            } else {
                windowBottom = totalHeight
                windowTop = Math.max(0, totalHeight - viewportHeight - OVERSCAN_ROWS)
            }

            startIndex = 0
            while (startIndex < allMessages.length - 1 && offsets[startIndex + 1] <= windowTop) {
                startIndex++
            }

            endIndex = startIndex
            while (endIndex < allMessages.length && offsets[endIndex] < windowBottom) {
                endIndex++
            }
            endIndex = Math.min(allMessages.length, Math.max(endIndex, startIndex + 1))

            topSpacer = offsets[startIndex]
            bottomSpacer = Math.max(0, totalHeight - offsets[endIndex])
        }

        const visibleMessages = allMessages.slice(startIndex, endIndex)
        const isWindowed = startIndex > 0

        return (
            <Box flexDirection="column" width="100%">
                {isWindowed && (
                    <Header
                        cliVersion={cliVersion}
                        latestVersion={latestVersion}
                        userEmail={userEmail}
                        announcement={announcement}
                        activeModel={activeModel}
                        modelLabel={modelLabel}
                        authMethod={authMethod}
                        selectedProvider={selectedProvider}
                        isAuthenticated={isAuthenticated}
                    />
                )}
                {topSpacer > 0 && <Box height={topSpacer} flexShrink={0} />}
                {visibleMessages.map((msg, index) => {
                    const actualIndex = startIndex + index
                    const prevRole = actualIndex > 0 ? allMessages[actualIndex - 1]?.role : null
                    const key = msg.id != null ? `${msg.id}` : `msg-idx-${actualIndex}`
                    return (
                        <MessageItem
                            key={key}
                            msg={msg}
                            index={actualIndex}
                            prevRole={prevRole}
                            cliVersion={cliVersion}
                            latestVersion={latestVersion}
                            userEmail={userEmail}
                            expandCommands={expandCommands}
                            announcement={announcement}
                            activeModel={activeModel}
                            modelLabel={modelLabel}
                            authMethod={authMethod}
                            selectedProvider={selectedProvider}
                            isAuthenticated={isAuthenticated}
                            onHeightMeasured={handleHeightMeasured}
                        />
                    )
                })}
                {bottomSpacer > 0 && <Box height={bottomSpacer} flexShrink={0} />}
            </Box>
        )
    }

    return (
        <Box flexDirection="column" width="100%">
            {staticMessages.length > 0 && (
                <Static key={staticKey} items={staticMessages} style={{ width: '100%' }}>
                    {(msg, index) => {
                        const prevRole = index > 0 ? staticMessages[index - 1]?.role : null
                        const key = msg.id != null ? `${msg.id}` : `msg-idx-${index}`
                        return (
                            <MessageItem
                                key={key}
                                msg={msg}
                                index={index}
                                prevRole={prevRole}
                                cliVersion={cliVersion}
                                latestVersion={latestVersion}
                                userEmail={userEmail}
                                expandCommands={expandCommands}
                                announcement={announcement}
                                activeModel={activeModel}
                                modelLabel={modelLabel}
                                authMethod={authMethod}
                                selectedProvider={selectedProvider}
                                isAuthenticated={isAuthenticated}
                            />
                        )
                    }}
                </Static>
            )}
            {activeMessages.map((msg, index) => {
                const actualIndex = staticMessages.length + index
                const all = [...staticMessages, ...activeMessages]
                const prevRole = actualIndex > 0 ? all[actualIndex - 1]?.role : null
                const key = msg.id != null ? `${msg.id}` : `msg-idx-${actualIndex}`
                return (
                    <MessageItem
                        key={key}
                        msg={msg}
                        index={actualIndex}
                        prevRole={prevRole}
                        cliVersion={cliVersion}
                        latestVersion={latestVersion}
                        userEmail={userEmail}
                        expandCommands={expandCommands}
                        announcement={announcement}
                        activeModel={activeModel}
                        modelLabel={modelLabel}
                        authMethod={authMethod}
                        selectedProvider={selectedProvider}
                        isAuthenticated={isAuthenticated}
                    />
                )
            })}
        </Box>
    )
})
