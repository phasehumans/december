import { LOGO_LINES } from '../constants'
import { useTheme } from '../providers/theme'

type Props = {
    color?: string
}

export function Logo({ color }: Props) {
    const { colors } = useTheme()

    return (
        <box flexDirection="column" flexShrink={0}>
            {LOGO_LINES.map((line, i) => (
                <text key={i} fg={color ?? colors.primary} selectable={false}>
                    {line}
                </text>
            ))}
        </box>
    )
}
