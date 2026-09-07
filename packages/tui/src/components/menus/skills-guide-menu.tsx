import { Box, Text, useInput } from 'ink'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface SkillsGuideMenuProps {
    setAuthMode: (mode: any) => void
}

export function SkillsGuide() {
    return (
        <Box flexDirection="column" marginY={0.5}>
            <Text color={THEME.colors.dim}>Chat</Text>
            <Box flexDirection="row" paddingLeft={2}>
                <Box width={32}>
                    <Text color={THEME.colors.brand}>/skill:&lt;name&gt;</Text>
                </Box>
                <Text color={THEME.colors.muted}>Invoke a skill in chat (e.g. /skill:tdd)</Text>
            </Box>

            <Box marginTop={0.5} flexDirection="column">
                <Text color={THEME.colors.dim}>CLI</Text>
                <Box flexDirection="column" paddingLeft={2}>
                    <Box flexDirection="row">
                        <Box width={32}>
                            <Text color={THEME.colors.text}>december skill list</Text>
                        </Box>
                        <Text color={THEME.colors.muted}>List installed skills</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Box width={32}>
                            <Text color={THEME.colors.text}>december skill add &lt;source&gt;</Text>
                        </Box>
                        <Text color={THEME.colors.muted}>
                            Install from GitHub (e.g. mattpocock/skills)
                        </Text>
                    </Box>
                    <Box flexDirection="row">
                        <Box width={32}>
                            <Text color={THEME.colors.text}>december skill info &lt;name&gt;</Text>
                        </Box>
                        <Text color={THEME.colors.muted}>View skill docs &amp; parameters</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Box width={32}>
                            <Text color={THEME.colors.text}>
                                december skill create &lt;name&gt;
                            </Text>
                        </Box>
                        <Text color={THEME.colors.muted}>Scaffold a new skill</Text>
                    </Box>
                    <Box flexDirection="row">
                        <Box width={32}>
                            <Text color={THEME.colors.text}>
                                december skill remove &lt;name&gt;
                            </Text>
                        </Box>
                        <Text color={THEME.colors.muted}>Uninstall a skill</Text>
                    </Box>
                </Box>
            </Box>

            <Box marginTop={0.5} flexDirection="column">
                <Text color={THEME.colors.dim}>
                    Scopes: <Text color={THEME.colors.muted}>global (~/.config)</Text> ·{' '}
                    <Text color={THEME.colors.muted}>--local (.december)</Text>
                </Text>
                <Text color={THEME.colors.dim}>
                    Explore: <Text color={THEME.colors.muted}>agentskills.org</Text> ·{' '}
                    <Text color={THEME.colors.muted}>vercel-labs/skills</Text> ·{' '}
                    <Text color={THEME.colors.muted}>anthropics/skills</Text>
                </Text>
            </Box>
        </Box>
    )
}

export function SkillsGuideMenu({ setAuthMode }: SkillsGuideMenuProps) {
    useInput((input, key) => {
        if (key.escape || key.return || input === 'q' || input === 'Q') {
            setAuthMode('none')
        }
    })

    return (
        <Box flexDirection="column">
            <SkillsGuide />
            <MenuFooter items={[{ key: 'esc', label: 'Back to chat' }]} />
        </Box>
    )
}
