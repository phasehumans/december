import { Box, Text, useInput } from 'ink'
import SelectInput from 'ink-select-input'
import React from 'react'

import { THEME } from '../../theme'

import { MenuFooter } from './menu-footer'
import { CustomIndicator } from './menu-items'

import type { HandoffSummary } from '../../types'

export interface HandoffConfirmMenuProps {
    handoffSummary?: HandoffSummary
    handleHandoffConfirmSelect?: (item: { label: string; value: 'confirm' | 'cancel' }) => void
}

function HandoffItemComponent({
    label,
    value,
    isSelected,
}: {
    label: string
    value?: string
    isSelected?: boolean
}) {
    let color: string = THEME.colors.text
    if (value === 'confirm') {
        color = THEME.colors.success
    } else if (value === 'cancel') {
        color = THEME.colors.error
    }

    return (
        <Text color={isSelected ? color : THEME.colors.muted} bold={isSelected}>
            {label}
        </Text>
    )
}

export function HandoffConfirmMenu({
    handoffSummary,
    handleHandoffConfirmSelect,
}: HandoffConfirmMenuProps) {
    const items = [
        { label: '[y] Confirm & Handoff to Cloud', value: 'confirm' as const },
        { label: '[n] Cancel', value: 'cancel' as const },
    ]

    useInput((input, key) => {
        const lower = (input || '').toLowerCase()
        if (lower === 'y') {
            handleHandoffConfirmSelect?.({
                label: '[y] Confirm & Handoff to Cloud',
                value: 'confirm',
            })
        } else if (lower === 'n' || key.escape) {
            handleHandoffConfirmSelect?.({ label: '[n] Cancel', value: 'cancel' })
        }
    })

    return (
        <Box flexDirection="column">
            <Box marginBottom={1} flexDirection="column" gap={1}>
                <Text color={THEME.colors.brand} bold>
                    December Cloud Session Handoff
                </Text>
                {handoffSummary && (
                    <Box
                        borderStyle="single"
                        borderColor={THEME.colors.border}
                        flexDirection="column"
                        paddingX={1}
                        paddingY={0}
                    >
                        <Text>
                            <Text color={THEME.colors.muted}>Workspace Files: </Text>
                            <Text bold>{handoffSummary.fileCount.toLocaleString()}</Text>
                        </Text>
                        <Text>
                            <Text color={THEME.colors.muted}>Estimated Size: </Text>
                            <Text bold>{handoffSummary.uncompressedSize}</Text>
                        </Text>
                        <Text>
                            <Text color={THEME.colors.muted}>Uncommitted Changes: </Text>
                            <Text bold>{handoffSummary.uncommittedChanges}</Text>
                        </Text>
                        <Text>
                            <Text color={THEME.colors.muted}>Destination: </Text>
                            <Text bold color={THEME.colors.brand}>
                                {handoffSummary.destinationUrl}
                            </Text>
                        </Text>
                        <Text>
                            <Text color={THEME.colors.muted}>Wallet Credit Status: </Text>
                            <Text bold color={THEME.colors.success}>
                                {handoffSummary.walletBalance}
                            </Text>
                        </Text>
                        {handoffSummary.detectedSecrets &&
                            handoffSummary.detectedSecrets.length > 0 && (
                                <Box flexDirection="column" marginTop={1}>
                                    <Text color={THEME.colors.warning} bold>
                                        Warning: Potential secrets detected in workspace:
                                    </Text>
                                    {handoffSummary.detectedSecrets.slice(0, 3).map((sec, idx) => (
                                        <Text key={idx} color={THEME.colors.warning}>
                                            {'  '}• {sec}
                                        </Text>
                                    ))}
                                </Box>
                            )}
                    </Box>
                )}
                <Text color={THEME.colors.text}>
                    Migrate this local session and workspace to December Cloud?
                </Text>
            </Box>
            <SelectInput
                items={items}
                onSelect={(item) => handleHandoffConfirmSelect?.(item as any)}
                indicatorComponent={CustomIndicator}
                itemComponent={HandoffItemComponent}
            />
            <MenuFooter
                items={[
                    { key: 'y', label: 'Confirm' },
                    { key: 'n', label: 'Cancel' },
                    { key: 'enter', label: 'Select' },
                ]}
            />
        </Box>
    )
}
