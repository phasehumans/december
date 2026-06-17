import { TextAttributes } from '@opentui/core'

import { useTheme } from '../providers/theme'

import { Spinner } from './spinner'

const MODEL = 'opus-4-6'
const MODE = 'normal'

type Props = {
    loading?: boolean
}

export function StatusBar({ loading = false }: Props) {
    const { colors } = useTheme()

    return (
        <box flexDirection="row" justifyContent="space-between" width="100%" paddingX={1} gap={2}>
            <box flexDirection="row" gap={1} alignItems="center">
                <text fg={colors.primary}>◆</text>
                <text>{MODE}</text>
                <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                    ›
                </text>
                <text attributes={TextAttributes.DIM}>{MODEL}</text>
            </box>

            <box flexDirection="row" gap={1} alignItems="center" flexShrink={0}>
                {loading ? (
                    <>
                        <Spinner />
                        <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                            esc to interrupt
                        </text>
                    </>
                ) : (
                    <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
                        shift+tab modes · / commands · @ files
                    </text>
                )}
            </box>
        </box>
    )
}
