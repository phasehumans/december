import { homedir } from 'node:os'

import { Box, Text } from 'ink'

function getCwd(): string {
    try {
        const cwd = process.cwd()
        const home = homedir()
        return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
    } catch {
        return '~'
    }
}

export function Header({
    cliVersion = '0.1.0',
    userEmail,
}: {
    cliVersion?: string
    userEmail?: string
}) {
    const cwd = getCwd()

    return (
        <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
            <Text bold color="white">
                ✱ December CLI <Text color="gray">v{cliVersion.replace(/^v/, '')}</Text>
            </Text>
            {userEmail && <Text color="gray">{userEmail}</Text>}
            <Text color="gray">{cwd}</Text>
        </Box>
    )
}
