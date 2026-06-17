import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'
import { Tips } from '../components/tips'

export function Home() {
    const navigate = useNavigate()

    const handleSubmit = useCallback(
        (text: string) => {
            navigate('/sessions/new', { state: { message: text } })
        },
        [navigate]
    )

    return (
        <box
            flexDirection="column"
            flexGrow={1}
            width="100%"
            height="100%"
            paddingY={1}
            paddingX={2}
            gap={1}
        >
            <Header />
            <Tips />
            <box flexGrow={1} />
            <box flexShrink={0}>
                <InputBar onSubmit={handleSubmit} />
            </box>
        </box>
    )
}
