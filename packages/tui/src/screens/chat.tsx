import { Box, useApp } from 'ink'
import { useState, useCallback } from 'react'

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'
import { BotMessage, ErrorMessage, UserMessage } from '../components/messages'

import type { MessageBlock } from '../components/messages/bot-message'
import { Agent, runAgentLoop } from '@december/agent'

type Message = {
    id: number
    role: 'user' | 'assistant' | 'error'
    text?: string
    blocks?: MessageBlock[]
}

let msgId = 0

export function Chat({ agent }: { agent: Agent }) {
    const [messages, setMessages] = useState<Message[]>([])
    const [isStreaming, setIsStreaming] = useState(false)
    const { exit } = useApp()

    const handleSubmit = useCallback(
        async (text: string) => {
            if (text.trim() === '/exit') {
                exit()
                return
            }

            setIsStreaming(true)
            setMessages((prev) => [...prev, { id: ++msgId, role: 'user', text }])

            const assistantMsgId = ++msgId
            setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', blocks: [] }])

            try {
                // Consume the real agent event stream
                const stream = runAgentLoop(agent, text)

                for await (const event of stream) {
                    setMessages((prev) =>
                        prev.map((msg) => {
                            if (msg.id !== assistantMsgId) return msg

                            const blocks = [...(msg.blocks || [])]

                            switch (event.type) {
                                case 'TurnStart':
                                    blocks.push({
                                        type: 'text',
                                        content: 'Thinking...',
                                    })
                                    break
                                case 'StreamChunk':
                                    const lastBlock = blocks[blocks.length - 1]
                                    if (lastBlock && lastBlock.type === 'text') {
                                        lastBlock.content =
                                            (lastBlock.content === 'Thinking...'
                                                ? ''
                                                : lastBlock.content) + event.content
                                    } else {
                                        blocks.push({ type: 'text', content: event.content })
                                    }
                                    break
                                case 'ToolCallStart':
                                    blocks.push({
                                        type: 'command',
                                        command: `${event.toolCall.name} ${event.toolCall.input}`,
                                        status: 'running',
                                    })
                                    break
                                case 'ToolCallResult':
                                    const lastCmd = blocks[blocks.length - 1]
                                    if (lastCmd && lastCmd.type === 'command') {
                                        lastCmd.status = event.result.error ? 'error' : 'success'
                                        lastCmd.output = event.result.error || event.result.result
                                    }
                                    break
                                case 'TurnEnd':
                                    break
                            }
                            return { ...msg, blocks }
                        })
                    )
                }
            } catch (err: any) {
                setMessages((prev) => [...prev, { id: ++msgId, role: 'error', text: err.message }])
            } finally {
                setIsStreaming(false)
            }
        },
        [exit, agent]
    )

    return (
        <Box flexDirection="column" width="100%">
            {/* Header — always at top */}
            <Header />

            {/* Message thread */}
            {messages.map((msg) => {
                if (msg.role === 'user') {
                    return <UserMessage key={msg.id} message={msg.text ?? ''} />
                }
                if (msg.role === 'error') {
                    return <ErrorMessage key={msg.id} message={msg.text ?? ''} />
                }
                return <BotMessage key={msg.id} blocks={msg.blocks ?? []} />
            })}

            {/* Input bar */}
            <InputBar onSubmit={handleSubmit} disabled={isStreaming} />
        </Box>
    )
}
