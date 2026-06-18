import { Box } from 'ink'

import { InputBar } from './input-bar'
import { Spinner } from './spinner'

import type { ReactNode } from 'react'

type Props = {
    children?: ReactNode
    onSubmit: (text: string) => void
    inputDisabled?: boolean
    loading?: boolean
}

export function SessionShell({
    children,
    onSubmit,
    inputDisabled = false,
    loading = false,
}: Props) {
    return (
        <Box flexDirection="column" flexGrow={1} width="100%">
            {/* Messages area */}
            <Box flexDirection="column" flexGrow={1}>
                {children}
            </Box>

            {/* Spinner while waiting */}
            {loading && (
                <Box paddingLeft={4} paddingBottom={1}>
                    <Spinner />
                </Box>
            )}

            {/* Input — separator + prompt + status row all in one */}
            <InputBar onSubmit={onSubmit} disabled={inputDisabled} />
        </Box>
    )
}
