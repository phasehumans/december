import { Box } from 'ink'
import { useState, useCallback, useEffect } from 'react'

import { getModelLabel, getProviderModels } from './utils/models'

import { MessageList, InputBar, TaskHUD } from '@december/tui'
import { useAgentSession } from './hooks/use-agent-session'
import { AuthMenus, AskQuestionMenu } from '@december/tui'
import { Agent } from '@december/agent'
import type { FileSessionRepository } from '@december/agent'

export function Chat({
    agent,
    isAuthenticated: initialAuth,
    cliVersion,
    userEmail,
    sessionRepository,
    onLogin,
    onLoginHeadless,
}: {
    agent: Agent
    isAuthenticated: boolean
    cliVersion?: string
    userEmail?: string
    sessionRepository?: FileSessionRepository
    onLogin?: () => Promise<{ token: string; email: string | null }>
    onLoginHeadless?: (
        onCode: (code: string, uri: string) => void
    ) => Promise<{ token: string; email: string | null }>
}) {
    const [inputHistory, setInputHistory] = useState<string[]>([])
    const session = useAgentSession({
        agent,
        isAuthenticated: initialAuth,
        cliVersion,
        userEmail,
        sessionRepository,
        onLogin,
        onLoginHeadless,
    })
    const {
        staticKey,
        staticMessages,
        activeMessages,
        isAuthenticated,
        currentEmail,
        authMode,
        planMode,
        grillMode,
        setStaticMessages,
        setStaticKey,
        setActiveMessages,
    } = session
    const authUI =
        authMode !== 'none' ? (
            authMode === 'ask_question' && session.pendingQuestions ? (
                <AskQuestionMenu
                    questions={session.pendingQuestions.questions}
                    onComplete={(answers) => {
                        session.pendingQuestions?.resolve(
                            typeof answers === 'string' ? answers : answers.join(', ')
                        )
                        setAuthMode('none')
                        session.setPendingQuestions(null)
                    }}
                />
            ) : (
                <AuthMenus {...session} agent={agent} getProviderModels={getProviderModels} />
            )
        ) : null

    const handleFormSubmit = useCallback(
        (text: string) => {
            if (text && !text.startsWith('/')) {
                setInputHistory((prev) => [...prev, text])
            }
            session.handleSubmit(text)
        },
        [session.handleSubmit]
    )

    const totalTokens = [...staticMessages, ...activeMessages].reduce((acc, msg) => {
        if (msg.usage) {
            return acc + (msg.usage.promptTokens || 0) + (msg.usage.completionTokens || 0)
        }
        return acc
    }, 0)

    const activeSubagent = activeMessages.find(
        (m) => m.role === 'assistant' && m.toolCalls?.some((tc) => tc.name === 'invoke_subagent')
    )
    const hasActiveSubagent =
        activeSubagent &&
        !activeMessages.some(
            (m) =>
                m.role === 'tool' && activeSubagent.toolCalls?.some((tc) => tc.id === m.toolCallId)
        )

    return (
        <Box flexDirection="column" width="100%">
            <TaskHUD cwd={process.cwd()} />
            <MessageList
                staticKey={staticKey}
                staticMessages={staticMessages}
                activeMessages={activeMessages}
                isAuthenticated={isAuthenticated}
                cliVersion={cliVersion}
                userEmail={currentEmail}
            />

            <InputBar
                onSubmit={handleFormSubmit}
                history={inputHistory}
                disabled={authMode !== 'none'}
                onInterrupt={() => {
                    if (session.isStreaming) {
                        agent.abort()
                    } else {
                        process.exit(0)
                    }
                }}
                onCopy={() => {
                    import('clipboardy')
                        .then((cb) => {
                            const allMsgs = [...staticMessages, ...activeMessages]
                            const lastAssistant = [...allMsgs]
                                .reverse()
                                .find((m) => m.role === 'assistant' && m.blocks)
                            if (lastAssistant) {
                                const text =
                                    lastAssistant.blocks?.map((b) => b.content || '').join('\n') ||
                                    ''
                                cb.default.writeSync(text)
                            }
                        })
                        .catch(console.error)
                }}
                placeholder="Ask December to build..."
                activeModel={
                    agent.modelOptions?.model
                        ? getModelLabel(agent.modelOptions.model)
                        : getModelLabel('gemini-3.5-flash')
                }
                contextTokens={totalTokens}
                authUI={
                    hasActiveSubagent ? (
                        <Box paddingX={1}>
                            <Text color="#F59E0B" bold>
                                ◆ Subagent Active...
                            </Text>
                        </Box>
                    ) : (
                        authUI
                    )
                }
                agent={agent}
                resetChat={() => {
                    console.clear()
                    setStaticMessages([{ id: 'header-' + Date.now(), role: 'header' }])
                    setStaticKey((k) => k + 1)
                    setActiveMessages([])
                }}
                planMode={planMode}
                grillMode={grillMode}
                customInputMode={false}
            />
        </Box>
    )
}
