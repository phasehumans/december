import { render } from 'ink'

import { RootLayout } from './layouts/root-layout'
import { Chat } from './screens/chat'

function App() {
    return (
        <RootLayout>
            <Chat />
        </RootLayout>
    )
}

render(<App />, { exitOnCtrlC: false })
