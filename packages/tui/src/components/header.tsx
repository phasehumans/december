import { homedir } from 'node:os'

import { TextAttributes } from '@opentui/core'

import { APP_NAME, APP_TAGLINE, APP_VERSION } from '../constants'
import { useTheme } from '../providers/theme'

import { Logo } from './logo'

function shortCwd(): string {
    const cwd = process.cwd()
    const home = homedir()
    return cwd.startsWith(home) ? '~' + cwd.slice(home.length) : cwd
}

export function Header() {
    const { colors } = useTheme()

    return (
        <box
            border
            borderStyle="rounded"
            borderColor={colors.thinkingBorder}
            backgroundColor={colors.surface}
            paddingX={2}
            paddingY={1}
            flexDirection="row"
            alignItems="center"
            gap={3}
        >
            <Logo />

            <box flexDirection="column" justifyContent="center" gap={0}>
                <box flexDirection="row" gap={1} alignItems="center">
                    <text fg={colors.primary} attributes={TextAttributes.BOLD}>
                        {APP_NAME}
                    </text>
                    <text fg={colors.dimSeparator}>v{APP_VERSION}</text>
                </box>
                <text fg={colors.dimSeparator}>{APP_TAGLINE}</text>
                <box height={1} />
                <box flexDirection="row" gap={1}>
                    <text fg={colors.dimSeparator}>cwd</text>
                    <text attributes={TextAttributes.DIM}>{shortCwd()}</text>
                </box>
            </box>
        </box>
    )
}
