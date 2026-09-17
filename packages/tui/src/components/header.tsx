import fs from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

import { Box, Text } from 'ink'
import React from 'react'

import { THEME } from '../theme'
import { terminalLink } from '../utils/terminal-link'

let cachedBranch: string | null | undefined = undefined

export function clearGitBranchCache() {
    cachedBranch = undefined
}

export function getGitBranch(workspaceRoot: string = process.cwd()): string | null {
    if (cachedBranch !== undefined) {
        return cachedBranch
    }
    try {
        const gitPath = path.resolve(workspaceRoot, '.git')
        if (fs.existsSync(gitPath)) {
            const stat = fs.statSync(gitPath)
            let headPath = path.resolve(gitPath, 'HEAD')
            if (stat.isFile()) {
                const content = fs.readFileSync(gitPath, 'utf-8').trim()
                if (content.startsWith('gitdir:')) {
                    const gitDir = content.slice(7).trim()
                    headPath = path.resolve(workspaceRoot, gitDir, 'HEAD')
                }
            }

            if (fs.existsSync(headPath)) {
                const headContent = fs.readFileSync(headPath, 'utf-8').trim()
                if (headContent.startsWith('ref: refs/heads/')) {
                    cachedBranch = headContent.replace('ref: refs/heads/', '').trim()
                    return cachedBranch
                }
                if (headContent) {
                    cachedBranch = headContent.slice(0, 7)
                    return cachedBranch
                }
            }
        }
    } catch {
        // Intentionally swallowed: fallback to null if git branch cannot be resolved
    }
    cachedBranch = null
    return null
}

function getCwd(): string {
    try {
        const cwd = process.cwd()
        const home = homedir()
        return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
    } catch {
        // Intentionally swallowed: fallback to default home tilde path if process.cwd fails
        return '~'
    }
}

export const Header = React.memo(function Header({
    cliVersion = '0.1.0',
    latestVersion,
    userEmail,
}: {
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
}) {
    const cwd = getCwd()
    const branch = getGitBranch()

    return (
        <Box
            flexDirection="column"
            paddingLeft={THEME.padding.paddingLeft ?? THEME.padding.paddingX}
            paddingRight={THEME.padding.paddingRight ?? 4}
            paddingTop={1}
            paddingBottom={0}
        >
            <Text>
                <Text color={THEME.colors.brand}>✱ </Text>
                <Text bold color={THEME.colors.text}>
                    December
                </Text>
                <Text color={THEME.colors.subtle}> v{cliVersion.replace(/^v/, '')}</Text>
            </Text>
            {userEmail && <Text color={THEME.colors.subtle}>{userEmail}</Text>}
            <Box gap={1}>
                <Text color={THEME.colors.subtle}>{cwd}</Text>
                {branch && <Text color={THEME.colors.subtle}>({branch})</Text>}
            </Box>
            <Box flexDirection="column" marginTop={1}>
                <Text color={THEME.colors.muted}>
                    {'Press / for commands  ·  Use /handoff to continue in cloud ('}
                    <Text color={THEME.colors.brand}>
                        {terminalLink('trydecember.com', 'https://trydecember.com')}
                    </Text>
                    {')'}
                </Text>
                {latestVersion && (
                    <Text color={THEME.colors.muted}>
                        Run /update to install December CLI {latestVersion}
                    </Text>
                )}
            </Box>
        </Box>
    )
})
