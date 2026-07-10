import { Box, Text, useInput } from 'ink'
import React, { useState, useEffect } from 'react'

import { useKeyboardLayer } from '../../providers/keyboard-layer'

type Props = {
    agent: any
    toast: any
    resetChat?: () => void
    close: () => void
}

export function ContextDialog({ agent, toast, resetChat, close }: Props) {
    const { isTopLayer } = useKeyboardLayer()
    const [stats, setStats] = useState({
        sessionId: agent?.sessionId || 'N/A',
        messageCount: agent?.messages?.length || 0,
        estimatedTokens: 0,
        systemPrompt: agent?.systemPrompt || '',
    })

    useEffect(() => {
        if (!agent) return

        // Estimate token count simply by character count / 4
        let totalChars = 0
        for (const msg of agent.messages) {
            totalChars += msg.content?.length || 0
            if (msg.toolCalls) {
                totalChars += JSON.stringify(msg.toolCalls).length
            }
        }
        const estTokens = Math.round(totalChars / 4)

        setStats({
            sessionId: agent.sessionId,
            messageCount: agent.messages.length,
            estimatedTokens: estTokens,
            systemPrompt: agent.systemPrompt || '',
        })
    }, [agent, agent?.messages?.length, agent?.sessionId])

    useInput(async (input, key) => {
        if (!isTopLayer('dialog')) return

        if (key.ctrl || key.meta) return

        const char = input.toLowerCase()
        if (char === 'c') {
            // Clear context
            if (agent) {
                await agent.clearContext()
            }
            if (resetChat) resetChat()
            toast.show({ variant: 'success', message: 'Conversation cleared.' })
            close()
        } else if (char === 'm') {
            // Compact context
            if (agent) {
                await agent.compactContext()
            }
            toast.show({ variant: 'success', message: 'Conversation compacted.' })
            close()
        } else if (char === 'f') {
            // Fork session
            if (agent) {
                const newId = await agent.forkContext()
                toast.show({ variant: 'success', message: `Forked to session: ${newId}` })
            }
            close()
        } else if (char === 'n') {
            // New session
            if (agent) {
                await agent.newContext()
            }
            if (resetChat) resetChat()
            toast.show({ variant: 'success', message: 'Started a new conversation.' })
            close()
        }
    })

    const systemPromptPreview =
        stats.systemPrompt.length > 50
            ? stats.systemPrompt.slice(0, 47) + '...'
            : stats.systemPrompt || 'None'

    return (
        <Box flexDirection="column" gap={0}>
            <Box flexDirection="column" marginBottom={1}>
                <Box gap={1}>
                    <Text color="#AAAAAA">Session ID:</Text>
                    <Text color="white" bold>
                        {stats.sessionId}
                    </Text>
                </Box>
                <Box gap={1}>
                    <Text color="#AAAAAA">Messages:</Text>
                    <Text color="#89B4F8">{stats.messageCount}</Text>
                </Box>
                <Box gap={1}>
                    <Text color="#AAAAAA">Est. Tokens:</Text>
                    <Text color="#89B4F8">{stats.estimatedTokens}</Text>
                </Box>
                <Box gap={1} flexDirection="column" marginTop={1}>
                    <Text color="#AAAAAA">System Prompt:</Text>
                    <Text color="gray" italic>
                        "{systemPromptPreview}"
                    </Text>
                </Box>
            </Box>

            <Box borderStyle="round" borderColor="#444444" flexDirection="column" paddingX={1}>
                <Text bold color="#89B4F8" marginBottom={1}>
                    Actions
                </Text>
                <Box gap={1}>
                    <Text color="white" bold>
                        [C]
                    </Text>
                    <Text color="#AAAAAA">Clear Context</Text>
                </Box>
                <Box gap={1}>
                    <Text color="white" bold>
                        [M]
                    </Text>
                    <Text color="#AAAAAA">Compact Context</Text>
                </Box>
                <Box gap={1}>
                    <Text color="white" bold>
                        [F]
                    </Text>
                    <Text color="#AAAAAA">Fork Session</Text>
                </Box>
                <Box gap={1}>
                    <Text color="white" bold>
                        [N]
                    </Text>
                    <Text color="#AAAAAA">New Session</Text>
                </Box>
            </Box>
        </Box>
    )
}
