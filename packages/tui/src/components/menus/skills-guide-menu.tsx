import { Box, Text, useInput } from 'ink'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

export interface SkillsGuideMenuProps {
    setAuthMode: (mode: any) => void
}

export function SkillsGuideMenu({ setAuthMode }: SkillsGuideMenuProps) {
    useInput((input, key) => {
        if (key.escape || key.return || input === 'q' || input === 'Q') {
            setAuthMode('none')
        }
    })

    return (
        <Box flexDirection="column" marginY={0.5}>
            <Box flexDirection="row" gap={3}>
                <Box flexDirection="column" width={38}>
                    <Text color={THEME.colors.brand} bold>
                        COMMANDS
                    </Text>
                    <Text color={THEME.colors.text}>december skill add &lt;source&gt;</Text>
                    <Text color={THEME.colors.text}>december skill add --local &lt;source&gt;</Text>
                    <Text color={THEME.colors.text}>december skill create &lt;name&gt;</Text>
                    <Text color={THEME.colors.text}>december skill list</Text>
                    <Text color={THEME.colors.text}>december skill remove &lt;name&gt;</Text>
                </Box>
                <Box flexDirection="column">
                    <Text color={THEME.colors.brand} bold>
                        SOURCES
                    </Text>
                    <Text>
                        <Text color={THEME.colors.text}>mattpocock/skills</Text>{' '}
                        <Text color={THEME.colors.muted}>engineering, tdd</Text>
                    </Text>
                    <Text>
                        <Text color={THEME.colors.text}>vercel-labs/skills</Text>{' '}
                        <Text color={THEME.colors.muted}>web, next.js, ui</Text>
                    </Text>
                    <Text>
                        <Text color={THEME.colors.text}>anthropics/skills</Text>{' '}
                        <Text color={THEME.colors.muted}>claude tools, prompts</Text>
                    </Text>
                    <Text>
                        <Text color={THEME.colors.text}>phasehumans/december</Text>{' '}
                        <Text color={THEME.colors.muted}>official skills</Text>
                    </Text>
                    <Text>
                        <Text color={THEME.colors.text}>agentskills.org</Text>{' '}
                        <Text color={THEME.colors.muted}>open skill registry</Text>
                    </Text>
                </Box>
            </Box>
            <Box marginTop={0.5}>
                <Text color={THEME.colors.dim}>
                    Chat: <Text color={THEME.colors.muted}>/skill:&lt;name&gt;</Text> (e.g.
                    /skill:tdd) Scopes: <Text color={THEME.colors.muted}>global</Text> (~/.config)
                    or <Text color={THEME.colors.muted}>--local</Text> (.december)
                </Text>
            </Box>
            <MenuFooter items={[{ key: 'esc', label: 'Back to chat' }]} />
        </Box>
    )
}
