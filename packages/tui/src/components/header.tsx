import { execSync } from 'node:child_process'
import { homedir } from 'node:os'

import { Box, Text } from 'ink'
import React from 'react'

function getGitBranch(): string | null {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', { stdio: 'pipe' }).toString().trim()
    } catch {
        return null
    }
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
    const branch = getGitBranch()

    return (
        <Box flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
            <Text bold color="white">
                <Text color="#89B4F8">✱</Text> December CLI{' '}
                <Text color="white">{cliVersion.replace(/^v/, '')}</Text>
            </Text>
            {userEmail && <Text color="gray">{userEmail}</Text>}
            <Box gap={1}>
                <Text color="gray">{cwd}</Text>
                {branch && <Text color="gray">({branch})</Text>}
            </Box>
        </Box>
    )
}
