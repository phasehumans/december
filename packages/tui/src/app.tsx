import { Agent } from '@december/agent'
import { MessageList, InputBar, TaskHUD, GlobalShortcuts } from '@december/tui'
import { AuthMenus, AskQuestionMenu } from '@december/tui'
import { Box, Text } from 'ink'
import { useState, useCallback } from 'react'

export function ChatApp({
    agent,
    isAuthenticated: initialAuth,
    cliVersion,
    userEmail,
    sessionRepository,
    onLogin,
    onLoginHeadless,
    session,
}: {
    agent: Agent
    isAuthenticated: boolean
    cliVersion?: string
    userEmail?: string
    sessionRepository?: any
    onLogin?: () => Promise<{ token: string; email: string | null }>
    onLoginHeadless?: (
        onCode: (code: string, uri: string) => void
    ) => Promise<{ token: string; email: string | null }>
    session: any
}) {
    const [inputHistory, setInputHistory] = useState<string[]>([])

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
        setAuthMode,
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
                <AuthMenus
                    {...session}
                    agent={agent}
                    getProviderModels={session.getProviderModels}
                />
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
            <GlobalShortcuts {...session} agent={agent} />
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
                activeModel={agent.modelOptions?.model || 'gemini-3.5-flash'}
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
