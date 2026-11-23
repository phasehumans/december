import React from 'react'

import { PAGE_SUBTITLES } from './settingsStyles'
import {
    SettingsInput,
    SettingsPage,
    SettingsRow,
    SettingsSection,
    SettingsSoon,
    usePreviewOn,
    usePreviewValue,
} from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'

type NotifyLevel = 'all' | 'important' | 'none'

const LEVELS: { value: NotifyLevel; label: string }[] = [
    { value: 'all', label: 'Everything' },
    { value: 'important', label: 'Important' },
    { value: 'none', label: 'Nothing' },
]

interface ProfileNotificationsSettingsProps {
    productUpdates: boolean
    securityAlerts: boolean
    onNotificationToggle: (
        field: 'notifyProjectActivity' | 'notifyProductUpdates' | 'notifySecurityAlerts',
        value: boolean
    ) => void
}

/**
 * Notifications (N1-D): one level, the places, a daily summary. The first block is ui only
 * (issue 636). Product updates and security alerts are the real switches from Account.
 */
export const ProfileNotificationsSettings: React.FC<ProfileNotificationsSettingsProps> = ({
    productUpdates,
    securityAlerts,
    onNotificationToggle,
}) => {
    const isPreview = usePreviewOn()
    const [level, setLevel] = usePreviewValue<NotifyLevel>('notify.level', 'important')
    const [email, setEmail] = usePreviewValue('notify.email', true)
    const [push, setPush] = usePreviewValue('notify.push', false)
    const [digest, setDigest] = usePreviewValue('notify.digest', true)
    const [digestTime, setDigestTime] = usePreviewValue('notify.digestTime', '09:00')

    if (!isPreview) {
        return (
            <SettingsSoon
                title="Notifications"
                subtitle={PAGE_SUBTITLES.notifications}
                text="Notification settings are coming soon"
            />
        )
    }

    return (
        <SettingsPage title="Notifications" subtitle={PAGE_SUBTITLES.notifications}>
            <SettingsSection
                title="Activity"
                description="What December tells you about your sessions."
            >
                <SettingsRow label="Notify me about">
                    <ChoiceGroup
                        label="Notify me about"
                        options={LEVELS}
                        value={level}
                        onChange={setLevel}
                    />
                </SettingsRow>
                <SettingsRow label="Email">
                    <Switch label="Email" checked={email} onChange={setEmail} />
                </SettingsRow>
                <SettingsRow label="Browser push">
                    <Switch label="Browser push" checked={push} onChange={setPush} />
                </SettingsRow>
                <SettingsRow label="Daily summary">
                    <SettingsInput
                        label="Daily summary time"
                        type="time"
                        value={digestTime}
                        onChange={setDigestTime}
                        className="w-[136px]"
                    />
                    <Switch label="Daily summary" checked={digest} onChange={setDigest} />
                </SettingsRow>
            </SettingsSection>

            <SettingsSection title="Updates" description="News and security notices from December.">
                <SettingsRow label="Product updates">
                    <Switch
                        label="Product updates"
                        checked={productUpdates}
                        onChange={(value) => onNotificationToggle('notifyProductUpdates', value)}
                    />
                </SettingsRow>
                <SettingsRow label="Security alerts">
                    <Switch
                        label="Security alerts"
                        checked={securityAlerts}
                        onChange={(value) => onNotificationToggle('notifySecurityAlerts', value)}
                    />
                </SettingsRow>
            </SettingsSection>
        </SettingsPage>
    )
}
