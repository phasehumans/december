import { Box, Text, useStdout } from 'ink'
import { homedir } from 'node:os'

// 4-row compact logo — same braille chars, tighter
const LOGO_LINES = ['⣤⣸⣇⣤', '⣼⢹⡏⣧', '⣴⢻⡟⣦', '⠛⢹⡏⠛']

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
    const { stdout } = useStdout()
    const width = stdout?.columns ?? 80

    return (
        <Box flexDirection="column" width={width}>
            {/* Logo row */}
            <Box flexDirection="row" paddingX={2} paddingTop={1} gap={2}>
                <Box flexDirection="column">
                    {LOGO_LINES.map((line, i) => (
                        <Text key={i} color="white">
                            {line}
                        </Text>
                    ))}
                </Box>

                <Box flexDirection="column" justifyContent="center">
                    {/* Name bold white + version inline */}
                    <Box gap={1}>
                        <Text bold color="white">
                            December CLI
                        </Text>
                        <Text color="gray">{VERSION}</Text>
                    </Box>
                    <Text color="gray">{USER_EMAIL}</Text>
                    <Text color="gray">{cwd}</Text>
                </Box>
            </Box>
        </Box>
    )
}
