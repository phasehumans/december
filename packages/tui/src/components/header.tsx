import { Box, Text } from 'ink'
import React from 'react'

import { type ReleaseAnnouncement } from '../constants/announcements'
import { THEME } from '../theme'
import {
    clearGitBranchCache,
    formatBillingLabel,
    formatModelDisplayName,
    getCwd,
    getGitBranch,
} from '../utils/header-format'
import { terminalLink } from '../utils/terminal-link'

export { clearGitBranchCache, formatBillingLabel, formatModelDisplayName, getCwd, getGitBranch }

export interface HeaderProps {
    cliVersion?: string
    latestVersion?: string
    userEmail?: string
    announcement?: ReleaseAnnouncement | null
    activeModel?: string
    modelLabel?: string
    authMethod?: 'byok' | 'december' | 'subscription' | 'env' | string
    selectedProvider?: string
    isAuthenticated?: boolean
}

export const Header = React.memo(function Header({
    cliVersion = '0.1.0',
    latestVersion,
    userEmail,
    announcement,
    activeModel,
    modelLabel,
    authMethod,
    selectedProvider,
    isAuthenticated,
}: HeaderProps) {
    const cwd = getCwd()
    const branch = getGitBranch()

    let modelStatusLine: string | null = null
    if (isAuthenticated === false) {
        modelStatusLine = 'Not connected · Run /login'
    } else {
        const modelName = modelLabel || formatModelDisplayName(activeModel)
        const billingLabel = formatBillingLabel(
            authMethod,
            selectedProvider,
            activeModel,
            isAuthenticated ?? true
        )
        if (modelName && billingLabel) {
            modelStatusLine = `${modelName} · ${billingLabel}`
        } else if (modelName) {
            modelStatusLine = modelName
        } else if (billingLabel) {
            modelStatusLine = billingLabel
        }
    }

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
            {modelStatusLine && <Text color={THEME.colors.subtle}>{modelStatusLine}</Text>}
            <Box gap={1}>
                <Text color={THEME.colors.subtle}>{cwd}</Text>
                {branch && <Text color={THEME.colors.subtle}>({branch})</Text>}
            </Box>
            {latestVersion ? (
                <Box flexDirection="column" marginTop={1}>
                    <Box>
                        <Text color={THEME.colors.brand}>▎ </Text>
                        <Text bold color={THEME.colors.text}>
                            A new version is available:{' '}
                            <Text color={THEME.colors.brand}>
                                v{cliVersion.replace(/^v/, '')} → v{latestVersion.replace(/^v/, '')}
                            </Text>
                        </Text>
                    </Box>
                    <Box>
                        <Text color={THEME.colors.brand}>▎ </Text>
                        <Text color={THEME.colors.muted}>
                            Run{' '}
                            <Text bold color={THEME.colors.text}>
                                /update
                            </Text>{' '}
                            to upgrade · Changelog:{' '}
                            <Text color={THEME.colors.brand}>
                                {terminalLink(
                                    'trydecember.com/docs/changelog',
                                    'https://trydecember.com/docs/changelog'
                                )}
                            </Text>
                        </Text>
                    </Box>
                </Box>
            ) : announcement ? (
                <Box flexDirection="column" marginTop={1}>
                    <Box>
                        <Text color={THEME.colors.brand}>▎ </Text>
                        <Text bold color={THEME.colors.text}>
                            {announcement.title || `What's New in v${announcement.version}`}
                        </Text>
                    </Box>
                    {announcement.bullets.slice(0, 2).map((bullet, idx) => (
                        <Box key={idx}>
                            <Text color={THEME.colors.brand}>▎ </Text>
                            <Text color={THEME.colors.muted}>{bullet}</Text>
                        </Box>
                    ))}
                    {announcement.url && (
                        <Box>
                            <Text color={THEME.colors.brand}>▎ </Text>
                            <Text color={THEME.colors.muted}>Check out detailed changelog on </Text>
                            <Text color={THEME.colors.brand}>
                                {terminalLink(announcement.url, announcement.url)}
                            </Text>
                        </Box>
                    )}
                </Box>
            ) : null}
        </Box>
    )
})
