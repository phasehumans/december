import { RootLayout } from './layouts/root-layout'
import { Chat } from './screens/chat'

import type { Agent } from '@december/agent'
import type { FileSessionRepository } from '@december/agent'

export function App({
    agent,
    isAuthenticated,
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
    return (
        <RootLayout>
            <Chat
                agent={agent}
                isAuthenticated={isAuthenticated}
                cliVersion={cliVersion}
                userEmail={userEmail}
                sessionRepository={sessionRepository}
                onLogin={onLogin}
                onLoginHeadless={onLoginHeadless}
            />
        </RootLayout>
    )
}
