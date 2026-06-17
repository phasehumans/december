import { TextAttributes } from '@opentui/core'

import { useTheme } from '../providers/theme'

const TIPS = [
    'Use /help to see all available slash commands',
    'Type @ to mention files and add them as context',
    'Use Shift+Tab to cycle modes, /plan and /ask to switch profiles',
    'Use /clear to start a fresh conversation',
]

export function Tips() {
    const { colors } = useTheme()

    return (
        <box flexDirection="column" gap={0} paddingX={1}>
            <text fg={colors.dimSeparator} attributes={TextAttributes.DIM}>
                A few tips to get the most out of December:
            </text>
            {TIPS.map((tip, i) => (
                <box key={i} flexDirection="row" gap={1}>
                    <text fg={colors.primary}>{`${i + 1}.`}</text>
                    <text attributes={TextAttributes.DIM}>{tip}</text>
                </box>
            ))}
        </box>
    )
}
