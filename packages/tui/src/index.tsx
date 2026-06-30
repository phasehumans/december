import { RootLayout } from './layouts/root-layout'
import { Chat } from './screens/chat'
import type { Agent } from '@december/agent'

export function App({ agent }: { agent: Agent }) {
    return (
        <RootLayout>
            <Chat agent={agent} />
        </RootLayout>
    )
}
