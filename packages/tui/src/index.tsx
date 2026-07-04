import { RootLayout } from './layouts/root-layout'
import { Chat } from './screens/chat'
import type { Agent } from '@december/agent'

export function App({
    agent,
    isAuthenticated,
    cliVersion,
    userEmail,
}: {
    agent: Agent
    isAuthenticated: boolean
    cliVersion?: string
    userEmail?: string
}) {
    return (
        <RootLayout>
            <Chat
                agent={agent}
                isAuthenticated={isAuthenticated}
                cliVersion={cliVersion}
                userEmail={userEmail}
            />
        </RootLayout>
    )
}
