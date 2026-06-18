import { render } from 'ink'
import { useState, useCallback } from 'react'

import { RootLayout } from './layouts/root-layout'
import { Home } from './screens/home'
import { NewSession } from './screens/new-session'

type Screen = { name: 'home' } | { name: 'new-session'; message: string }

function App() {
    const [screen, setScreen] = useState<Screen>({ name: 'home' })

    const handleHomeSubmit = useCallback((text: string) => {
        setScreen({ name: 'new-session', message: text })
    }, [])

    const handleSessionSubmit = useCallback((_text: string) => {
        // Handle follow-up messages in session
    }, [])

    return (
        <RootLayout>
            {screen.name === 'home' && <Home onSubmit={handleHomeSubmit} />}
            {screen.name === 'new-session' && (
                <NewSession initialMessage={screen.message} onSubmit={handleSessionSubmit} />
            )}
        </RootLayout>
    )
}

render(<App />)
