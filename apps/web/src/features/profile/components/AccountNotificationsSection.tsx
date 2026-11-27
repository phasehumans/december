import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { SettingsRow, SettingsSection } from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'
import {
    profileAPI,
    type NotifyLevel,
    type UpdateNotificationInput,
} from '@/features/profile/api/profile'
import { useBrowserPush } from '@/features/profile/hooks/useBrowserPush'

const LEVELS: { value: NotifyLevel; label: string }[] = [
    { value: 'ALL', label: 'Everything' },
    { value: 'IMPORTANT', label: 'Important' },
    { value: 'NONE', label: 'Nothing' },
]

interface AccountNotificationsSectionProps {
    onNotificationChange: (settings: UpdateNotificationInput) => void
}

/**
 * Notifications, a section of the Account page (N1-D, #636): the level, browser push for
 * this device, then product updates and security alerts (always on). December sends no
 * email for these: the inbox and push only (inbox review S1, S2).
 */
export const AccountNotificationsSection: React.FC<AccountNotificationsSectionProps> = ({
    onNotificationChange,
}) => {
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const push = useBrowserPush()

    const level = profile?.notifyLevel ?? 'IMPORTANT'

    const showPush = push.state !== 'unsupported' && push.state !== 'unavailable'

    return (
        <SettingsSection
            title="Notifications"
            description="What December tells you about, and where."
        >
            <SettingsRow label="Notify me about">
                <ChoiceGroup
                    label="Notify me about"
                    options={LEVELS}
                    value={level}
                    onChange={(value) => onNotificationChange({ notifyLevel: value })}
                />
            </SettingsRow>
            {showPush && (
                <SettingsRow label="Browser push" hint={push.error ?? undefined}>
                    <Switch
                        label="Browser push"
                        checked={push.state === 'on'}
                        disabled={
                            push.isPending || push.state === 'loading' || push.state === 'blocked'
                        }
                        disabledReason={
                            push.state === 'blocked'
                                ? 'Blocked in your browser settings'
                                : undefined
                        }
                        onChange={(value) => void (value ? push.turnOn() : push.turnOff())}
                    />
                </SettingsRow>
            )}
            <SettingsRow label="Product updates">
                <Switch
                    label="Product updates"
                    checked={profile?.notifyProductUpdates ?? true}
                    onChange={(value) => onNotificationChange({ notifyProductUpdates: value })}
                />
            </SettingsRow>
            <SettingsRow label="Security alerts">
                <Switch
                    label="Security alerts"
                    checked
                    disabled
                    disabledReason="Always on"
                    onChange={() => undefined}
                />
            </SettingsRow>
        </SettingsSection>
    )
}
