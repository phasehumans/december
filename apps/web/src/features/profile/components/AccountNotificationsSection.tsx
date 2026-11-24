import React from 'react'

import { SettingsInput, SettingsRow, SettingsSection, usePreviewValue } from './SettingsUi'

import { ChoiceGroup, Switch } from '@/features/connections/components/ConnectionsUi'

type NotifyLevel = 'all' | 'important' | 'none'

const LEVELS: { value: NotifyLevel; label: string }[] = [
    { value: 'all', label: 'Everything' },
    { value: 'important', label: 'Important' },
    { value: 'none', label: 'Nothing' },
]

interface AccountNotificationsSectionProps {
    productUpdates: boolean
    securityAlerts: boolean
    onNotificationToggle: (
        field: 'notifyProjectActivity' | 'notifyProductUpdates' | 'notifySecurityAlerts',
        value: boolean
    ) => void
    /** show the ui-only rows (level, email, push, daily summary, issue 636) */
    showPreviewRows: boolean
}

/**
 * Notifications, a section of the Account page (it was its own page, N1-D). Product updates
 * and security alerts are the real switches. The other rows show only with the preview on.
 */
export const AccountNotificationsSection: React.FC<AccountNotificationsSectionProps> = ({
    productUpdates,
    securityAlerts,
    onNotificationToggle,
    showPreviewRows,
}) => {
    const [level, setLevel] = usePreviewValue<NotifyLevel>('notify.level', 'important')
    const [email, setEmail] = usePreviewValue('notify.email', true)
    const [push, setPush] = usePreviewValue('notify.push', false)
    const [digest, setDigest] = usePreviewValue('notify.digest', true)
    const [digestTime, setDigestTime] = usePreviewValue('notify.digestTime', '09:00')

    return (
        <SettingsSection
            title="Notifications"
            description={
                showPreviewRows
                    ? 'What December tells you about, and where.'
                    : 'Emails December sends you.'
            }
        >
            {showPreviewRows && (
                <>
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
                </>
            )}
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
    )
}
