import { exec } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'

import { Box, Text } from 'ink'
import { useState, useEffect } from 'react'

const execAsync = promisify(exec)

function useGitBranch() {
    const [branch, setBranch] = useState<string | null>(null)

    useEffect(() => {
        execAsync('git rev-parse --abbrev-ref HEAD')
            .then(({ stdout }) => {
                setBranch(stdout.trim())
            })
            .catch(() => {
                setBranch(null)
            })
    }, [])

    return branch
}

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
    const branch = useGitBranch()

    return (
        <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
            <Text bold color="white">
                ✱ December CLI <Text color="gray">v{cliVersion.replace(/^v/, '')}</Text>
            </Text>
            {userEmail && <Text color="gray">{userEmail}</Text>}
            <Box gap={1}>
                <Text color="gray">{cwd}</Text>
                {branch && <Text color="gray">({branch})</Text>}
            </Box>
        </Box>
    )
}
