import { Box, Text } from 'ink'
import { homedir } from 'node:os'

const VERSION = 'v0.1.0'
const USER_EMAIL = 'phasehumans@gmail.com'

function getCwd(): string {
    try {
        const cwd = process.cwd()
        const home = homedir()
        return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
    } catch {
        return '~'
    }
}

export function Header() {
    const cwd = getCwd()

    return (
        <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
            <Text bold color="white">
                ✱ December CLI <Text color="gray">{VERSION}</Text>
            </Text>
            <Text color="gray">{USER_EMAIL}</Text>
            <Text color="gray">{cwd}</Text>
        </Box>
    )
}
