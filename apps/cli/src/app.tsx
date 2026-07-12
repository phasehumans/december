import { Box } from 'ink'
import { useState, useCallback, useEffect } from 'react'

import { getModelLabel, getProviderModels } from './utils/models'

import { MessageList, InputBar } from '@december/tui'
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
        handleSubmit,
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
    return (
        <Box flexDirection="column" width="100%">
            <MessageList
                staticKey={staticKey}
                staticMessages={staticMessages}
                activeMessages={activeMessages}
                isAuthenticated={isAuthenticated}
                cliVersion={cliVersion}
                userEmail={currentEmail}
            />

            <InputBar
                onSubmit={handleSubmit}
                disabled={authMode !== 'none'}
                placeholder="Ask December to build..."
                activeModel={
                    agent.modelOptions?.model
                        ? getModelLabel(agent.modelOptions.model)
                        : getModelLabel('gemini-3.5-flash')
                }
                authUI={authUI}
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
