import React from 'react'
import { Static } from 'ink'
import type { Message } from '../types'
import { Header } from '../../../components/header'
import { UserMessage } from '../../../components/messages/user-message'
import { BotMessage } from '../../../components/messages/bot-message'
import { ErrorMessage } from '../../../components/messages/error-message'
import { Agent } from '@december/agent'

export function MessageList({
    staticKey,
    staticMessages,
    activeMessages,
    agent,
    isAuthenticated,
    cliVersion,
    userEmail,
}: {
    staticKey: number
    staticMessages: Message[]
    activeMessages: Message[]
    agent: Agent
    isAuthenticated: boolean
    cliVersion?: string
    userEmail?: string
}) {
    return (
        <>
            <Static items={staticMessages} style={{ flexDirection: 'column' }}>
                {(msg) => {
                    if (msg.role === 'header') {
                        return <Header key={msg.id} cliVersion={cliVersion} userEmail={userEmail} />
                    }
                    if (msg.role === 'user')
                        return <UserMessage key={msg.id} message={msg.text ?? ''} />
                    if (msg.role === 'error')
                        return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                    return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
                }}
            </Static>

            {activeMessages.map((msg) => {
                if (msg.role === 'user')
                    return <UserMessage key={msg.id} message={msg.text ?? ''} />
                if (msg.role === 'error')
                    return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
            })}
        </>
    )
}
