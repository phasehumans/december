import { RootLayout } from './layouts/root-layout'
import { Chat } from './screens/chat'
import type { Agent } from '@december/agent'

export function App({ agent, isAuthenticated }: { agent: Agent; isAuthenticated: boolean }) {
    return (
        <RootLayout>
            <Chat agent={agent} isAuthenticated={isAuthenticated} />
        </RootLayout>
    )
}
