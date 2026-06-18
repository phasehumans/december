import { Box } from 'ink'

import { Header } from '../components/header'
import { InputBar } from '../components/input-bar'

type Props = {
    onSubmit: (text: string) => void
}

export function Home({ onSubmit }: Props) {
    return (
        <Box flexDirection="column" flexGrow={1} width="100%">
            {/* Spacer — pushes content towards vertical center */}
            <Box flexGrow={1} />

            {/* Header: logo + name + email + cwd */}
            <Header />

            {/* Gap between header and input */}
            <Box marginTop={1} />

            {/* Input box with border + dropdown */}
            <InputBar onSubmit={onSubmit} />

            {/* Bottom spacer */}
            <Box flexGrow={1} />
        </Box>
    )
}
