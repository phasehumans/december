import { useQuery } from '@tanstack/react-query'
import React from 'react'

import { SettingsInput, SettingsRow, SettingsSection } from './SettingsUi'

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

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

/** the time zone of this browser, so the summary comes at the user's local time */
const browserTimezone = () => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
        // Intentionally swallowed: an old browser without Intl time zones gets UTC
        return 'UTC'
    }
}

interface AccountNotificationsSectionProps {
    onNotificationChange: (settings: UpdateNotificationInput) => void
}

/**
 * Notifications, a section of the Account page (N1-D, #636): the level, email, browser push
 * for this device, the daily summary, then product updates and security alerts (always on).
 */
export const AccountNotificationsSection: React.FC<AccountNotificationsSectionProps> = ({
    onNotificationChange,
}) => {
    const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: profileAPI.getProfile })
    const push = useBrowserPush()

    const level = profile?.notifyLevel ?? 'IMPORTANT'
    const savedTime = profile?.digestTime ?? '09:00'
    const [digestTime, setDigestTime] = React.useState(savedTime)
    React.useEffect(() => setDigestTime(savedTime), [savedTime])

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
            <SettingsRow label="Email">
                <Switch
                    label="Email"
                    checked={profile?.notifyEmail ?? true}
                    onChange={(value) => onNotificationChange({ notifyEmail: value })}
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
            <SettingsRow label="Daily summary">
                <SettingsInput
                    label="Daily summary time"
                    type="time"
                    value={digestTime}
                    onChange={(value) => {
                        setDigestTime(value)
                        if (TIME_PATTERN.test(value) && value !== savedTime) {
                            onNotificationChange({ digestTime: value, timezone: browserTimezone() })
                        }
                    }}
                    className="w-[136px]"
                />
                <Switch
                    label="Daily summary"
                    checked={profile?.digestEnabled ?? false}
                    onChange={(value) =>
                        onNotificationChange({ digestEnabled: value, timezone: browserTimezone() })
                    }
                />
            </SettingsRow>
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
