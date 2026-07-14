import { Static } from 'ink'
import React from 'react'

import { Header } from './header'
import { BotMessage } from './messages/bot-message'
import { ErrorMessage } from './messages/error-message'
import { UserMessage } from './messages/user-message'

import type { Message } from '../types'
export function MessageList({
    staticKey,
    staticMessages,
    activeMessages,
    isAuthenticated,
    cliVersion,
    userEmail,
}: {
    staticKey: number
    staticMessages: Message[]
    activeMessages: Message[]
    isAuthenticated: boolean
    cliVersion?: string
    userEmail?: string
}) {
    return (
        <>
            <Static key={staticKey} items={staticMessages} style={{ flexDirection: 'column' }}>
                {(msg) => {
                    if (msg.role === 'header') {
                        return <Header key={msg.id} cliVersion={cliVersion} userEmail={userEmail} />
                    }
                    if (msg.role === 'user')
                        return <UserMessage key={msg.id} message={msg.text ?? ''} />
                    if (msg.role === 'error')
                        return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                    return <BotMessage key={msg.id} blocks={msg.blocks ?? []} usage={msg.usage} />
                }}
            </Static>

            {activeMessages.map((msg) => {
                if (msg.role === 'user')
                    return <UserMessage key={msg.id} message={msg.text ?? ''} />
                if (msg.role === 'error')
                    return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                return <BotMessage key={msg.id} blocks={msg.blocks ?? []} usage={msg.usage} />
            })}
        </>
    )
}
