import { Box, Text, useInput } from 'ink'
import React, { useState } from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'

const CMD_COL_WIDTH = 34
const WINDOW_SIZE = 15

export const SHORTCUTS = [
    { key: '/', desc: 'Open slash commands' },
    { key: '! <cmd>', desc: 'Execute shell command directly (e.g. !git status)' },
    { key: '↑ / ↓', desc: 'Scroll chat up / down (when prompt empty)' },
    { key: 'pageup / pagedown', desc: 'Scroll chat by page' },
    { key: 'ctrl / shift + ↑ / ↓', desc: 'Scroll chat smoothly / line by line' },
    { key: 'home / end', desc: 'Jump to top / bottom' },
    { key: 'ctrl+p', desc: 'Previous prompt history' },
    { key: 'ctrl+n', desc: 'Next prompt history' },
    { key: 'ctrl+a', desc: 'Go to start' },
    { key: 'ctrl+e', desc: 'Go to end' },
    { key: 'ctrl+k', desc: 'Delete to end' },
    { key: 'ctrl+u', desc: 'Delete to start' },
    { key: 'ctrl+w', desc: 'Delete word' },
    { key: 'ctrl+y', desc: 'Quick copy (yank)' },
    { key: 'ctrl+c', desc: 'Exit / Graceful interrupt' },
    { key: 'ctrl+h', desc: 'Session history' },
    { key: 'ctrl+l', desc: 'Login / Account menu' },
    { key: 'ctrl+t', desc: 'Tasks mode' },
    { key: 'alt+enter', desc: 'Insert newline' },
    { key: 'esc', desc: 'Cancel / Return to bottom' },
]

export function ShortcutsMenu({ onClose }: { onClose: () => void }) {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [windowStart, setWindowStart] = useState(0)

    useInput((input, key) => {
        const isWheelUp =
            /\[<(?:64|68|72|80|84);/.test(input) || /\[M[`@]/.test(input) || /\[64~/.test(input)
        const isWheelDown =
            /\[<(?:65|69|73|81|85);/.test(input) || /\[Ma/.test(input) || /\[65~/.test(input)

        if (key.upArrow || input === 'k' || isWheelUp) {
            setSelectedIndex((prev) => {
                const count = isWheelUp
                    ? Math.max(1, (input.match(/\[<(?:64|68|72|80|84);/g) || []).length)
                    : 1
                const next = Math.max(0, prev - count)
                if (next < windowStart) setWindowStart(next)
                return next
            })
            return
        }
        if (key.downArrow || input === 'j' || isWheelDown) {
            setSelectedIndex((prev) => {
                const count = isWheelDown
                    ? Math.max(1, (input.match(/\[<(?:65|69|73|81|85);/g) || []).length)
                    : 1
                const next = Math.min(SHORTCUTS.length - 1, prev + count)
                if (next >= windowStart + WINDOW_SIZE) {
                    setWindowStart(next - WINDOW_SIZE + 1)
                }
                return next
            })
            return
        }
        if (key.escape || (key.ctrl && input === 'c')) {
            onClose()
            return
        }
    })

    const windowEnd = Math.min(windowStart + WINDOW_SIZE, SHORTCUTS.length)
    const visibleItems = SHORTCUTS.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = SHORTCUTS.length - windowEnd
    const hasOverflow = SHORTCUTS.length > WINDOW_SIZE

    let statusText = ''
    if (hasOverflow) {
        if (itemsAbove > 0 && itemsBelow > 0) {
            statusText = `↑ ${itemsAbove} more · ↓ ${itemsBelow} more`
        } else if (itemsAbove > 0) {
            statusText = `↑ ${itemsAbove} more`
        } else if (itemsBelow > 0) {
            statusText = `↓ ${itemsBelow} more`
        }
    }

    return (
        <Box flexDirection="column">
            {/* List container with fixed minHeight to prevent layout shifts during scroll */}
            <Box flexDirection="column" minHeight={17}>
                {/* rows */}
                {visibleItems.map((cmd, relIdx) => {
                    const absIdx = windowStart + relIdx
                    const isSelected = absIdx === selectedIndex
                    return (
                        <Box key={cmd.key} flexDirection="row">
                            <Box width={2}>
                                <Text color={isSelected ? THEME.colors.brand : THEME.colors.muted}>
                                    {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                                </Text>
                            </Box>
                            <Box width={CMD_COL_WIDTH}>
                                <Text
                                    color={isSelected ? THEME.colors.brand : THEME.colors.muted}
                                    bold={false}
                                >
                                    {cmd.key}
                                </Text>
                            </Box>
                            <Text color={THEME.colors.muted}>{cmd.desc}</Text>
                        </Box>
                    )
                })}

                {/* bottom status line for overflow pagination */}
                {hasOverflow && statusText && (
                    <Box paddingLeft={2}>
                        <Text color={THEME.colors.muted}>{statusText}</Text>
                    </Box>
                )}
            </Box>

            <Box paddingLeft={2} paddingTop={1}>
                <Text color={THEME.colors.muted}>
                    [{selectedIndex + 1}-{windowEnd} of {SHORTCUTS.length} items]
                </Text>
            </Box>

            {/* footer */}
            <MenuFooter
                items={[
                    { key: '↑/↓', label: 'Navigate' },
                    { key: 'esc', label: 'Close' },
                ]}
            />
        </Box>
    )
}
