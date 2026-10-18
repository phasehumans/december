import { Box, Static } from 'ink'
import React from 'react'

import { Header } from './header'
import { BotMessage } from './messages/bot-message'
import { ErrorMessage } from './messages/error-message'
import { UserMessage } from './messages/user-message'

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
}

export const MessageItem = React.memo(
    function MessageItem({
        msg,
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
    }: MessageItemProps) {
        if (msg.role === 'header') {
            return (
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
        }
        if (msg.role === 'user') {
            return <UserMessage message={msg.displayText || msg.text || ''} />
        }
        if (msg.role === 'error') {
            const hasTopMargin = prevRole !== 'user'
            return (
                <ErrorMessage
                    message={msg.text ?? ''}
                    cause={msg.cause}
                    hint={msg.hint}
                    hasTopMargin={hasTopMargin}
                />
            )
        }
        const hasTopMargin = prevRole === 'header'
        return (
            <BotMessage
                blocks={msg.blocks ?? []}
                usage={msg.usage}
                expandCommands={expandCommands}
                hasTopMargin={hasTopMargin}
            />
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

const MAX_WINDOW_MESSAGES = 20

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
    if (fullscreen) {
        const allMessages = [...staticMessages, ...activeMessages]
        const shouldWindow = !isReadingMode && allMessages.length > MAX_WINDOW_MESSAGES
        const visibleMessages = shouldWindow ? allMessages.slice(-MAX_WINDOW_MESSAGES) : allMessages
        const hiddenCount = shouldWindow ? allMessages.length - MAX_WINDOW_MESSAGES : 0

        return (
            <Box flexDirection="column" width="100%">
                {hiddenCount > 0 && (
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
                {visibleMessages.map((msg, index) => {
                    const actualIndex = shouldWindow ? hiddenCount + index : index
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
                        />
                    )
                })}
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
