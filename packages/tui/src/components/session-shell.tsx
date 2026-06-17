import { InputBar } from './input-bar'

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
        <box
            flexDirection="column"
            flexGrow={1}
            width="100%"
            height="100%"
            paddingY={1}
            paddingX={2}
            gap={1}
        >
            <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="bottom">
                <box gap={1}>{children}</box>
            </scrollbox>
            <box flexShrink={0}>
                <InputBar onSubmit={onSubmit} disabled={inputDisabled} loading={loading} />
            </box>
        </box>
    )
}
