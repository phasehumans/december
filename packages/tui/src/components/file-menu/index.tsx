import { Box, Text } from 'ink'
import React from 'react'

import { THEME } from '../../theme'
import { type ScoredFile } from '../../utils/fuzzy'

export const FILE_WINDOW_SIZE = 5

type FileMenuProps = {
    files: ScoredFile[]
    selectedIndex: number
    windowStart: number
}

function renderHighlightedBasename(basename: string, indices: number[], isSelected: boolean) {
    if (indices.length === 0) {
        return (
            <Text bold={isSelected} color={isSelected ? THEME.colors.brand : THEME.colors.text}>
                {basename}
            </Text>
        )
    }

    const indexSet = new Set(indices)
    const spans: React.ReactNode[] = []
    let currentSpan = ''
    let currentIsMatch = false

    for (let i = 0; i < basename.length; i++) {
        const isMatch = indexSet.has(i)
        if (i === 0) {
            currentIsMatch = isMatch
            currentSpan = basename[i] || ''
        } else if (isMatch === currentIsMatch) {
            currentSpan += basename[i] || ''
        } else {
            spans.push(
                <Text
                    key={i}
                    bold={isSelected || currentIsMatch}
                    underline={currentIsMatch}
                    color={
                        currentIsMatch
                            ? THEME.colors.brand
                            : isSelected
                              ? THEME.colors.brand
                              : THEME.colors.text
                    }
                >
                    {currentSpan}
                </Text>
            )
            currentIsMatch = isMatch
            currentSpan = basename[i] || ''
        }
    }

    if (currentSpan) {
        spans.push(
            <Text
                key="end"
                bold={isSelected || currentIsMatch}
                underline={currentIsMatch}
                color={
                    currentIsMatch
                        ? THEME.colors.brand
                        : isSelected
                          ? THEME.colors.brand
                          : THEME.colors.text
                }
            >
                {currentSpan}
            </Text>
        )
    }

    return spans
}

export function FileMenu({ files, selectedIndex, windowStart }: FileMenuProps) {
    if (files.length === 0) {
        return (
            <Box paddingLeft={2}>
                <Text color={THEME.colors.muted}>No matching files</Text>
            </Box>
        )
    }

    const windowEnd = Math.min(windowStart + FILE_WINDOW_SIZE, files.length)
    const visibleItems = files.slice(windowStart, windowEnd)
    const itemsAbove = windowStart
    const itemsBelow = files.length - windowEnd
    const hasOverflow = files.length > FILE_WINDOW_SIZE

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
            {visibleItems.map((file, relIdx) => {
                const absIdx = windowStart + relIdx
                const isSelected = absIdx === selectedIndex
                const hasDir = file.dir && file.dir !== '.'
                const dirPrefix = hasDir ? `${file.dir}/` : ''

                return (
                    <Box key={file.path} flexDirection="row">
                        <Text color={isSelected ? THEME.colors.brand : THEME.colors.muted}>
                            {isSelected ? `${THEME.glyphs.selector} ` : '  '}
                        </Text>
                        <Text wrap="truncate-end">
                            {hasDir && <Text color={THEME.colors.muted}>{dirPrefix}</Text>}
                            {renderHighlightedBasename(
                                file.basename,
                                file.basenameIndices,
                                isSelected
                            )}
                        </Text>
                    </Box>
                )
            })}

            {hasOverflow && statusText && (
                <Box paddingLeft={2}>
                    <Text color={THEME.colors.muted}>{statusText}</Text>
                </Box>
            )}
        </Box>
    )
}
